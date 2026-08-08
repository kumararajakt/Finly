import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(8, { message: 'Password must be at least 8 characters long.' })
  password: string;
}

export class LoginDto {
  @IsString()
  @IsNotEmpty({ message: 'Password is required.' })
  password: string;
}
