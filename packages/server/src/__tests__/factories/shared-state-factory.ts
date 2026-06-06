import { RawPointedDOMElement, PointerMessageType } from '@dom-pointer-mcp/shared/types';
import {
  SharedState, SharedStateData, ProcessedPointedDOMElement,
} from '../../types';
import { formatLocalTimestamp } from '../../utils/time';

export const createProcessedElement = (
  overrides: Partial<ProcessedPointedDOMElement> = {},
): ProcessedPointedDOMElement => ({
  tagName: 'div',
  classes: [],
  attributes: {},
  innerText: 'test content',
  selector: 'div',
  position: {
    x: 10, y: 20, width: 100, height: 50,
  },
  url: 'https://example.com',
  timestamp: formatLocalTimestamp(1672531200000),
  ...overrides,
});

export const createRawElement = (
  overrides: Partial<RawPointedDOMElement> = {},
): RawPointedDOMElement => ({
  outerHTML: '<div>test content</div>',
  url: 'https://example.com',
  timestamp: 1672531200000,
  boundingClientRect: {
    x: 10,
    y: 20,
    width: 100,
    height: 50,
    top: 20,
    right: 110,
    bottom: 70,
    left: 10,
    toJSON() { return this; },
  },
  ...overrides,
});

export const createSharedState = (
  rawOverrides: Partial<RawPointedDOMElement> = {},
  processedOverrides: Partial<ProcessedPointedDOMElement> = {},
  selectionOverrides: {
    selectionId?: string;
    userNote?: string;
    url?: string;
    timestamp?: string | number;
  } = {},
): SharedState => {
  const userNote = selectionOverrides.userNote ?? 'test note';
  const url = selectionOverrides.url ?? 'https://example.com';
  const rawTimestamp = (selectionOverrides.timestamp as number | undefined) ?? 1672531200000;
  const processedTimestamp = (selectionOverrides.timestamp as string | undefined)
    ?? formatLocalTimestamp(rawTimestamp);
  const selectionId = selectionOverrides.selectionId ?? 'sel_test';

  return {
    data: {
      selectionId,
      rawPointedSelection: {
        url,
        timestamp: rawTimestamp,
        userNote,
        elements: [createRawElement(rawOverrides)],
      },
      processedPointedSelection: {
        selectionId,
        userNote,
        url,
        timestamp: processedTimestamp,
        elements: [createProcessedElement(processedOverrides)],
      },
      metadata: {
        receivedAt: formatLocalTimestamp(rawTimestamp),
        messageType: PointerMessageType.SELECTION_SENT,
      },
    } as SharedStateData,
  };
};
