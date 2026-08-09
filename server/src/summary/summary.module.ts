import { Module } from '@nestjs/common';
import { SettingsModule } from '../settings/settings.module';
import { SummaryController } from './summary.controller';
import { SummaryService } from './summary.service';

@Module({
  imports: [SettingsModule],
  controllers: [SummaryController],
  providers: [SummaryService],
})
export class SummaryModule {}
