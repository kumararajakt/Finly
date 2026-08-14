import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import type { Budget } from '../database/schema';
import { CurrentUser } from '../auth/current-user.decorator';
import {
  BudgetSpendingQueryDto,
  CreateBudgetDto,
  UpdateBudgetDto,
} from './budgets.dto';
import { BudgetsService } from './budgets.service';

@Controller('budgets')
export class BudgetsController {
  constructor(private readonly budgetsService: BudgetsService) {}

  @Get('spending')
  spending(
    @CurrentUser() userId: string,
    @Query() query: BudgetSpendingQueryDto,
  ): Promise<Record<string, number>> {
    return this.budgetsService.spending(userId, query.month);
  }

  @Get()
  list(@CurrentUser() userId: string): Promise<Budget[]> {
    return this.budgetsService.list(userId);
  }

  @Post()
  create(
    @CurrentUser() userId: string,
    @Body() body: CreateBudgetDto,
  ): Promise<Budget> {
    return this.budgetsService.create(userId, body);
  }

  @Patch(':id')
  update(
    @CurrentUser() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateBudgetDto,
  ): Promise<Budget> {
    return this.budgetsService.update(userId, id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(
    @CurrentUser() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.budgetsService.remove(userId, id);
  }
}
