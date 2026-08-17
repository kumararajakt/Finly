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
import { Type } from 'class-transformer';
import type { TransactionType } from '../database/schema';
import { PERIODS } from '../settings/settings.defs';
import type { Period } from '../settings/settings.types';
import { IsIsoDate } from '../common/validators/iso-date';

export class TransactionQueryDto {
  @IsOptional()
  @IsIn(PERIODS)
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

  @IsOptional()
  @IsIn(['expense', 'income', 'transfer', 'investment'])
  type?: TransactionType;

  @IsOptional()
  @IsString()
  tag?: string;

  @IsOptional()
  @IsIsoDate()
  dateFrom?: string;

  @IsOptional()
  @IsIsoDate()
  dateTo?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  minAmount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  maxAmount?: number;

  @IsOptional()
  @IsIn(['true', 'false'])
  receipt?: string;
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

  @IsIn(['expense', 'income', 'transfer', 'investment'])
  type: TransactionType;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  fromAccount?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  toAccount?: string;

  @IsOptional()
  @IsIn(['buy', 'sell', 'dividend', 'interest'])
  side?: string;

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
  @IsIn(['expense', 'income', 'transfer', 'investment'])
  type?: TransactionType;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  fromAccount?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  toAccount?: string;

  @IsOptional()
  @IsIn(['buy', 'sell', 'dividend', 'interest'])
  side?: string;

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
