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
} from '@nestjs/common';
import type { Recurring } from '../database/schema';
import { CurrentUser } from '../auth/current-user.decorator';
import { CreateRecurringDto, UpdateRecurringDto } from './recurring.dto';
import { RecurringService } from './recurring.service';

@Controller('recurring')
export class RecurringController {
  constructor(private readonly recurringService: RecurringService) {}

  @Get()
  list(@CurrentUser() userId: string): Promise<Recurring[]> {
    return this.recurringService.list(userId);
  }

  @Post()
  create(
    @CurrentUser() userId: string,
    @Body() body: CreateRecurringDto,
  ): Promise<Recurring> {
    return this.recurringService.create(userId, body);
  }

  @Patch(':id')
  update(
    @CurrentUser() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateRecurringDto,
  ): Promise<Recurring> {
    return this.recurringService.update(userId, id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(
    @CurrentUser() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.recurringService.remove(userId, id);
  }
}
