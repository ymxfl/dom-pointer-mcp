import {
  EXTRACT_REQUEST_EVENT,
  EXTRACT_RESPONSE_EVENT,
  EXTRACT_ID_ATTR,
  ExtractRequestDetail,
  ExtractResponseDetail,
} from '../../shared/bridge-events';
import type { ComponentInfo } from '@mcp-pointer/shared/types';
import { requestComponentInfo } from '../../isolated-world/request-component-info';

function captureRequest(): Promise<string> {
  return new Promise((resolve) => {
    const handler = (e: Event) => {
      window.removeEventListener(EXTRACT_REQUEST_EVENT, handler);
      resolve((e as CustomEvent<ExtractRequestDetail>).detail.requestId);
    };
    window.addEventListener(EXTRACT_REQUEST_EVENT, handler);
  });
}

function sendResponse(requestId: string, componentInfo?: ComponentInfo) {
  const detail: ExtractResponseDetail = { requestId, componentInfo };
  window.dispatchEvent(new CustomEvent(EXTRACT_RESPONSE_EVENT, { detail }));
}

describe('requestComponentInfo', () => {
  it('resolves with componentInfo when matching response arrives', async () => {
    const el = document.createElement('div');
    const capturedIdPromise = captureRequest();
    const resultPromise = requestComponentInfo(el, 1000);
    const requestId = await capturedIdPromise;
    sendResponse(requestId, { name: 'X', framework: 'react' });
    await expect(resultPromise).resolves.toEqual({ name: 'X', framework: 'react' });
    expect(el.hasAttribute(EXTRACT_ID_ATTR)).toBe(false);
  });

  it('resolves undefined and cleans attribute on timeout', async () => {
    jest.useFakeTimers();
    const el = document.createElement('div');
    const resultPromise = requestComponentInfo(el, 100);
    jest.advanceTimersByTime(100);
    await expect(resultPromise).resolves.toBeUndefined();
    expect(el.hasAttribute(EXTRACT_ID_ATTR)).toBe(false);
    jest.useRealTimers();
  });

  it('ignores responses with mismatched requestId', async () => {
    const el = document.createElement('div');
    const capturedIdPromise = captureRequest();
    const resultPromise = requestComponentInfo(el, 1000);
    const requestId = await capturedIdPromise;
    sendResponse('wrong-id', { name: 'WRONG', framework: 'react' });
    sendResponse(requestId, { name: 'RIGHT', framework: 'vue' });
    await expect(resultPromise).resolves.toEqual({ name: 'RIGHT', framework: 'vue' });
  });

  it('handles concurrent requests independently', async () => {
    const elA = document.createElement('div');
    const elB = document.createElement('div');
    const requestIds: string[] = [];
    const handler = (e: Event) => {
      requestIds.push((e as CustomEvent<ExtractRequestDetail>).detail.requestId);
    };
    window.addEventListener(EXTRACT_REQUEST_EVENT, handler);

    const promiseA = requestComponentInfo(elA, 1000);
    const promiseB = requestComponentInfo(elB, 1000);

    await new Promise((r) => setTimeout(r, 0));
    expect(requestIds).toHaveLength(2);
    const [idA, idB] = requestIds;

    sendResponse(idB, { name: 'B', framework: 'react' });
    sendResponse(idA, { name: 'A', framework: 'vue' });

    await expect(promiseA).resolves.toEqual({ name: 'A', framework: 'vue' });
    await expect(promiseB).resolves.toEqual({ name: 'B', framework: 'react' });

    window.removeEventListener(EXTRACT_REQUEST_EVENT, handler);
  });

  it('ignores late responses after timeout', async () => {
    jest.useFakeTimers();
    const el = document.createElement('div');
    let capturedId = '';
    const handler = (e: Event) => {
      capturedId = (e as CustomEvent<ExtractRequestDetail>).detail.requestId;
    };
    window.addEventListener(EXTRACT_REQUEST_EVENT, handler);

    const resultPromise = requestComponentInfo(el, 50);
    jest.advanceTimersByTime(50);
    const result = await resultPromise;
    expect(result).toBeUndefined();

    expect(() => sendResponse(capturedId, { name: 'LATE', framework: 'react' })).not.toThrow();

    window.removeEventListener(EXTRACT_REQUEST_EVENT, handler);
    jest.useRealTimers();
  });
});
