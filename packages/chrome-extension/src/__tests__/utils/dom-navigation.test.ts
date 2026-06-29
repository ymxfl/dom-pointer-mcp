import {
  getParent,
  getFirstChild,
  getPrevSibling,
  getNextSibling,
} from '../../utils/dom-navigation';

// jsdom 不计算布局；用非零 rect 标记「可见」
function makeVisible(el: HTMLElement): HTMLElement {
  // eslint-disable-next-line no-param-reassign
  el.getBoundingClientRect = () => ({
    width: 10, height: 10, top: 0, left: 0, right: 10, bottom: 10, x: 0, y: 0, toJSON() {},
  } as DOMRect);
  return el;
}

function makeHidden(el: HTMLElement): HTMLElement {
  // eslint-disable-next-line no-param-reassign
  el.getBoundingClientRect = () => ({
    width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0, x: 0, y: 0, toJSON() {},
  } as DOMRect);
  return el;
}

describe('dom-navigation', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('getParent returns the visible parent element', () => {
    const parent = makeVisible(document.createElement('div'));
    const child = makeVisible(document.createElement('span'));
    parent.appendChild(child);
    document.body.appendChild(parent);

    expect(getParent(child)).toBe(parent);
  });

  it('getParent returns null at body boundary', () => {
    const el = makeVisible(document.createElement('div'));
    document.body.appendChild(el);

    expect(getParent(el)).toBeNull();
  });

  it('getFirstChild returns first visible child, skipping hidden ones', () => {
    const parent = makeVisible(document.createElement('div'));
    const hidden = makeHidden(document.createElement('span'));
    const visible = makeVisible(document.createElement('p'));
    parent.appendChild(hidden);
    parent.appendChild(visible);
    document.body.appendChild(parent);

    expect(getFirstChild(parent)).toBe(visible);
  });

  it('getFirstChild returns null when no children', () => {
    const parent = makeVisible(document.createElement('div'));
    document.body.appendChild(parent);

    expect(getFirstChild(parent)).toBeNull();
  });

  it('getNextSibling skips hidden and plugin-own elements', () => {
    const parent = makeVisible(document.createElement('div'));
    const a = makeVisible(document.createElement('span'));
    const hidden = makeHidden(document.createElement('span'));
    const own = makeVisible(document.createElement('span'));
    own.className = 'dom-pointer-mcp__overlay';
    const b = makeVisible(document.createElement('span'));
    parent.append(a, hidden, own, b);
    document.body.appendChild(parent);

    expect(getNextSibling(a)).toBe(b);
  });

  it('getPrevSibling returns previous visible sibling', () => {
    const parent = makeVisible(document.createElement('div'));
    const a = makeVisible(document.createElement('span'));
    const b = makeVisible(document.createElement('span'));
    parent.append(a, b);
    document.body.appendChild(parent);

    expect(getPrevSibling(b)).toBe(a);
  });

  it('getNextSibling returns null when none after', () => {
    const parent = makeVisible(document.createElement('div'));
    const a = makeVisible(document.createElement('span'));
    parent.append(a);
    document.body.appendChild(parent);

    expect(getNextSibling(a)).toBeNull();
  });
});
