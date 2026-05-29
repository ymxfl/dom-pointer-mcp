import type { ComponentInfo } from '@dom-pointer-mcp/shared/types';
import {
  EXTRACT_REQUEST_EVENT,
  EXTRACT_RESPONSE_EVENT,
  EXTRACT_ID_ATTR,
  DEFAULT_TIMEOUT_MS,
  ExtractResponseDetail,
} from '../shared/bridge-events';

export async function requestComponentInfo(
  el: HTMLElement,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<ComponentInfo | undefined> {
  const requestId = crypto.randomUUID();
  el.setAttribute(EXTRACT_ID_ATTR, requestId);

  try {
    return await new Promise<ComponentInfo | undefined>((resolve) => {
      let timer: ReturnType<typeof setTimeout>;

      const listener = (e: Event) => {
        const { detail } = (e as CustomEvent<ExtractResponseDetail>);
        if (detail?.requestId !== requestId) return;
        window.removeEventListener(EXTRACT_RESPONSE_EVENT, listener);
        clearTimeout(timer);
        resolve(detail.componentInfo);
      };

      timer = setTimeout(() => {
        window.removeEventListener(EXTRACT_RESPONSE_EVENT, listener);
        resolve(undefined);
      }, timeoutMs);

      window.addEventListener(EXTRACT_RESPONSE_EVENT, listener);
      window.dispatchEvent(new CustomEvent(EXTRACT_REQUEST_EVENT, {
        detail: { requestId },
      }));
    });
  } finally {
    el.removeAttribute(EXTRACT_ID_ATTR);
  }
}
