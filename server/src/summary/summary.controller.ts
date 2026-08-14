import { Controller, Get, Query } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { SummaryQueryDto } from './summary.dto';
import { SummaryService } from './summary.service';

@Controller('summary')
export class SummaryController {
  constructor(private readonly summaryService: SummaryService) {}

  @Get()
  getSummary(@CurrentUser() userId: string, @Query() query: SummaryQueryDto) {
    return this.summaryService.getSummary(userId, query.period);
  }
}
