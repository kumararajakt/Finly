import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import type { Cadence } from '../database/schema';
import { IsIsoDate } from '../common/validators/iso-date';

export const CADENCE_VALUES: Cadence[] = [
  'weekly',
  'biweekly',
  'monthly',
  'quarterly',
  'annual',
];

export class CreateRecurringDto {
  @IsString()
  @IsNotEmpty({ message: 'Name is required.' })
  name: string;

  @IsString()
  @IsNotEmpty({ message: 'Category is required.' })
  category: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01, { message: 'Amount must be a positive number.' })
  @Max(100_000_000, { message: 'Amount is too large.' })
  amount: number;

  @IsIn(CADENCE_VALUES)
  cadence: Cadence;

  @IsIsoDate()
  nextDate: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  account?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class UpdateRecurringDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  category?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01, { message: 'Amount must be a positive number.' })
  @Max(100_000_000, { message: 'Amount is too large.' })
  amount?: number;

  @IsOptional()
  @IsIn(CADENCE_VALUES)
  cadence?: Cadence;

  @IsOptional()
  @IsIsoDate()
  nextDate?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  account?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
