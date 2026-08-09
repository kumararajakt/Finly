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
import { CreateGoalDto, UpdateGoalDto } from './goals.dto';
import { GoalsService } from './goals.service';

@Controller('goals')
export class GoalsController {
  constructor(private readonly goalsService: GoalsService) {}

  @Get()
  list(): Promise<Goal[]> {
    return this.goalsService.list();
  }

  @Post()
  create(@Body() body: CreateGoalDto): Promise<Goal> {
    return this.goalsService.create(body);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateGoalDto,
  ): Promise<Goal> {
    return this.goalsService.update(id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.goalsService.remove(id);
  }
}
