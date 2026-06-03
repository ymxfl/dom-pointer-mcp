import zh, { MessageKey } from './zh';
import en from './en';
import { Locale } from './types';

export type { Locale } from './types';
export type { MessageKey } from './zh';

const locales: Record<Locale, Record<MessageKey, string>> = { zh, en };
let currentLocale: Locale = 'zh';

export function setLocale(locale: Locale): void {
  currentLocale = locale;
}

export function getLocale(): Locale {
  return currentLocale;
}

export function t(key: MessageKey, params?: Record<string, string | number>): string {
  let msg: string = locales[currentLocale][key] ?? key;
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      msg = msg.replace(`{${k}}`, String(v));
    });
  }
  return msg;
}
