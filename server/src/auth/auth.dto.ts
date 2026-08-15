import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { COUNTRY_CODES } from '../countries/countries';

export class SocialSignInDto {
  @IsIn(['google', 'github'], { message: 'Unsupported provider.' })
  provider: 'google' | 'github';

  @IsString()
  @IsNotEmpty({ message: 'A callback URL is required.' })
  callbackURL: string;
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

  @IsOptional()
  @IsIn(COUNTRY_CODES, { message: 'Unsupported country.' })
  country?: string | null;

  @IsOptional()
  @IsBoolean()
  onboardingComplete?: boolean;
}
