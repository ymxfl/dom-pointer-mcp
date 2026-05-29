import { RawPointedSelection, ComponentInfo } from '@dom-pointer-mcp/shared/types';
import ElementProcessor from '../../services/element-processor';

function singleElementRaw(overrides: Partial<{
  outerHTML: string;
  componentInfo?: ComponentInfo;
}> = {}) {
  return {
    outerHTML: '<div class="x" id="y">hi</div>',
    url: 'https://example.com',
    timestamp: 1700000000000,
    boundingClientRect: {
      x: 1, y: 2, width: 3, height: 4, top: 2, right: 4, bottom: 6, left: 1, toJSON: () => ({}),
    } as DOMRect,
    computedStyles: { color: 'red' },
    ...overrides,
  };
}

function makeBatch(elementCount = 2, userNote = 'note text'): RawPointedSelection {
  const elements = [];
  for (let i = 0; i < elementCount; i += 1) {
    elements.push(singleElementRaw({ outerHTML: `<div id="e${i}">e${i}</div>` }));
  }
  return {
    url: 'https://example.com',
    timestamp: 1700000000000,
    userNote,
    elements,
  };
}

describe('ElementProcessor.processBatchFromRaw', () => {
  const processor = new ElementProcessor();

  it('processes 2 elements with shared user note', () => {
    const result = processor.processBatchFromRaw(makeBatch(2, 'shared note'));
    expect(result.userNote).toBe('shared note');
    expect(result.elements).toHaveLength(2);
    expect(result.elements[0].id).toBe('e0');
    expect(result.elements[1].id).toBe('e1');
  });

  it('passes through empty userNote', () => {
    const result = processor.processBatchFromRaw(makeBatch(1, ''));
    expect(result.userNote).toBe('');
  });

  it('isolates parse failure to the affected element', () => {
    const batch = makeBatch(2, 'note');
    batch.elements[0].outerHTML = '<<<not html>>>';
    const result = processor.processBatchFromRaw(batch);
    // Element 0 may have warnings or fallback tagName; second element must be intact
    expect(result.elements[1].id).toBe('e1');
  });

  it('handles empty elements array defensively', () => {
    const result = processor.processBatchFromRaw({
      url: 'https://example.com',
      timestamp: 1700000000000,
      userNote: 'nothing',
      elements: [],
    });
    expect(result.elements).toEqual([]);
    expect(result.userNote).toBe('nothing');
  });
});
