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
import { CreateRuleDto, UpdateRuleDto } from './rules.dto';
import { RulesService } from './rules.service';

@Controller('rules')
export class RulesController {
  constructor(private readonly rulesService: RulesService) {}

  @Get()
  list(): Promise<Rule[]> {
    return this.rulesService.list();
  }

  @Post()
  create(@Body() body: CreateRuleDto): Promise<Rule> {
    return this.rulesService.create(body);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateRuleDto,
  ): Promise<Rule> {
    return this.rulesService.update(id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.rulesService.remove(id);
  }
}
