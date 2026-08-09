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
import type { Recurring } from '../database/schema';
import { CreateRecurringDto, UpdateRecurringDto } from './recurring.dto';
import { RecurringService } from './recurring.service';

@Controller('recurring')
export class RecurringController {
  constructor(private readonly recurringService: RecurringService) {}

  @Get()
  list(): Promise<Recurring[]> {
    return this.recurringService.list();
  }

  @Post()
  create(@Body() body: CreateRecurringDto): Promise<Recurring> {
    return this.recurringService.create(body);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() body: UpdateRecurringDto,
  ): Promise<Recurring> {
    return this.recurringService.update(id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id') id: string): Promise<void> {
    await this.recurringService.remove(id);
  }
}
