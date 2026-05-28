import { RawPointedDOMElement, ComponentInfo } from '@mcp-pointer/shared/types';
import ElementProcessor from '../../services/element-processor';

function makeRaw(overrides: Partial<RawPointedDOMElement> = {}): RawPointedDOMElement {
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

describe('ElementProcessor.processFromRaw', () => {
  const processor = new ElementProcessor();

  it('passes through componentInfo when present', () => {
    const componentInfo: ComponentInfo = { name: 'MyComp', framework: 'react', sourceFile: 'MyComp.tsx:42' };
    const result = processor.processFromRaw(makeRaw({ componentInfo }));
    expect(result.componentInfo).toEqual(componentInfo);
  });

  it('leaves componentInfo undefined when raw has none', () => {
    const result = processor.processFromRaw(makeRaw());
    expect(result.componentInfo).toBeUndefined();
  });

  it('does not affect other fields when componentInfo is present', () => {
    const componentInfo: ComponentInfo = { name: 'X', framework: 'vue' };
    const result = processor.processFromRaw(makeRaw({ componentInfo }));
    expect(result.tagName).toBe('DIV');
    expect(result.id).toBe('y');
    expect(result.classes).toEqual(['x']);
    expect(result.cssComputed).toEqual({ color: 'red' });
    expect(result.position).toEqual({ x: 1, y: 2, width: 3, height: 4 });
  });

  it('passes through malformed componentInfo without throwing (trusts browser-side source)', () => {
    const malformed = { name: 'OnlyName' } as ComponentInfo;
    expect(() => processor.processFromRaw(makeRaw({ componentInfo: malformed }))).not.toThrow();
    const result = processor.processFromRaw(makeRaw({ componentInfo: malformed }));
    expect(result.componentInfo).toEqual(malformed);
  });
});
