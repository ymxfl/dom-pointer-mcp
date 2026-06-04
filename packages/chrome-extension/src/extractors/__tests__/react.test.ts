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
    expect(extractReact(el)).toMatchObject({ name: 'MyButton', framework: 'react' });
  });

  it('falls back to type.name when displayName missing', () => {
    const fiber = { type: { name: 'NamedFn' } };
    const el = makeElementWithFiber(fiber);
    expect(extractReact(el)).toMatchObject({ name: 'NamedFn', framework: 'react' });
  });

  it('returns full sourceFile path with line number from _debugSource', () => {
    const fiber = {
      type: { displayName: 'MyComp' },
      _debugSource: { fileName: '/src/components/MyComp.tsx', lineNumber: 42 },
    };
    const el = makeElementWithFiber(fiber);
    expect(extractReact(el)).toMatchObject({
      name: 'MyComp',
      framework: 'react',
      sourceFile: '/src/components/MyComp.tsx:42',
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
    const appFiber = { type: { displayName: 'App' } };
    const divFiber = { type: 'div', return: appFiber };
    const headerFiber = { type: 'header', return: divFiber };
    const pFiber = { type: 'p', return: headerFiber };
    const codeFiber = { type: 'code', return: pFiber };
    const el = makeElementWithFiber(codeFiber);
    expect(extractReact(el)).toMatchObject({ name: 'App', framework: 'react' });
  });

  it('returns undefined when no component fiber found in return chain', () => {
    const rootFiber = { type: 'div', return: null };
    const childFiber = { type: 'span', return: rootFiber };
    const el = makeElementWithFiber(childFiber);
    expect(extractReact(el)).toBeUndefined();
  });

  it('reads _debugSource from the component fiber, not the element fiber', () => {
    const appFiber = {
      type: { displayName: 'App' },
      _debugSource: { fileName: '/src/App.tsx', lineNumber: 7 },
    };
    const codeFiber = { type: 'code', return: appFiber };
    const el = makeElementWithFiber(codeFiber);
    expect(extractReact(el)).toMatchObject({
      name: 'App',
      framework: 'react',
      sourceFile: '/src/App.tsx:7',
    });
  });

  it('collects ancestors from fiber return chain', () => {
    const rootFiber = {
      type: { displayName: 'App' },
      _debugSource: { fileName: '/src/App.tsx', lineNumber: 1 },
    };
    const layoutFiber = {
      type: { name: 'Layout' },
      _debugSource: { fileName: '/src/layouts/Layout.tsx', lineNumber: 10 },
      return: rootFiber,
    };
    const buttonFiber = {
      type: { displayName: 'Button' },
      _debugSource: { fileName: '/src/components/Button.tsx', lineNumber: 5 },
      return: layoutFiber,
    };
    const spanFiber = { type: 'span', return: buttonFiber };
    const el = makeElementWithFiber(spanFiber);
    const result = extractReact(el);
    expect(result).toMatchObject({
      name: 'Button',
      framework: 'react',
      sourceFile: '/src/components/Button.tsx:5',
    });
    expect(result?.ancestors).toEqual([
      { name: 'Button', sourceFile: '/src/components/Button.tsx:5' },
      { name: 'Layout', sourceFile: '/src/layouts/Layout.tsx:10' },
      { name: 'App', sourceFile: '/src/App.tsx:1' },
    ]);
  });
});
