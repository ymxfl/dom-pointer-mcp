import { extractVue } from '../vue';

function makeElementWithVue3(type: any, parent?: any): HTMLElement {
  const el = document.createElement('div');
  const instance: any = { type };
  if (parent !== undefined) instance.parent = parent;
  Object.defineProperty(el, '__vueParentComponent', {
    value: instance,
    configurable: true,
  });
  return el;
}

function makeElementWithVue2(options: any, $parent?: any): HTMLElement {
  const el = document.createElement('div');
  const instance: any = { $options: options };
  if ($parent !== undefined) instance.$parent = $parent;
  Object.defineProperty(el, '__vue__', {
    value: instance,
    configurable: true,
  });
  return el;
}

describe('extractVue', () => {
  describe('Vue 3', () => {
    it('uses type.name when present', () => {
      const el = makeElementWithVue3({ name: 'MyVue3' });
      const result = extractVue(el);
      expect(result).toMatchObject({ name: 'MyVue3', framework: 'vue' });
      expect(result?.ancestors).toEqual([{ name: 'MyVue3' }]);
    });

    it('falls back to type.__name (script setup)', () => {
      const el = makeElementWithVue3({ __name: 'AutoName' });
      expect(extractVue(el)).toMatchObject({ name: 'AutoName', framework: 'vue' });
    });

    it('returns undefined when both name fields missing', () => {
      const el = makeElementWithVue3({});
      expect(extractVue(el)).toBeUndefined();
    });

    it('returns full sourceFile path (not just filename)', () => {
      const el = makeElementWithVue3({
        name: 'Foo',
        __file: '/src/components/Foo.vue',
      });
      expect(extractVue(el)).toMatchObject({
        name: 'Foo',
        framework: 'vue',
        sourceFile: '/src/components/Foo.vue',
      });
    });

    it('omits sourceFile when __file absent (prod build)', () => {
      const el = makeElementWithVue3({ name: 'Foo' });
      const result = extractVue(el);
      expect(result?.name).toBe('Foo');
      expect(result?.sourceFile).toBeUndefined();
    });

    it('skips node_modules component and returns user component with full path', () => {
      const parentInstance = {
        type: { name: 'Navbar', __file: '/src/views/layout/components/Navbar.vue' },
        parent: null,
      };
      const el = makeElementWithVue3(
        { name: 'ElDropdownItem', __file: 'node_modules/element-plus/es/components/dropdown/src/dropdown-item.vue' },
        parentInstance,
      );
      const result = extractVue(el);
      expect(result).toMatchObject({
        name: 'Navbar',
        framework: 'vue',
        sourceFile: '/src/views/layout/components/Navbar.vue',
      });
      expect(result?.ancestors).toEqual([
        { name: 'ElDropdownItem', sourceFile: 'node_modules/element-plus/es/components/dropdown/src/dropdown-item.vue' },
        { name: 'Navbar', sourceFile: '/src/views/layout/components/Navbar.vue' },
      ]);
    });

    it('falls back to nearest named component when entire chain is node_modules', () => {
      const parentInstance = {
        type: { name: 'ElDropdown', __file: 'node_modules/element-plus/es/components/dropdown/src/dropdown.vue' },
        parent: null,
      };
      const el = makeElementWithVue3(
        { name: 'ElDropdownItem', __file: 'node_modules/element-plus/es/components/dropdown/src/dropdown-item.vue' },
        parentInstance,
      );
      const result = extractVue(el);
      expect(result).toMatchObject({
        name: 'ElDropdownItem',
        framework: 'vue',
        sourceFile: 'node_modules/element-plus/es/components/dropdown/src/dropdown-item.vue',
      });
    });

    it('treats bare filename (no slash) as library component and skips it', () => {
      const parentInstance = {
        type: { name: 'Navbar', __file: 'src/views/layout/components/Navbar.vue' },
        parent: null,
      };
      const el = makeElementWithVue3(
        { name: 'ElDropdownItem', __file: 'dropdown-item.vue' },
        parentInstance,
      );
      expect(extractVue(el)).toMatchObject({
        name: 'Navbar',
        framework: 'vue',
        sourceFile: 'src/views/layout/components/Navbar.vue',
      });
    });

    it('returns user component even when intermediate ancestors are unnamed', () => {
      const grandparent = {
        type: { name: 'AppLayout', __file: '/src/layouts/AppLayout.vue' },
        parent: null,
      };
      const anonymousParent = {
        type: {},
        parent: grandparent,
      };
      const el = makeElementWithVue3(
        { name: 'ElButton', __file: 'node_modules/element-plus/es/components/button/src/button.vue' },
        anonymousParent,
      );
      expect(extractVue(el)).toMatchObject({
        name: 'AppLayout',
        framework: 'vue',
        sourceFile: '/src/layouts/AppLayout.vue',
      });
    });

    it('prefers the nearest user component over a deeper one', () => {
      const grandparent = {
        type: { name: 'AppLayout', __file: '/src/layouts/AppLayout.vue' },
        parent: null,
      };
      const userParent = {
        type: { name: 'Sidebar', __file: '/src/components/Sidebar.vue' },
        parent: grandparent,
      };
      const el = makeElementWithVue3(
        { name: 'ElMenu', __file: 'node_modules/element-plus/es/components/menu/src/menu.vue' },
        userParent,
      );
      const result = extractVue(el);
      expect(result).toMatchObject({
        name: 'Sidebar',
        framework: 'vue',
        sourceFile: '/src/components/Sidebar.vue',
      });
      expect(result?.ancestors).toEqual([
        { name: 'ElMenu', sourceFile: 'node_modules/element-plus/es/components/menu/src/menu.vue' },
        { name: 'Sidebar', sourceFile: '/src/components/Sidebar.vue' },
        { name: 'AppLayout', sourceFile: '/src/layouts/AppLayout.vue' },
      ]);
    });
  });

  describe('Vue 2', () => {
    it('finds __vue__ directly on element', () => {
      const el = makeElementWithVue2({ name: 'MyVue2' });
      expect(extractVue(el)).toMatchObject({ name: 'MyVue2', framework: 'vue' });
    });

    it('walks up parent chain to find __vue__ on ancestor', () => {
      const parent = makeElementWithVue2({ name: 'Outer' });
      const child = document.createElement('span');
      parent.appendChild(child);
      expect(extractVue(child)).toMatchObject({ name: 'Outer', framework: 'vue' });
    });

    it('returns undefined when neither element nor ancestors have __vue__', () => {
      const root = document.createElement('div');
      const child = document.createElement('span');
      root.appendChild(child);
      expect(extractVue(child)).toBeUndefined();
    });

    it('skips node_modules component via $parent chain', () => {
      const userParent = {
        $options: { name: 'Navbar', __file: '/src/views/Navbar.vue' },
        $parent: null,
      };
      const el = makeElementWithVue2(
        { name: 'ElDropdownItem', __file: 'node_modules/element-ui/lib/dropdown-item.vue' },
        userParent,
      );
      expect(extractVue(el)).toMatchObject({
        name: 'Navbar',
        framework: 'vue',
        sourceFile: '/src/views/Navbar.vue',
      });
    });

    it('falls back to nearest named when all are node_modules', () => {
      const libParent = {
        $options: { name: 'ElDropdown', __file: 'node_modules/element-ui/lib/dropdown.vue' },
        $parent: null,
      };
      const el = makeElementWithVue2(
        { name: 'ElDropdownItem', __file: 'node_modules/element-ui/lib/dropdown-item.vue' },
        libParent,
      );
      expect(extractVue(el)).toMatchObject({
        name: 'ElDropdownItem',
        framework: 'vue',
        sourceFile: 'node_modules/element-ui/lib/dropdown-item.vue',
      });
    });

    it('treats bare filename as library and walks up to user component', () => {
      const userParent = {
        $options: { name: 'Navbar', __file: 'src/views/layout/components/Navbar.vue' },
        $parent: null,
      };
      const el = makeElementWithVue2(
        { name: 'ElDropdownItem', __file: 'dropdown-item.vue' },
        userParent,
      );
      expect(extractVue(el)).toMatchObject({
        name: 'Navbar',
        framework: 'vue',
        sourceFile: 'src/views/layout/components/Navbar.vue',
      });
    });

    it('skips Element UI packages/ path and finds user component', () => {
      const userParent = {
        $options: { __file: 'src/views/layout/components/Navbar.vue' },
        $parent: null,
      };
      const el = makeElementWithVue2(
        { name: 'ElDropdownItem', __file: 'packages/dropdown/src/dropdown-item.vue' },
        userParent,
      );
      expect(extractVue(el)).toMatchObject({
        name: 'Navbar',
        framework: 'vue',
        sourceFile: 'src/views/layout/components/Navbar.vue',
      });
    });

    it('derives component name from __file when name is missing', () => {
      const el = makeElementWithVue2(
        { __file: 'src/views/layout/components/Navbar.vue' },
      );
      expect(extractVue(el)).toMatchObject({
        name: 'Navbar',
        framework: 'vue',
        sourceFile: 'src/views/layout/components/Navbar.vue',
      });
    });

    it('returns full ancestor chain from real-world Element UI scenario', () => {
      const app = { $options: { name: 'APP', __file: 'src/App.vue' }, $parent: null };
      const layout = { $options: { name: 'layout', __file: 'src/views/layout/Layout.vue' }, $parent: app };
      const navbar = { $options: { __file: 'src/views/layout/components/Navbar.vue' }, $parent: layout };
      const dropdown = { $options: { name: 'ElDropdown', __file: 'packages/dropdown/src/dropdown.vue' }, $parent: navbar };
      const dropdownMenu = { $options: { name: 'ElDropdownMenu', __file: 'packages/dropdown/src/dropdown-menu.vue' }, $parent: dropdown };
      const el = makeElementWithVue2(
        { name: 'ElDropdownItem', __file: 'packages/dropdown/src/dropdown-item.vue' },
        dropdownMenu,
      );
      const result = extractVue(el);
      expect(result).toMatchObject({
        name: 'Navbar',
        framework: 'vue',
        sourceFile: 'src/views/layout/components/Navbar.vue',
      });
      expect(result?.ancestors).toEqual([
        { name: 'ElDropdownItem', sourceFile: 'packages/dropdown/src/dropdown-item.vue' },
        { name: 'ElDropdownMenu', sourceFile: 'packages/dropdown/src/dropdown-menu.vue' },
        { name: 'ElDropdown', sourceFile: 'packages/dropdown/src/dropdown.vue' },
        { name: 'Navbar', sourceFile: 'src/views/layout/components/Navbar.vue' },
        { name: 'layout', sourceFile: 'src/views/layout/Layout.vue' },
        { name: 'APP', sourceFile: 'src/App.vue' },
      ]);
    });
  });
});
