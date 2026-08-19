import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import type { Trade } from '../database/schema';
import {
  CreateTradeDto,
  PositionQueryDto,
  QuoteQueryDto,
  TradeQueryDto,
  UpdateSecurityDto,
} from './investments.dto';
import { InvestmentsService, type InvestmentSummary, type Position } from './investments.service';

@Controller('investments')
export class InvestmentsController {
  constructor(private readonly investmentsService: InvestmentsService) {}

  @Post('trades')
  createTrade(
    @CurrentUser() userId: string,
    @Body() body: CreateTradeDto,
  ): Promise<Trade> {
    return this.investmentsService.createTrade(userId, body);
  }

  @Get('trades')
  listTrades(
    @CurrentUser() userId: string,
    @Query() query: TradeQueryDto,
  ): Promise<Trade[]> {
    return this.investmentsService.getTrades(userId, query);
  }

  @Get('positions')
  getPositions(
    @CurrentUser() userId: string,
    @Query() query: PositionQueryDto,
  ): Promise<Position[]> {
    return this.investmentsService.getPositions(userId, query);
  }

  @Get('summary')
  getSummary(
    @CurrentUser() userId: string,
    @Query('accountId') accountId?: string,
  ): Promise<InvestmentSummary> {
    return this.investmentsService.getSummary(userId, accountId);
  }

  @Get('quote')
  getQuote(
    @CurrentUser() userId: string,
    @Query() query: QuoteQueryDto,
  ): Promise<{ symbol: string; price: number; source: string }> {
    return this.investmentsService.getQuote(userId, query);
  }

  @Patch('securities/:name')
  updateSecurity(
    @CurrentUser() userId: string,
    @Param('name') name: string,
    @Body() body: UpdateSecurityDto,
  ): Promise<{ name: string; currentPrice: number }> {
    return this.investmentsService.updateSecurity(userId, name, body);
  }
}
