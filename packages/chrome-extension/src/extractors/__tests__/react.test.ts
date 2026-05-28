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

  it('walks fiber.return through string-type fibers to find component ancestor', () => {
    // <code> inside <p> inside <header> inside <div> inside <App>
    const appFiber = { type: { displayName: 'App' } };
    const divFiber = { type: 'div', return: appFiber };
    const headerFiber = { type: 'header', return: divFiber };
    const pFiber = { type: 'p', return: headerFiber };
    const codeFiber = { type: 'code', return: pFiber };
    const el = makeElementWithFiber(codeFiber);
    expect(extractReact(el)).toEqual({ name: 'App', framework: 'react' });
  });

  it('returns undefined when no component fiber found in return chain', () => {
    // All HTML element fibers, no component ancestor
    const rootFiber = { type: 'div', return: null };
    const childFiber = { type: 'span', return: rootFiber };
    const el = makeElementWithFiber(childFiber);
    expect(extractReact(el)).toBeUndefined();
  });

  it('reads _debugSource from the component fiber, not the element fiber', () => {
    // Source info lives on the component fiber, not the intermediate HTML fibers
    const appFiber = {
      type: { displayName: 'App' },
      _debugSource: { fileName: '/src/App.tsx', lineNumber: 7 },
    };
    const codeFiber = { type: 'code', return: appFiber };
    const el = makeElementWithFiber(codeFiber);
    expect(extractReact(el)).toEqual({
      name: 'App',
      framework: 'react',
      sourceFile: 'App.tsx:7',
    });
  });
});
