import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import type { TransactionType } from '../database/schema';
import type { Period } from '../settings/settings.types';
import { IsIsoDate } from '../common/validators/iso-date';

export const PERIOD_VALUES: Period[] = [
  'all-time',
  'this-month',
  'last-month',
  'last-3-months',
  'last-6-months',
  'this-year',
];

export class TransactionQueryDto {
  @IsOptional()
  @IsIn(PERIOD_VALUES)
  period?: Period;

  @IsOptional()
  @IsString()
  account?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  search?: string;
}

export class CreateTransactionDto {
  @IsIsoDate()
  date: string;

  @IsString()
  @IsNotEmpty({ message: 'Merchant is required.' })
  merchant: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  category?: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01, { message: 'Amount must be a positive number.' })
  @Max(100_000_000, { message: 'Amount is too large.' })
  amount: number;

  @IsIn(['expense', 'income'])
  type: TransactionType;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  account?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  tags?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(2000, { message: 'Notes must be at most 2000 characters.' })
  notes?: string;

  @IsOptional()
  @IsBoolean()
  receipt?: boolean;
}

export class UpdateTransactionDto {
  @IsOptional()
  @IsIsoDate()
  date?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  merchant?: string;

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
  @IsIn(['expense', 'income'])
  type?: TransactionType;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  account?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  tags?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(2000, { message: 'Notes must be at most 2000 characters.' })
  notes?: string;
}
