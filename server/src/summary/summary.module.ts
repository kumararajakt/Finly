import { Module } from '@nestjs/common';
import { DetectionModule } from '../detection/detection.module';
import { SettingsModule } from '../settings/settings.module';
import { SummaryController } from './summary.controller';
import { SummaryService } from './summary.service';

@Module({
  imports: [SettingsModule, DetectionModule],
  controllers: [SummaryController],
  providers: [SummaryService],
})
export class SummaryModule {}
