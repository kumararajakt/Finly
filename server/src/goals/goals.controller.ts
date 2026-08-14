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
import type { Goal } from '../database/schema';
import { CurrentUser } from '../auth/current-user.decorator';
import { CreateGoalDto, UpdateGoalDto } from './goals.dto';
import { GoalsService } from './goals.service';

@Controller('goals')
export class GoalsController {
  constructor(private readonly goalsService: GoalsService) {}

  @Get()
  list(@CurrentUser() userId: string): Promise<Goal[]> {
    return this.goalsService.list(userId);
  }

  @Post()
  create(
    @CurrentUser() userId: string,
    @Body() body: CreateGoalDto,
  ): Promise<Goal> {
    return this.goalsService.create(userId, body);
  }

  @Patch(':id')
  update(
    @CurrentUser() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateGoalDto,
  ): Promise<Goal> {
    return this.goalsService.update(userId, id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(
    @CurrentUser() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.goalsService.remove(userId, id);
  }
}
