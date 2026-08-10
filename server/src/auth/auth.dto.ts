import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @IsEmail({}, { message: 'A valid email address is required.' })
  email: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8, { message: 'Password must be at least 8 characters long.' })
  password: string;
}

export class LoginDto {
  @IsEmail({}, { message: 'A valid email address is required.' })
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'Password is required.' })
  password: string;
}

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @Matches(/\S/, { message: 'Name cannot be empty.' })
  @MaxLength(80, { message: 'Name must be at most 80 characters long.' })
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2_000_000, { message: 'Image is too large.' })
  image?: string | null;
}
