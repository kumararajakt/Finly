import { Body, Controller, Get, Post } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { SuggestionKeyDto } from './detection.dto';
import { DetectionService } from './detection.service';
import type { DetectionSuggestion } from './detection.types';

@Controller('detection')
export class DetectionController {
  constructor(private readonly detectionService: DetectionService) {}

  @Get('suggestions')
  getSuggestions(
    @CurrentUser() userId: string,
  ): Promise<DetectionSuggestion[]> {
    return this.detectionService.getSuggestions(userId);
  }

  @Post('keep')
  keep(@CurrentUser() userId: string, @Body() body: SuggestionKeyDto) {
    return this.detectionService.keep(userId, body.key);
  }

  @Post('ignore')
  ignore(@CurrentUser() userId: string, @Body() body: SuggestionKeyDto) {
    return this.detectionService.ignore(userId, body.key);
  }
}
