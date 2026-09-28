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
import {
  CreateTransactionDto,
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

  @Patch(':id')
  update(
    @CurrentUser() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateTransactionDto,
  ): Promise<Transaction> {
    return this.transactionsService.update(userId, id, body);
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
