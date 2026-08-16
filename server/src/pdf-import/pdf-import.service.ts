import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { stringify } from 'csv/sync';
import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';

export interface PdfExtractResult {
  headers: string[];
  rows: string[][];
  hasHeader: boolean;
  pageCount: number;
  filename: string;
}

export interface PdfToCsvResult {
  csv: string;
  filename: string;
  pageCount: number;
}

const MAX_PDF_BYTES = 20 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 30_000;

@Injectable()
export class PdfImportService {
  constructor(private readonly config: ConfigService) {}

  private get baseUrl(): string {
    return (
      this.config.get<string>('PDF_SERVICE_URL') ?? 'http://localhost:8000'
    );
  }

  async extractPdf(file: Express.Multer.File): Promise<PdfExtractResult> {
    if (!file || !file.buffer) {
      throw new BadRequestException({
        message: 'A PDF file is required.',
        code: 'PDF_UPLOAD_REQUIRED',
      });
    }
    if (file.size > MAX_PDF_BYTES) {
      throw new BadRequestException({
        message: 'The PDF is larger than 20 MB.',
        code: 'PDF_TOO_LARGE',
      });
    }

    const form = new FormData();
    form.append(
      'file',
      new Blob([new Uint8Array(file.buffer)], {
        type: file.mimetype || 'application/pdf',
      }),
      file.originalname,
    );

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/extract`, {
        method: 'POST',
        body: form,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      throw new ServiceUnavailableException(
        {
          message: `The PDF import service is unavailable. Start it with \`pnpm --filter pdf-service dev\` (${this.baseUrl}).`,
          code: 'PDF_SERVICE_UNAVAILABLE',
        },
        { cause: error },
      );
    }

    if (!response.ok) {
      let detail = `HTTP ${response.status}`;
      try {
        const data = (await response.json()) as { detail?: string };
        if (data.detail) detail = data.detail;
      } catch {
        // Non-JSON body; keep the status-based message.
      }
      throw new BadRequestException({
        message: `PDF extraction failed: ${detail}`,
        code:
          response.status === 413 ? 'PDF_TOO_LARGE' : 'PDF_EXTRACTION_FAILED',
      });
    }

    return (await response.json()) as PdfExtractResult;
  }

  toCsv(extracted: PdfExtractResult): PdfToCsvResult {
    const table = extracted.hasHeader
      ? [extracted.headers, ...extracted.rows]
      : extracted.rows;
    const csv = stringify(table, { quoted: false });
    return {
      csv,
      filename: extracted.filename,
      pageCount: extracted.pageCount,
    };
  }
}
