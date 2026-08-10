export interface Country {
  code: string;
  name: string;
  currency: string;
  timeZone: string;
}

export const COUNTRIES: Country[] = [
  {
    code: 'AE',
    name: 'United Arab Emirates',
    currency: 'AED',
    timeZone: 'Asia/Dubai',
  },
  {
    code: 'AR',
    name: 'Argentina',
    currency: 'ARS',
    timeZone: 'America/Argentina/Buenos_Aires',
  },
  { code: 'AT', name: 'Austria', currency: 'EUR', timeZone: 'Europe/Vienna' },
  {
    code: 'AU',
    name: 'Australia',
    currency: 'AUD',
    timeZone: 'Australia/Sydney',
  },
  { code: 'BE', name: 'Belgium', currency: 'EUR', timeZone: 'Europe/Brussels' },
  { code: 'BG', name: 'Bulgaria', currency: 'BGN', timeZone: 'Europe/Sofia' },
  { code: 'BO', name: 'Bolivia', currency: 'BOB', timeZone: 'America/La_Paz' },
  {
    code: 'BR',
    name: 'Brazil',
    currency: 'BRL',
    timeZone: 'America/Sao_Paulo',
  },
  { code: 'CA', name: 'Canada', currency: 'CAD', timeZone: 'America/Toronto' },
  {
    code: 'CH',
    name: 'Switzerland',
    currency: 'CHF',
    timeZone: 'Europe/Zurich',
  },
  { code: 'CL', name: 'Chile', currency: 'CLP', timeZone: 'America/Santiago' },
  { code: 'CN', name: 'China', currency: 'CNY', timeZone: 'Asia/Shanghai' },
  { code: 'CO', name: 'Colombia', currency: 'COP', timeZone: 'America/Bogota' },
  {
    code: 'CR',
    name: 'Costa Rica',
    currency: 'CRC',
    timeZone: 'America/Costa_Rica',
  },
  { code: 'CZ', name: 'Czechia', currency: 'CZK', timeZone: 'Europe/Prague' },
  { code: 'DE', name: 'Germany', currency: 'EUR', timeZone: 'Europe/Berlin' },
  {
    code: 'DK',
    name: 'Denmark',
    currency: 'DKK',
    timeZone: 'Europe/Copenhagen',
  },
  {
    code: 'DO',
    name: 'Dominican Republic',
    currency: 'DOP',
    timeZone: 'America/Santo_Domingo',
  },
  {
    code: 'EC',
    name: 'Ecuador',
    currency: 'USD',
    timeZone: 'America/Guayaquil',
  },
  { code: 'EE', name: 'Estonia', currency: 'EUR', timeZone: 'Europe/Tallinn' },
  { code: 'EG', name: 'Egypt', currency: 'EGP', timeZone: 'Africa/Cairo' },
  { code: 'ES', name: 'Spain', currency: 'EUR', timeZone: 'Europe/Madrid' },
  {
    code: 'ET',
    name: 'Ethiopia',
    currency: 'ETB',
    timeZone: 'Africa/Addis_Ababa',
  },
  { code: 'FI', name: 'Finland', currency: 'EUR', timeZone: 'Europe/Helsinki' },
  { code: 'FJ', name: 'Fiji', currency: 'FJD', timeZone: 'Pacific/Fiji' },
  { code: 'FR', name: 'France', currency: 'EUR', timeZone: 'Europe/Paris' },
  {
    code: 'GB',
    name: 'United Kingdom',
    currency: 'GBP',
    timeZone: 'Europe/London',
  },
  { code: 'GH', name: 'Ghana', currency: 'GHS', timeZone: 'Africa/Accra' },
  { code: 'GR', name: 'Greece', currency: 'EUR', timeZone: 'Europe/Athens' },
  {
    code: 'GT',
    name: 'Guatemala',
    currency: 'GTQ',
    timeZone: 'America/Guatemala',
  },
  {
    code: 'HK',
    name: 'Hong Kong',
    currency: 'HKD',
    timeZone: 'Asia/Hong_Kong',
  },
  { code: 'HR', name: 'Croatia', currency: 'EUR', timeZone: 'Europe/Zagreb' },
  { code: 'HU', name: 'Hungary', currency: 'HUF', timeZone: 'Europe/Budapest' },
  { code: 'ID', name: 'Indonesia', currency: 'IDR', timeZone: 'Asia/Jakarta' },
  { code: 'IE', name: 'Ireland', currency: 'EUR', timeZone: 'Europe/Dublin' },
  { code: 'IL', name: 'Israel', currency: 'ILS', timeZone: 'Asia/Jerusalem' },
  { code: 'IN', name: 'India', currency: 'INR', timeZone: 'Asia/Kolkata' },
  {
    code: 'IS',
    name: 'Iceland',
    currency: 'ISK',
    timeZone: 'Atlantic/Reykjavik',
  },
  { code: 'IT', name: 'Italy', currency: 'EUR', timeZone: 'Europe/Rome' },
  { code: 'JP', name: 'Japan', currency: 'JPY', timeZone: 'Asia/Tokyo' },
  { code: 'KE', name: 'Kenya', currency: 'KES', timeZone: 'Africa/Nairobi' },
  { code: 'KR', name: 'South Korea', currency: 'KRW', timeZone: 'Asia/Seoul' },
  { code: 'KW', name: 'Kuwait', currency: 'KWD', timeZone: 'Asia/Kuwait' },
  { code: 'LK', name: 'Sri Lanka', currency: 'LKR', timeZone: 'Asia/Colombo' },
  {
    code: 'LT',
    name: 'Lithuania',
    currency: 'EUR',
    timeZone: 'Europe/Vilnius',
  },
  {
    code: 'LU',
    name: 'Luxembourg',
    currency: 'EUR',
    timeZone: 'Europe/Luxembourg',
  },
  { code: 'LV', name: 'Latvia', currency: 'EUR', timeZone: 'Europe/Riga' },
  {
    code: 'MA',
    name: 'Morocco',
    currency: 'MAD',
    timeZone: 'Africa/Casablanca',
  },
  {
    code: 'MX',
    name: 'Mexico',
    currency: 'MXN',
    timeZone: 'America/Mexico_City',
  },
  {
    code: 'MY',
    name: 'Malaysia',
    currency: 'MYR',
    timeZone: 'Asia/Kuala_Lumpur',
  },
  { code: 'NG', name: 'Nigeria', currency: 'NGN', timeZone: 'Africa/Lagos' },
  {
    code: 'NL',
    name: 'Netherlands',
    currency: 'EUR',
    timeZone: 'Europe/Amsterdam',
  },
  { code: 'NO', name: 'Norway', currency: 'NOK', timeZone: 'Europe/Oslo' },
  { code: 'NP', name: 'Nepal', currency: 'NPR', timeZone: 'Asia/Kathmandu' },
  {
    code: 'NZ',
    name: 'New Zealand',
    currency: 'NZD',
    timeZone: 'Pacific/Auckland',
  },
  { code: 'PA', name: 'Panama', currency: 'PAB', timeZone: 'America/Panama' },
  { code: 'PE', name: 'Peru', currency: 'PEN', timeZone: 'America/Lima' },
  { code: 'PH', name: 'Philippines', currency: 'PHP', timeZone: 'Asia/Manila' },
  { code: 'PK', name: 'Pakistan', currency: 'PKR', timeZone: 'Asia/Karachi' },
  { code: 'PL', name: 'Poland', currency: 'PLN', timeZone: 'Europe/Warsaw' },
  { code: 'PT', name: 'Portugal', currency: 'EUR', timeZone: 'Europe/Lisbon' },
  {
    code: 'PY',
    name: 'Paraguay',
    currency: 'PYG',
    timeZone: 'America/Asuncion',
  },
  { code: 'QA', name: 'Qatar', currency: 'QAR', timeZone: 'Asia/Qatar' },
  {
    code: 'RO',
    name: 'Romania',
    currency: 'RON',
    timeZone: 'Europe/Bucharest',
  },
  { code: 'RS', name: 'Serbia', currency: 'RSD', timeZone: 'Europe/Belgrade' },
  { code: 'RU', name: 'Russia', currency: 'RUB', timeZone: 'Europe/Moscow' },
  {
    code: 'SA',
    name: 'Saudi Arabia',
    currency: 'SAR',
    timeZone: 'Asia/Riyadh',
  },
  { code: 'SE', name: 'Sweden', currency: 'SEK', timeZone: 'Europe/Stockholm' },
  {
    code: 'SG',
    name: 'Singapore',
    currency: 'SGD',
    timeZone: 'Asia/Singapore',
  },
  {
    code: 'SI',
    name: 'Slovenia',
    currency: 'EUR',
    timeZone: 'Europe/Ljubljana',
  },
  {
    code: 'SK',
    name: 'Slovakia',
    currency: 'EUR',
    timeZone: 'Europe/Bratislava',
  },
  { code: 'TH', name: 'Thailand', currency: 'THB', timeZone: 'Asia/Bangkok' },
  { code: 'TR', name: 'Turkey', currency: 'TRY', timeZone: 'Europe/Istanbul' },
  { code: 'TW', name: 'Taiwan', currency: 'TWD', timeZone: 'Asia/Taipei' },
  {
    code: 'TZ',
    name: 'Tanzania',
    currency: 'TZS',
    timeZone: 'Africa/Dar_es_Salaam',
  },
  { code: 'UA', name: 'Ukraine', currency: 'UAH', timeZone: 'Europe/Kyiv' },
  {
    code: 'US',
    name: 'United States',
    currency: 'USD',
    timeZone: 'America/New_York',
  },
  {
    code: 'UY',
    name: 'Uruguay',
    currency: 'UYU',
    timeZone: 'America/Montevideo',
  },
  {
    code: 'VE',
    name: 'Venezuela',
    currency: 'VES',
    timeZone: 'America/Caracas',
  },
  {
    code: 'VN',
    name: 'Vietnam',
    currency: 'VND',
    timeZone: 'Asia/Ho_Chi_Minh',
  },
  {
    code: 'ZA',
    name: 'South Africa',
    currency: 'ZAR',
    timeZone: 'Africa/Johannesburg',
  },
];

export const COUNTRY_CODES: string[] = COUNTRIES.map((country) => country.code);

export function countryByCode(
  code: string | null | undefined,
): Country | undefined {
  if (!code) {
    return undefined;
  }
  return COUNTRIES.find((country) => country.code === code);
}

export function currencyForCountry(code: string): string {
  return countryByCode(code)?.currency ?? 'USD';
}

export function timeZoneForCountry(
  code: string | null | undefined,
): string | null {
  return countryByCode(code)?.timeZone ?? null;
}
