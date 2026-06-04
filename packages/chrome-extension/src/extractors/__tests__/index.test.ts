import { extractComponentInfo } from '../index';
import logger from '../../utils/logger';

describe('extractComponentInfo orchestrator', () => {
  let loggerErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    loggerErrorSpy = jest.spyOn(logger, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    loggerErrorSpy.mockRestore();
  });

  it('returns Vue info when element has __vueParentComponent (Vue tried before React)', () => {
    const el = document.createElement('div');
    Object.defineProperty(el, '__vueParentComponent', {
      value: { type: { name: 'V' } },
      configurable: true,
    });
    Object.defineProperty(el, '__reactFiber$x', {
      value: { type: { displayName: 'R' } },
      configurable: true,
    });
    expect(extractComponentInfo(el)).toMatchObject({ name: 'V', framework: 'vue' });
  });

  it('returns undefined when no extractor matches', () => {
    const el = document.createElement('div');
    expect(extractComponentInfo(el)).toBeUndefined();
  });

  it('does not throw when an extractor throws — logs and continues', () => {
    const el = document.createElement('div');
    Object.defineProperty(el, '__vueParentComponent', {
      get() { throw new Error('boom'); },
      enumerable: true,
    });
    Object.defineProperty(el, '__reactFiber$x', {
      value: { type: { displayName: 'Fallback' } },
      configurable: true,
      enumerable: true,
    });

    let result: ReturnType<typeof extractComponentInfo>;
    expect(() => { result = extractComponentInfo(el); }).not.toThrow();
    expect(result!).toMatchObject({ name: 'Fallback', framework: 'react' });
    expect(loggerErrorSpy).toHaveBeenCalled();
  });
});
