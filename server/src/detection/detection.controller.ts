import { Body, Controller, Get, Post } from '@nestjs/common';
import { SuggestionKeyDto } from './detection.dto';
import { DetectionService } from './detection.service';
import type { DetectionSuggestion } from './detection.types';

@Controller('detection')
export class DetectionController {
  constructor(private readonly detectionService: DetectionService) {}

  @Get('suggestions')
  getSuggestions(): Promise<DetectionSuggestion[]> {
    return this.detectionService.getSuggestions();
  }

  @Post('keep')
  keep(@Body() body: SuggestionKeyDto) {
    return this.detectionService.keep(body.key);
  }

  @Post('ignore')
  ignore(@Body() body: SuggestionKeyDto) {
    return this.detectionService.ignore(body.key);
  }
}
