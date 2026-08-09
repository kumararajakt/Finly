import {
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';

export class BudgetSpendingQueryDto {
  @Matches(/^\d{4}-\d{2}$/, {
    message: 'Month must be in YYYY-MM format.',
  })
  month: string;
}

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
