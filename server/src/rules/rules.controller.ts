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
import type { Rule } from '../database/schema';
import { CurrentUser } from '../auth/current-user.decorator';
import { CreateRuleDto, UpdateRuleDto } from './rules.dto';
import { RulesService } from './rules.service';

@Controller('rules')
export class RulesController {
  constructor(private readonly rulesService: RulesService) {}

  @Get()
  list(@CurrentUser() userId: string): Promise<Rule[]> {
    return this.rulesService.list(userId);
  }

  @Post()
  create(
    @CurrentUser() userId: string,
    @Body() body: CreateRuleDto,
  ): Promise<Rule> {
    return this.rulesService.create(userId, body);
  }

  @Patch(':id')
  update(
    @CurrentUser() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateRuleDto,
  ): Promise<Rule> {
    return this.rulesService.update(userId, id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(
    @CurrentUser() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.rulesService.remove(userId, id);
  }
}
