import { Module } from '@nestjs/common';
import { SettingsModule } from '../settings/settings.module';
import { DetectionController } from './detection.controller';
import { DetectionService } from './detection.service';

@Module({
  imports: [SettingsModule],
  controllers: [DetectionController],
  providers: [DetectionService],
  exports: [DetectionService],
})
export class DetectionModule {}
