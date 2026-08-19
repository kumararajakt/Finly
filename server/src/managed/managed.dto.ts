import { Transform, type TransformFnParams } from 'class-transformer';
import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import type { AccountType } from '../database/schema';

export class NameDto {
  @Transform(({ value }: TransformFnParams) => {
    if (typeof value === 'string') {
      return value.trim();
    }
    return value as unknown;
  })
  @IsString()
  @IsNotEmpty({ message: 'Name is required.' })
  @MaxLength(100, { message: 'Name must be 100 characters or fewer.' })
  name: string;
}

export class AccountDto {
  @Transform(({ value }: TransformFnParams) => {
    if (typeof value === 'string') {
      return value.trim();
    }
    return value as unknown;
  })
  @IsString()
  @IsNotEmpty({ message: 'Name is required.' })
  @MaxLength(100, { message: 'Name must be 100 characters or fewer.' })
  name: string;

  @IsOptional()
  @IsIn(['cash', 'credit', 'investment'])
  type?: AccountType;
}
