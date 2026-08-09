import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import type { Budget } from '../database/schema';
import { CreateBudgetDto, UpdateBudgetDto } from './budgets.dto';
import { BudgetsService } from './budgets.service';

@Controller('budgets')
export class BudgetsController {
  constructor(private readonly budgetsService: BudgetsService) {}

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
    @Param('id') id: string,
    @Body() body: UpdateBudgetDto,
  ): Promise<Budget> {
    return this.budgetsService.update(id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id') id: string): Promise<void> {
    await this.budgetsService.remove(id);
  }
}
