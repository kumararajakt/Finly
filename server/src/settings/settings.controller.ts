import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { SettingsValueDto } from './settings.dto';
import { SettingsService } from './settings.service';
import type { Settings } from './settings.types';

@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  getAll(@CurrentUser() userId: string): Promise<Settings> {
    return this.settingsService.getAll(userId);
  }

  @Put(':key')
  setValue(
    @CurrentUser() userId: string,
    @Param('key') key: string,
    @Body() body: SettingsValueDto,
  ): Promise<Settings> {
    return this.settingsService.setValue(userId, key, body.value);
  }
}
