import { IsIn, IsOptional } from 'class-validator';
import { PERIODS } from '../settings/settings.defs';
import type { Period } from '../settings/settings.types';

export class SummaryQueryDto {
  @IsOptional()
  @IsIn(PERIODS, { message: 'Invalid period.' })
  period?: Period;
}
