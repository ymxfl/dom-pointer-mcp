import { t, setLocale, getLocale } from '../../i18n';

describe('i18n', () => {
  beforeEach(() => {
    setLocale('zh');
  });

  it('defaults to zh locale', () => {
    expect(getLocale()).toBe('zh');
  });

  it('returns Chinese text for zh locale', () => {
    expect(t('popup.save')).toBe('保存设置');
  });

  it('returns English text for en locale', () => {
    setLocale('en');
    expect(t('popup.save')).toBe('Save Settings');
  });

  it('interpolates params', () => {
    expect(t('popup.serverReachable', { port: 7007 })).toBe('端口 7007 可达');
  });

  it('interpolates params in English', () => {
    setLocale('en');
    expect(t('popup.serverReachable', { port: 8080 })).toBe('Reachable on port 8080');
  });

  it('returns key as fallback for unknown key', () => {
    expect(t('nonexistent.key' as any)).toBe('nonexistent.key');
  });

  it('setLocale switches language', () => {
    setLocale('en');
    expect(getLocale()).toBe('en');
    expect(t('popup.title')).toBe('DOM Pointer MCP Settings');
  });
});
