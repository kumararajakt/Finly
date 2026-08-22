import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import type { SignConvention } from './csv';

export class CsvPreviewDto {
  @IsString()
  @IsNotEmpty({ message: 'CSV content is required.' })
  csv: string;
}

export class ColumnMappingDto {
  @IsInt()
  @Min(0)
  date: number;

  @IsInt()
  @Min(0)
  merchant: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  amount?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  debit?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  credit?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  category?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  account?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  notes?: number;

  @IsOptional()
  @IsBoolean()
  hasHeader?: boolean;
}

export class CsvImportDto {
  @IsString()
  @IsNotEmpty({ message: 'CSV content is required.' })
  csv: string;

  @IsObject()
  @ValidateNested()
  @Type(() => ColumnMappingDto)
  mapping: ColumnMappingDto;

  @IsOptional()
  @IsIn(['negative-expense', 'negative-income'])
  signConvention?: SignConvention;
}

export class TradeColumnMappingDto {
  @IsInt()
  @Min(0)
  date: number;

  @IsInt()
  @Min(0)
  security: number;

  @IsInt()
  @Min(0)
  side: number;

  @IsInt()
  @Min(0)
  units: number;

  @IsInt()
  @Min(0)
  price: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  amount?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  fee?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  account?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  notes?: number;

  @IsOptional()
  @IsBoolean()
  hasHeader?: boolean;
}

export class TradeImportPreviewDto {
  @IsString()
  @IsNotEmpty({ message: 'CSV content is required.' })
  csv: string;
}

export class TradeImportDto {
  @IsString()
  @IsNotEmpty({ message: 'CSV content is required.' })
  csv: string;

  @IsObject()
  @ValidateNested()
  @Type(() => TradeColumnMappingDto)
  mapping: TradeColumnMappingDto;
}
