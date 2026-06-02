import { ModifierKey } from './config';

export function isMac(): boolean {
  return navigator.platform.toUpperCase().includes('MAC');
}

const MAC_LABELS: Record<ModifierKey, string> = {
  Alt: 'Option（⌥）',
  Ctrl: 'Control（⌃）',
  Meta: 'Command（⌘）',
};

const OTHER_LABELS: Record<ModifierKey, string> = {
  Alt: 'Alt',
  Ctrl: 'Ctrl',
  Meta: 'Win',
};

export function getModifierLabel(key: ModifierKey): string {
  return isMac() ? MAC_LABELS[key] : OTHER_LABELS[key];
}
