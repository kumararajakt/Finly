import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateRuleDto {
  @IsString()
  @IsNotEmpty({ message: 'When condition is required.' })
  whenText: string;

  @IsString()
  @IsNotEmpty({ message: 'Then action is required.' })
  thenText: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class UpdateRuleDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  whenText?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  thenText?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
