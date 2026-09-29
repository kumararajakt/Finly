import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser } from '../auth/current-user.decorator';
import type { Transaction } from '../database/schema';
import { localDateISO } from '../summary/period';
import type { TransactionPeer } from './transactions.service';
import {
  CreateTransactionDto,
  BulkDeleteTransactionsDto,
  BulkUpdateCategoryDto,
  TransactionFacetsQueryDto,
  TransactionPeersQueryDto,
  TransactionQueryDto,
  UpdateTransactionDto,
} from './transactions.dto';
import { TransactionsService } from './transactions.service';

@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Get()
  list(
    @CurrentUser() userId: string,
    @Query() query: TransactionQueryDto,
  ): Promise<Transaction[]> {
    return this.transactionsService.list(userId, query);
  }

  /**
   * Facets for the client's category filter, so it only offers categories
   * that transactions in this period actually use. Also declared before any
   * `:id` route.
   */
  @Get('categories')
  categoriesInUse(
    @CurrentUser() userId: string,
    @Query() query: TransactionFacetsQueryDto,
  ): Promise<string[]> {
    return this.transactionsService.categoriesInUse(userId, query);
  }

  /**
   * Same-merchant transactions that are not already in the given category, for
   * the "change the rest of this merchant too?" prompt. A narrow projection —
   * the dialog only needs enough to list and count them.
   */
  @Get('peers')
  peers(
    @CurrentUser() userId: string,
    @Query() query: TransactionPeersQueryDto,
  ): Promise<TransactionPeer[]> {
    return this.transactionsService.peers(userId, query);
  }

  /**
   * Declared before any `:id` route so `export` is never read as an id. Returns
   * the file body directly rather than JSON, since it is a download.
   */
  @Get('export')
  @Header('Cache-Control', 'no-store')
  async exportCsv(
    @CurrentUser() userId: string,
    @Query() query: TransactionQueryDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<string> {
    const csv = await this.transactionsService.exportCsv(userId, query);
    res.set({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="transactions-${localDateISO(new Date())}.csv"`,
    });
    return csv;
  }

  @Post()
  create(
    @CurrentUser() userId: string,
    @Body() body: CreateTransactionDto,
  ): Promise<Transaction> {
    return this.transactionsService.create(userId, body);
  }

  /**
   * Bulk re-categorisation. Declared before `@Patch(':id')` for the same reason
   * the bulk delete is declared before `@Delete(':id')`, though a bare verb has
   * no route to collide with.
   */
  @Patch()
  updateCategory(
    @CurrentUser() userId: string,
    @Body() body: BulkUpdateCategoryDto,
  ): Promise<Transaction[]> {
    return this.transactionsService.updateCategory(userId, body);
  }

  @Patch(':id')
  update(
    @CurrentUser() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateTransactionDto,
  ): Promise<Transaction> {
    return this.transactionsService.update(userId, id, body);
  }

  @Delete()
  @HttpCode(204)
  async removeMany(
    @CurrentUser() userId: string,
    @Body() body: BulkDeleteTransactionsDto,
  ): Promise<void> {
    await this.transactionsService.removeMany(userId, body.ids);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(
    @CurrentUser() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.transactionsService.remove(userId, id);
  }
}
