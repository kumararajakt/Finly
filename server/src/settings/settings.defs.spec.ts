import {
  parseSetting,
  serializeSetting,
  SETTING_KEYS,
  validateSetting,
} from './settings.defs';

describe('settings.defs', () => {
  it('exposes every Settings key', () => {
    expect(SETTING_KEYS).toContain('selectedPeriod');
    expect(SETTING_KEYS).toContain('netWorthConfigured');
    expect(SETTING_KEYS).toContain('totalAssets');
    expect(SETTING_KEYS).toContain('totalLiabilities');
    expect(SETTING_KEYS).toContain('currency');
    expect(SETTING_KEYS).toContain('dismissedPatterns');
    expect(SETTING_KEYS).toContain('googleDriveFolderName');
    expect(SETTING_KEYS).toContain('googleDriveFolderId');
    expect(SETTING_KEYS).toContain('googleDriveSchedule');
    expect(SETTING_KEYS).toContain('googleDriveLastSync');
    expect(SETTING_KEYS).toContain('googleDriveLastResult');
  });

  describe('serializeSetting / parseSetting', () => {
    it('round-trips booleans', () => {
      expect(serializeSetting('netWorthConfigured', true)).toBe('true');
      expect(parseSetting('netWorthConfigured', 'true')).toBe(true);
      expect(parseSetting('netWorthConfigured', 'false')).toBe(false);
    });

    it('round-trips numbers', () => {
      expect(serializeSetting('totalAssets', 1234.5)).toBe('1234.5');
      expect(parseSetting('totalAssets', '1234.5')).toBe(1234.5);
    });

    it('round-trips strings', () => {
      expect(serializeSetting('selectedPeriod', 'this-month')).toBe(
        'this-month',
      );
      expect(parseSetting('selectedPeriod', 'this-month')).toBe('this-month');
    });

    it('round-trips string arrays', () => {
      expect(serializeSetting('dismissedPatterns', ['a', 'b'])).toBe(
        '["a","b"]',
      );
      expect(parseSetting('dismissedPatterns', '["a","b"]')).toEqual([
        'a',
        'b',
      ]);
    });

    it('parses nullable strings to null', () => {
      expect(parseSetting('googleDriveFolderName', 'null')).toBeNull();
      expect(parseSetting('googleDriveFolderName', 'Drive')).toBe('Drive');
    });

    it('parses nullable objects to null', () => {
      expect(parseSetting('googleDriveLastResult', 'null')).toBeNull();
      expect(parseSetting('googleDriveLastResult', '{"inserted":1}')).toEqual({
        inserted: 1,
      });
    });

    it('falls back to defaults on malformed JSON', () => {
      expect(parseSetting('dismissedPatterns', '{bad json')).toEqual([]);
      expect(parseSetting('googleDriveLastResult', '{bad json')).toBeNull();
    });
  });

  describe('validateSetting', () => {
    it('accepts valid values', () => {
      expect(validateSetting('selectedPeriod', 'this-month')).toBe(true);
      expect(validateSetting('netWorthConfigured', false)).toBe(true);
      expect(validateSetting('totalAssets', 0)).toBe(true);
      expect(validateSetting('dismissedPatterns', [])).toBe(true);
      expect(validateSetting('googleDriveFolderName', null)).toBe(true);
    });

    it('rejects invalid values', () => {
      expect(validateSetting('selectedPeriod', 'next-week')).toBe(false);
      expect(validateSetting('netWorthConfigured', 'true')).toBe(false);
      expect(validateSetting('totalAssets', -5)).toBe(false);
      expect(validateSetting('totalAssets', '10')).toBe(false);
      expect(validateSetting('dismissedPatterns', 'a')).toBe(false);
      expect(validateSetting('dismissedPatterns', [1, 2])).toBe(false);
    });
  });
});
