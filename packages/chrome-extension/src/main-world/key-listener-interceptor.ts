export interface KeyListenerRecord {
  target: string;
  eventType: string;
  useCapture: boolean;
}

const TRACKED_EVENTS = new Set(['keydown', 'keyup', 'keypress']);
const REGISTRY_KEY = '__domPointerMcp_keyListenerRegistry';

export function installKeyListenerInterceptor(): void {
  const registry: KeyListenerRecord[] = [];
  const originalAddEventListener = EventTarget.prototype.addEventListener;

  EventTarget.prototype.addEventListener = function patchedAddEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | AddEventListenerOptions,
  ) {
    if (TRACKED_EVENTS.has(type) && listener) {
      let targetName: string;
      if (this === window) {
        targetName = 'window';
      } else if (this === document) {
        targetName = 'document';
      } else if (this === document.body) {
        targetName = 'body';
      } else {
        targetName = 'other';
      }

      const useCapture = typeof options === 'boolean'
        ? options
        : (options?.capture ?? false);

      registry.push({ target: targetName, eventType: type, useCapture });
    }

    return originalAddEventListener.call(this, type, listener, options);
  };

  Object.defineProperty(window, REGISTRY_KEY, {
    value: registry,
    writable: false,
    configurable: false,
    enumerable: false,
  });
}
