import {
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { IsIsoDate } from '../common/validators/iso-date';

export class CreateTradeDto {
  @IsUUID()
  accountId: string;

  @IsIsoDate()
  date: string;

  @IsString()
  @IsNotEmpty({ message: 'Security name is required.' })
  security: string;

  @IsIn(['buy', 'sell', 'dividend', 'interest'])
  side: 'buy' | 'sell' | 'dividend' | 'interest';

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0.0001, { message: 'Units must be positive.' })
  units: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0.0001, { message: 'Price must be positive.' })
  price: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100_000_000)
  fee?: number;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  notes?: string;
}

export class TradeQueryDto {
  @IsOptional()
  @IsUUID()
  accountId?: string;

  @IsOptional()
  @IsString()
  security?: string;
}

export class PositionQueryDto {
  @IsOptional()
  @IsUUID()
  accountId?: string;
}

export class QuoteQueryDto {
  @IsString()
  @IsNotEmpty()
  q: string;
}

export class UpdateSecurityDto {
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  currentPrice: number;
}
