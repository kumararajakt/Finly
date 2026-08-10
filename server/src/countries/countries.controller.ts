import { Controller, Get } from '@nestjs/common';
import { COUNTRIES, type Country } from './countries';

@Controller('countries')
export class CountriesController {
  @Get()
  list(): Country[] {
    return COUNTRIES;
  }
}
