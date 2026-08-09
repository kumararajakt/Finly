import { IsNotEmpty, IsString } from 'class-validator';

export class SuggestionKeyDto {
  @IsString()
  @IsNotEmpty({ message: 'Suggestion key is required.' })
  key: string;
}
