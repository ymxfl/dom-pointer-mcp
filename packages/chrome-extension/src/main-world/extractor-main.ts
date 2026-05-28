import {
  EXTRACT_REQUEST_EVENT,
  EXTRACT_RESPONSE_EVENT,
  EXTRACT_ID_ATTR,
  ExtractRequestDetail,
  ExtractResponseDetail,
} from '../shared/bridge-events';
import { extractComponentInfo } from '../extractors';

window.addEventListener(EXTRACT_REQUEST_EVENT, (e: Event) => {
  const detail = (e as CustomEvent<ExtractRequestDetail>).detail;
  if (!detail?.requestId) return;

  const el = document.querySelector(
    `[${EXTRACT_ID_ATTR}="${detail.requestId}"]`,
  );
  const componentInfo = el instanceof HTMLElement
    ? extractComponentInfo(el)
    : undefined;

  const responseDetail: ExtractResponseDetail = {
    requestId: detail.requestId,
    componentInfo,
  };
  window.dispatchEvent(new CustomEvent(EXTRACT_RESPONSE_EVENT, {
    detail: responseDetail,
  }));
});
