import { IsDefined } from 'class-validator';

export class SettingsValueDto {
  @IsDefined({ message: 'A value is required.' })
  value: unknown;
}
