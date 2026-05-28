import { extractComponentInfo } from '../index';

describe('extractComponentInfo orchestrator', () => {
  it('returns Vue info when element has __vueParentComponent (Vue tried before React)', () => {
    const el = document.createElement('div');
    (el as any).__vueParentComponent = { type: { name: 'V' } };
    (el as any).__reactFiber$x = { type: { displayName: 'R' } };
    expect(extractComponentInfo(el)).toEqual({ name: 'V', framework: 'vue' });
  });

  it('returns undefined when no extractor matches', () => {
    const el = document.createElement('div');
    expect(extractComponentInfo(el)).toBeUndefined();
  });

  it('does not throw when an extractor throws — logs and continues', () => {
    const el = document.createElement('div');
    Object.defineProperty(el, '__vueParentComponent', {
      get() { throw new Error('boom'); },
    });
    (el as any).__reactFiber$x = { type: { displayName: 'Fallback' } };
    expect(() => extractComponentInfo(el)).not.toThrow();
    expect(extractComponentInfo(el)).toEqual({ name: 'Fallback', framework: 'react' });
  });
});
