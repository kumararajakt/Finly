import { Transform, type TransformFnParams } from 'class-transformer';
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import type { AccountType } from '../database/schema';

function trimString({ value }: TransformFnParams): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export class NameDto {
  @Transform(trimString)
  @IsString()
  @IsNotEmpty({ message: 'Name is required.' })
  @MaxLength(100, { message: 'Name must be 100 characters or fewer.' })
  name: string;
}

/**
 * Body for `DELETE /categories/:id`. `moveTo` reassigns every record that
 * still points at the category before the category row is removed, so deleting
 * a category that is in use requires naming a replacement.
 */
export class DeleteCategoryDto {
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @IsNotEmpty({ message: 'Move to cannot be empty.' })
  @MaxLength(100, { message: 'Name must be 100 characters or fewer.' })
  moveTo?: string;
}

export class AccountDto {
  @Transform(trimString)
  @IsString()
  @IsNotEmpty({ message: 'Name is required.' })
  @MaxLength(100, { message: 'Name must be 100 characters or fewer.' })
  name: string;

  @IsOptional()
  @IsIn(['cash', 'credit', 'investment'])
  type?: AccountType;
}

export class UpdateAccountDto {
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @IsNotEmpty({ message: 'Name cannot be empty.' })
  @MaxLength(100, { message: 'Name must be 100 characters or fewer.' })
  name?: string;

  @IsOptional()
  @IsIn(['cash', 'credit', 'investment'])
  type?: AccountType;
}
