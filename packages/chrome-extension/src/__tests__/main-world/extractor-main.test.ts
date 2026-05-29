import {
  EXTRACT_REQUEST_EVENT,
  EXTRACT_RESPONSE_EVENT,
  EXTRACT_ID_ATTR,
  ExtractResponseDetail,
} from '../../shared/bridge-events';

function captureResponse(): Promise<ExtractResponseDetail> {
  return new Promise((resolve) => {
    const handler = (e: Event) => {
      window.removeEventListener(EXTRACT_RESPONSE_EVENT, handler);
      resolve((e as CustomEvent<ExtractResponseDetail>).detail);
    };
    window.addEventListener(EXTRACT_RESPONSE_EVENT, handler);
  });
}

describe('extractor-main', () => {
  beforeAll(async () => {
    await import('../../main-world/extractor-main');
  });

  it('dispatches response with componentInfo when element found', async () => {
    const el = document.createElement('div');
    el.setAttribute(EXTRACT_ID_ATTR, 'req-1');
    Object.defineProperty(el, '__vueParentComponent', {
      value: { type: { name: 'Foo' } },
      configurable: true,
    });
    document.body.appendChild(el);

    const responsePromise = captureResponse();
    window.dispatchEvent(new CustomEvent(EXTRACT_REQUEST_EVENT, {
      detail: { requestId: 'req-1' },
    }));

    const response = await responsePromise;
    expect(response.requestId).toBe('req-1');
    expect(response.componentInfo).toEqual({ name: 'Foo', framework: 'vue' });

    el.remove();
  });

  it('dispatches response with undefined componentInfo when element not found', async () => {
    const responsePromise = captureResponse();
    window.dispatchEvent(new CustomEvent(EXTRACT_REQUEST_EVENT, {
      detail: { requestId: 'req-missing' },
    }));

    const response = await responsePromise;
    expect(response.requestId).toBe('req-missing');
    expect(response.componentInfo).toBeUndefined();
  });
});
