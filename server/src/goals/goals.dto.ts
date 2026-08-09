import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { IsIsoDate } from '../common/validators/iso-date';

export class CreateGoalDto {
  @IsString()
  @IsNotEmpty({ message: 'Name is required.' })
  name: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01, { message: 'Target amount must be a positive number.' })
  @Max(100_000_000, { message: 'Target amount is too large.' })
  targetAmount: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100_000_000)
  currentAmount?: number;

  @IsOptional()
  @IsIsoDate()
  dueDate?: string;

  @IsOptional()
  @IsString()
  note?: string;
}

export class UpdateGoalDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01, { message: 'Target amount must be a positive number.' })
  @Max(100_000_000, { message: 'Target amount is too large.' })
  targetAmount?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100_000_000)
  currentAmount?: number;

  @IsOptional()
  @IsIsoDate()
  dueDate?: string;

  @IsOptional()
  @IsString()
  note?: string;
}
