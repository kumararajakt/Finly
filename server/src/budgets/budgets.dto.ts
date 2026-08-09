import {
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class CreateBudgetDto {
  @IsString()
  @IsNotEmpty({ message: 'Category is required.' })
  category: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01, { message: 'Monthly limit must be a positive number.' })
  @Max(100_000_000, { message: 'Monthly limit is too large.' })
  monthlyLimit: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class UpdateBudgetDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  category?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01, { message: 'Monthly limit must be a positive number.' })
  @Max(100_000_000, { message: 'Monthly limit is too large.' })
  monthlyLimit?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
