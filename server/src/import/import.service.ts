import {
  BadRequestException,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { inArray } from 'drizzle-orm';
import { DRIZZLE } from '../database/database.constants';
import type { Database } from '../database/database.module';
import {
  accounts,
  categories,
  transactions,
  type NewTransaction,
} from '../database/schema';
import { computeFingerprint } from '../common/fingerprint';
import {
  detectColumns,
  detectHeaderRow,
  normalizeDate,
  parseAmount,
  parseCsv,
  type ColumnMapping,
  type SignConvention,
} from './csv';
import { CsvImportDto, CsvPreviewDto } from './import.dto';

const MAX_CSV_CHARS = 10_000_000;
const MAX_ROWS = 100_000;
const INSERT_CHUNK = 500;
const LOOKUP_CHUNK = 1000;
const SAMPLE_ROWS = 5;

export interface CsvPreviewResult {
  headers: string[];
  columnCount: number;
  sampleRows: string[][];
  rowCount: number;
  hasHeader: boolean;
  mapping: ColumnMapping;
  ambiguous: string[];
}

export interface CsvImportResult {
  inserted: number;
  duplicates: number;
  skipped: number;
  needsReview: number;
  totalRows: number;
}

interface ParsedRow {
  date: string;
  merchant: string;
  category: string;
  account: string;
  notes: string | null;
  amount: number;
  type: 'expense' | 'income';
  fingerprint: string;
}

@Injectable()
export class ImportService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  preview(dto: CsvPreviewDto): CsvPreviewResult {
    const rows = parseCsv(dto.csv);
    if (rows.length === 0) {
      throw new BadRequestException({
        message: 'The CSV file has no rows.',
        code: 'INVALID_CSV',
      });
    }
    if (dto.csv.length > MAX_CSV_CHARS) {
      throw new BadRequestException({
        message: 'The CSV file is too large.',
        code: 'PAYLOAD_TOO_LARGE',
      });
    }

    const hasHeader = detectHeaderRow(rows);
    const headerCells = hasHeader ? rows[0] : [];
    const dataRows = hasHeader ? rows.slice(1) : rows;
    if (dataRows.length > MAX_ROWS) {
      throw new BadRequestException({
        message: `The CSV file has too many rows (max ${MAX_ROWS}).`,
        code: 'PAYLOAD_TOO_LARGE',
      });
    }

    const detection = detectColumns(hasHeader ? headerCells : (rows[0] ?? []));
    const sampleRows = dataRows.slice(0, SAMPLE_ROWS);

    return {
      headers: headerCells,
      columnCount: (hasHeader ? headerCells : rows[0]).length,
      sampleRows,
      rowCount: dataRows.length,
      hasHeader,
      mapping: detection.mapping,
      ambiguous: detection.ambiguous,
    };
  }

  async importCsv(dto: CsvImportDto): Promise<CsvImportResult> {
    if (dto.csv.length > MAX_CSV_CHARS) {
      throw new BadRequestException({
        message: 'The CSV file is too large.',
        code: 'PAYLOAD_TOO_LARGE',
      });
    }

    const rows = parseCsv(dto.csv);
    if (rows.length === 0) {
      throw new BadRequestException({
        message: 'The CSV file has no rows.',
        code: 'INVALID_CSV',
      });
    }

    const { mapping, hasHeader } = this.resolveMapping(dto, rows);

    const dataRows = hasHeader ? rows.slice(1) : rows;
    if (dataRows.length > MAX_ROWS) {
      throw new BadRequestException({
        message: `The CSV file has too many rows (max ${MAX_ROWS}).`,
        code: 'PAYLOAD_TOO_LARGE',
      });
    }

    const signConvention: SignConvention =
      dto.signConvention ?? 'negative-expense';
    const [categoryMap, accountMap] = await Promise.all([
      this.categoryLookup(),
      this.accountLookup(),
    ]);

    const values: NewTransaction[] = [];
    let skipped = 0;
    for (const row of dataRows) {
      const parsed = this.parseRow(
        row,
        mapping,
        signConvention,
        categoryMap,
        accountMap,
      );
      if (parsed === null) {
        skipped += 1;
        continue;
      }
      values.push({
        date: parsed.date,
        merchant: parsed.merchant,
        category: parsed.category,
        amount: parsed.amount,
        type: parsed.type,
        account: parsed.account,
        notes: parsed.notes,
        tags: [],
        receipt: false,
        source: 'csv',
        fingerprint: parsed.fingerprint,
      });
    }

    const plannedFingerprints = values.map((value) => value.fingerprint);
    const existingSet =
      await this.findExistingFingerprints(plannedFingerprints);
    const unique = new Map<string, NewTransaction>();
    for (const value of values) {
      if (
        !existingSet.has(value.fingerprint) &&
        !unique.has(value.fingerprint)
      ) {
        unique.set(value.fingerprint, value);
      }
    }
    const fresh = [...unique.values()];
    const duplicateCount = values.length - fresh.length;
    let needsReview = 0;
    for (const value of fresh) {
      if (value.category === 'Needs review') {
        needsReview += 1;
      }
    }

    let inserted = 0;
    try {
      for (let start = 0; start < fresh.length; start += INSERT_CHUNK) {
        const chunk = fresh.slice(start, start + INSERT_CHUNK);
        const returned = await this.db
          .insert(transactions)
          .values(chunk)
          .onConflictDoNothing({ target: transactions.fingerprint })
          .returning({ id: transactions.id });
        inserted += returned.length;
      }
    } catch (error) {
      throw new ServiceUnavailableException(
        {
          message: `Import interrupted mid-batch: ${inserted} of ${fresh.length} rows were inserted before the failure. The inserted rows are kept; re-run the import to retry the remaining rows.`,
          code: 'PARTIAL_IMPORT',
        },
        { cause: error },
      );
    }
    const raceDuplicates = fresh.length - inserted;
    needsReview -=
      raceDuplicates > 0 ? Math.min(raceDuplicates, needsReview) : 0;

    return {
      inserted,
      duplicates: duplicateCount + raceDuplicates,
      skipped,
      needsReview,
      totalRows: dataRows.length,
    };
  }

  private resolveMapping(
    dto: CsvImportDto,
    rows: string[][],
  ): {
    mapping: ColumnMapping;
    hasHeader: boolean;
    columnCount: number;
  } {
    const columnCount = rows[0].length;
    const mapping: ColumnMapping = {
      date: dto.mapping.date,
      merchant: dto.mapping.merchant,
      amount: dto.mapping.amount ?? null,
      debit: dto.mapping.debit ?? null,
      credit: dto.mapping.credit ?? null,
      category: dto.mapping.category ?? null,
      account: dto.mapping.account ?? null,
      notes: dto.mapping.notes ?? null,
    };

    const hasAmountColumn =
      mapping.amount !== null && mapping.amount !== undefined;
    const hasDebitColumn =
      mapping.debit !== null && mapping.debit !== undefined;
    const hasCreditColumn =
      mapping.credit !== null && mapping.credit !== undefined;
    const hasSplit = hasDebitColumn || hasCreditColumn;

    if (hasAmountColumn && hasSplit) {
      throw new BadRequestException({
        message:
          'Map either a single amount column or debit/credit columns, not both.',
        code: 'INVALID_MAPPING',
      });
    }
    if (!hasAmountColumn && !hasSplit) {
      throw new BadRequestException({
        message: 'An amount, debit, or credit column is required.',
        code: 'INVALID_MAPPING',
      });
    }

    const indices = [
      mapping.date,
      mapping.merchant,
      mapping.amount,
      mapping.debit,
      mapping.credit,
      mapping.category,
      mapping.account,
      mapping.notes,
    ].filter((index): index is number => index !== null && index !== undefined);

    const invalid = indices.find((index) => index >= columnCount);
    if (invalid !== undefined) {
      throw new BadRequestException({
        message: `Column index ${invalid} is out of range for a CSV with ${columnCount} columns.`,
        code: 'INVALID_MAPPING',
      });
    }

    const hasHeader = dto.mapping.hasHeader ?? true;
    return { mapping, hasHeader, columnCount };
  }

  private parseRow(
    row: string[],
    mapping: ColumnMapping,
    signConvention: SignConvention,
    categoryMap: Map<string, string>,
    accountMap: Map<string, string>,
  ): ParsedRow | null {
    const merchant = (row[mapping.merchant] ?? '').trim();
    if (merchant.length === 0) {
      return null;
    }

    const date = normalizeDate(row[mapping.date] ?? '');
    if (date === null) {
      return null;
    }

    const resolved = this.resolveAmount(row, mapping, signConvention);
    if (resolved === null) {
      return null;
    }

    const rawCategory =
      mapping.category === null ? '' : (row[mapping.category] ?? '').trim();
    const category =
      rawCategory.length > 0
        ? (categoryMap.get(rawCategory.toLowerCase()) ?? 'Needs review')
        : 'Needs review';

    const rawAccount =
      mapping.account === null ? '' : (row[mapping.account] ?? '').trim();
    const account =
      rawAccount.length > 0
        ? (accountMap.get(rawAccount.toLowerCase()) ?? rawAccount)
        : 'Imported account';

    const rawNotes =
      mapping.notes === null ? '' : (row[mapping.notes] ?? '').trim();
    const notes = rawNotes.length > 0 ? rawNotes : null;

    const fingerprint = computeFingerprint({
      type: resolved.type,
      date,
      merchant,
      amount: resolved.amount,
    });

    return {
      date,
      merchant,
      category,
      account,
      notes,
      amount: resolved.amount,
      type: resolved.type,
      fingerprint,
    };
  }

  private resolveAmount(
    row: string[],
    mapping: ColumnMapping,
    signConvention: SignConvention,
  ): { amount: number; type: 'expense' | 'income' } | null {
    if (mapping.amount !== null && mapping.amount !== undefined) {
      const value = parseAmount(row[mapping.amount] ?? '');
      if (value === null || value === 0) {
        return null;
      }
      const isNegative = value < 0;
      const expenseMeansNegative = signConvention === 'negative-expense';
      const type = isNegative === expenseMeansNegative ? 'expense' : 'income';
      return { amount: Math.round(Math.abs(value) * 100) / 100, type };
    }

    const debitValue =
      mapping.debit !== null && mapping.debit !== undefined
        ? parseAmount(row[mapping.debit] ?? '')
        : null;
    const creditValue =
      mapping.credit !== null && mapping.credit !== undefined
        ? parseAmount(row[mapping.credit] ?? '')
        : null;

    const hasDebit = debitValue !== null && debitValue !== 0;
    const hasCredit = creditValue !== null && creditValue !== 0;
    if (hasDebit && hasCredit) {
      return null;
    }
    if (hasDebit) {
      return {
        amount: Math.round(Math.abs(debitValue) * 100) / 100,
        type: 'expense',
      };
    }
    if (hasCredit) {
      return {
        amount: Math.round(Math.abs(creditValue) * 100) / 100,
        type: 'income',
      };
    }
    return null;
  }

  private async findExistingFingerprints(
    fingerprints: string[],
  ): Promise<Set<string>> {
    const found = new Set<string>();
    for (let start = 0; start < fingerprints.length; start += LOOKUP_CHUNK) {
      const chunk = fingerprints.slice(start, start + LOOKUP_CHUNK);
      const rows = await this.db
        .select({ fingerprint: transactions.fingerprint })
        .from(transactions)
        .where(inArray(transactions.fingerprint, chunk));
      for (const row of rows) {
        found.add(row.fingerprint);
      }
    }
    return found;
  }

  private async categoryLookup(): Promise<Map<string, string>> {
    const rows = await this.db
      .select({ name: categories.name })
      .from(categories);
    return new Map(rows.map((row) => [row.name.toLowerCase(), row.name]));
  }

  private async accountLookup(): Promise<Map<string, string>> {
    const rows = await this.db.select({ name: accounts.name }).from(accounts);
    return new Map(rows.map((row) => [row.name.toLowerCase(), row.name]));
  }
}
