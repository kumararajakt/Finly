import { Controller, Get, Query } from '@nestjs/common';
import { SummaryQueryDto } from './summary.dto';
import { SummaryService } from './summary.service';

@Controller('summary')
export class SummaryController {
  constructor(private readonly summaryService: SummaryService) {}

  @Get()
  getSummary(@Query() query: SummaryQueryDto) {
    return this.summaryService.getSummary(query.period);
  }
}
