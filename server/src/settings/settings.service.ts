import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DRIZZLE } from '../database/database.constants';
import type { Database } from '../database/database.module';
import { settings } from '../database/schema';
import {
  parseSetting,
  serializeSetting,
  SETTING_DEFS,
  SETTING_KEYS,
  validateSetting,
} from './settings.defs';
import type { Settings } from './settings.types';

@Injectable()
export class SettingsService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async getAll(): Promise<Settings> {
    const rows = await this.db.select().from(settings);
    const stored = new Map(rows.map((row) => [row.key, row.value]));

    const result = {} as Settings;
    const output = result as unknown as Record<string, unknown>;
    for (const key of SETTING_KEYS) {
      const raw = stored.get(key);
      output[key] =
        raw === undefined ? SETTING_DEFS[key].default : parseSetting(key, raw);
    }
    return result;
  }

  async setValue(key: string, value: unknown): Promise<Settings> {
    if (!SETTING_KEYS.includes(key as keyof Settings)) {
      throw new NotFoundException({
        message: `Unknown setting "${key}".`,
        code: 'UNKNOWN_SETTING',
      });
    }

    const settingKey = key as keyof Settings;
    if (!validateSetting(settingKey, value)) {
      throw new BadRequestException({
        message: `Invalid value for setting "${key}".`,
        code: 'INVALID_SETTING',
      });
    }

    await this.db
      .insert(settings)
      .values({ key: settingKey, value: serializeSetting(settingKey, value) })
      .onConflictDoUpdate({
        target: settings.key,
        set: { value: serializeSetting(settingKey, value) },
      });

    return this.getAll();
  }
}
