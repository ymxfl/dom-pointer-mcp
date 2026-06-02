import { ModifierKey } from '../utils/config';
import { getModifierLabel } from '../utils/platform';
import logger from '../utils/logger';

interface KeyListenerRecord {
  target: string;
  eventType: string;
  useCapture: boolean;
}

const REGISTRY_KEY = '__domPointerMcp_keyListenerRegistry';
const ALL_MODIFIER_KEYS: ModifierKey[] = ['Alt', 'Ctrl', 'Meta'];

export interface ConflictResult {
  hasConflict: boolean;
  suggestedKey: ModifierKey | null;
  message: string | null;
}

function hasGlobalKeyListeners(): boolean {
  const registry = (window as any)[REGISTRY_KEY] as KeyListenerRecord[] | undefined;
  if (!registry || registry.length === 0) return false;

  return registry.some(
    (r) => (r.target === 'document' || r.target === 'window')
      && (r.eventType === 'keydown' || r.eventType === 'keyup'),
  );
}

export function detectConflict(currentKey: ModifierKey): ConflictResult {
  if (!hasGlobalKeyListeners()) {
    return { hasConflict: false, suggestedKey: null, message: null };
  }

  const suggested = ALL_MODIFIER_KEYS.find((k) => k !== currentKey) || null;
  const currentLabel = getModifierLabel(currentKey);
  const suggestedLabel = suggested ? getModifierLabel(suggested) : null;

  const message = suggestedLabel
    ? `${currentLabel} 键可能被当前页面占用，建议切换为 ${suggestedLabel}`
    : `${currentLabel} 键可能被当前页面占用`;

  logger.debug('🔍 Conflict detected:', { currentKey, suggested });

  return { hasConflict: true, suggestedKey: suggested, message };
}
