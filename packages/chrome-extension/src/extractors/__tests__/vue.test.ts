import { extractVue } from '../vue';

function makeElementWithVue3(type: any): HTMLElement {
  const el = document.createElement('div');
  Object.defineProperty(el, '__vueParentComponent', {
    value: { type },
    configurable: true,
  });
  return el;
}

function makeElementWithVue2(options: any): HTMLElement {
  const el = document.createElement('div');
  Object.defineProperty(el, '__vue__', {
    value: { $options: options },
    configurable: true,
  });
  return el;
}

describe('extractVue', () => {
  describe('Vue 3', () => {
    it('uses type.name when present', () => {
      const el = makeElementWithVue3({ name: 'MyVue3' });
      expect(extractVue(el)).toEqual({ name: 'MyVue3', framework: 'vue' });
    });

    it('falls back to type.__name (script setup)', () => {
      const el = makeElementWithVue3({ __name: 'AutoName' });
      expect(extractVue(el)).toEqual({ name: 'AutoName', framework: 'vue' });
    });

    it('returns undefined when both name fields missing', () => {
      const el = makeElementWithVue3({});
      expect(extractVue(el)).toBeUndefined();
    });

    it('extracts sourceFile from type.__file (filename only, no line)', () => {
      const el = makeElementWithVue3({
        name: 'Foo',
        __file: '/src/components/Foo.vue',
      });
      expect(extractVue(el)).toEqual({
        name: 'Foo',
        framework: 'vue',
        sourceFile: 'Foo.vue',
      });
    });

    it('omits sourceFile when __file absent (prod build)', () => {
      const el = makeElementWithVue3({ name: 'Foo' });
      const result = extractVue(el);
      expect(result?.name).toBe('Foo');
      expect(result?.sourceFile).toBeUndefined();
    });
  });

  describe('Vue 2', () => {
    it('finds __vue__ directly on element', () => {
      const el = makeElementWithVue2({ name: 'MyVue2' });
      expect(extractVue(el)).toEqual({ name: 'MyVue2', framework: 'vue' });
    });

    it('walks up parent chain to find __vue__ on ancestor', () => {
      const parent = makeElementWithVue2({ name: 'Outer' });
      const child = document.createElement('span');
      parent.appendChild(child);
      expect(extractVue(child)).toEqual({ name: 'Outer', framework: 'vue' });
    });

    it('returns undefined when neither element nor ancestors have __vue__', () => {
      const root = document.createElement('div');
      const child = document.createElement('span');
      root.appendChild(child);
      expect(extractVue(child)).toBeUndefined();
    });
  });
});
