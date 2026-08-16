import type { Density, Period, Settings } from './settings.types';

export const PERIODS: Period[] = [
  'all-time',
  'this-month',
  'last-month',
  'last-3-months',
  'last-6-months',
  'this-year',
  'custom',
];

export const DENSITIES: Density[] = [
  'compact',
  'cozy',
  'comfortable',
  'roomy',
  'spacious',
];

type SettingType =
  | 'string'
  | 'boolean'
  | 'number'
  | 'stringArray'
  | 'nullableString'
  | 'nullableObject';

interface SettingDef {
  type: SettingType;
  default: unknown;
}

export const SETTING_DEFS: Record<keyof Settings, SettingDef> = {
  selectedPeriod: { type: 'string', default: 'all-time' },
  customDateFrom: { type: 'nullableString', default: null },
  customDateTo: { type: 'nullableString', default: null },
  netWorthConfigured: { type: 'boolean', default: false },
  totalAssets: { type: 'number', default: 0 },
  totalLiabilities: { type: 'number', default: 0 },
  currency: { type: 'string', default: 'USD' },
  density: { type: 'string', default: 'comfortable' },
  dismissedPatterns: { type: 'stringArray', default: [] },
  googleDriveFolderName: { type: 'nullableString', default: null },
  googleDriveFolderId: { type: 'nullableString', default: null },
  googleDriveSchedule: { type: 'nullableString', default: null },
  googleDriveLastSync: { type: 'nullableString', default: null },
  googleDriveLastResult: { type: 'nullableObject', default: null },
};

export const SETTING_KEYS = Object.keys(SETTING_DEFS) as (keyof Settings)[];

function isJsonString(value: string): boolean {
  return value === 'null' || value === '[]' || value === '{}';
}

export function serializeSetting(key: keyof Settings, value: unknown): string {
  const def = SETTING_DEFS[key];
  switch (def.type) {
    case 'boolean':
      return value ? 'true' : 'false';
    case 'number':
      return String(value);
    case 'string':
      return String(value);
    case 'stringArray':
      return JSON.stringify(value);
    case 'nullableString': {
      if (value === null || value === undefined) {
        return 'null';
      }
      return value as string;
    }
    case 'nullableObject':
      return value === null || value === undefined
        ? 'null'
        : JSON.stringify(value);
  }
}

export function parseSetting(key: keyof Settings, raw: string): unknown {
  const def = SETTING_DEFS[key];
  switch (def.type) {
    case 'boolean':
      return raw === 'true';
    case 'number': {
      const num = Number(raw);
      return Number.isFinite(num) ? num : def.default;
    }
    case 'string':
      return raw;
    case 'stringArray': {
      if (!raw || raw === 'null') {
        return def.default;
      }
      try {
        const parsed = JSON.parse(raw) as unknown;
        return Array.isArray(parsed) ? parsed : def.default;
      } catch {
        return def.default;
      }
    }
    case 'nullableString':
      return raw === 'null' || raw === '' ? null : raw;
    case 'nullableObject': {
      if (!raw || raw === 'null' || raw === '') {
        return null;
      }
      try {
        if (!isJsonString(raw)) {
          return JSON.parse(raw) as unknown;
        }
        return JSON.parse(raw) as unknown;
      } catch {
        return null;
      }
    }
  }
}

function isIsoDate(value: unknown): boolean {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function validateSetting(key: keyof Settings, value: unknown): boolean {
  const def = SETTING_DEFS[key];
  switch (def.type) {
    case 'string':
      if (key === 'selectedPeriod') {
        return typeof value === 'string' && PERIODS.includes(value as Period);
      }
      if (key === 'density') {
        return (
          typeof value === 'string' && DENSITIES.includes(value as Density)
        );
      }
      return typeof value === 'string' && value.length > 0;
    case 'boolean':
      return typeof value === 'boolean';
    case 'number':
      return typeof value === 'number' && Number.isFinite(value) && value >= 0;
    case 'stringArray':
      return (
        Array.isArray(value) && value.every((item) => typeof item === 'string')
      );
    case 'nullableString':
      if (key === 'customDateFrom' || key === 'customDateTo') {
        return value === null || value === undefined || isIsoDate(value);
      }
      return value === null || value === undefined || typeof value === 'string';
    case 'nullableObject':
      return (
        value === null ||
        value === undefined ||
        (typeof value === 'object' && !Array.isArray(value))
      );
  }
}
