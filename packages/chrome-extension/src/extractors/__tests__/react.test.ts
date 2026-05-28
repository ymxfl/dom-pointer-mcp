import { extractReact } from '../react';

function makeElementWithFiber(fiber: any, key = '__reactFiber$abc123'): HTMLElement {
  const el = document.createElement('div');
  (el as any)[key] = fiber;
  return el;
}

describe('extractReact', () => {
  it('returns undefined when element has no __reactFiber$* property', () => {
    const el = document.createElement('div');
    expect(extractReact(el)).toBeUndefined();
  });

  it('uses displayName when present', () => {
    const fiber = { type: { displayName: 'MyButton' } };
    const el = makeElementWithFiber(fiber);
    expect(extractReact(el)).toEqual({ name: 'MyButton', framework: 'react' });
  });

  it('falls back to type.name when displayName missing', () => {
    const fiber = { type: { name: 'NamedFn' } };
    const el = makeElementWithFiber(fiber);
    expect(extractReact(el)).toEqual({ name: 'NamedFn', framework: 'react' });
  });

  it('includes sourceFile with line number from _debugSource', () => {
    const fiber = {
      type: { displayName: 'MyComp' },
      _debugSource: { fileName: '/src/components/MyComp.tsx', lineNumber: 42 },
    };
    const el = makeElementWithFiber(fiber);
    expect(extractReact(el)).toEqual({
      name: 'MyComp',
      framework: 'react',
      sourceFile: 'MyComp.tsx:42',
    });
  });

  it('omits sourceFile when _debugSource absent (React 19)', () => {
    const fiber = { type: { displayName: 'MyComp' } };
    const el = makeElementWithFiber(fiber);
    const result = extractReact(el);
    expect(result?.name).toBe('MyComp');
    expect(result?.sourceFile).toBeUndefined();
  });
});
