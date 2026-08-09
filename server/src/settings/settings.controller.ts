import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { SettingsValueDto } from './settings.dto';
import { SettingsService } from './settings.service';
import type { Settings } from './settings.types';

@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  getAll(): Promise<Settings> {
    return this.settingsService.getAll();
  }

  @Put(':key')
  setValue(
    @Param('key') key: string,
    @Body() body: SettingsValueDto,
  ): Promise<Settings> {
    return this.settingsService.setValue(key, body.value);
  }
}
