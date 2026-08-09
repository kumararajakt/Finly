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
    @Query() query: BudgetSpendingQueryDto,
  ): Promise<Record<string, number>> {
    return this.budgetsService.spending(query.month);
  }

  @Get()
  list(): Promise<Budget[]> {
    return this.budgetsService.list();
  }

  @Post()
  create(@Body() body: CreateBudgetDto): Promise<Budget> {
    return this.budgetsService.create(body);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateBudgetDto,
  ): Promise<Budget> {
    return this.budgetsService.update(id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.budgetsService.remove(id);
  }
}
