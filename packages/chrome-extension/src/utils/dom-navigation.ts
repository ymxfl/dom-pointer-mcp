const PLUGIN_CLASS_PREFIX = 'dom-pointer-mcp';

function isPluginOwn(el: HTMLElement): boolean {
  if (typeof el.className !== 'string') return false;
  return el.className
    .split(/\s+/)
    .some((cls) => cls.startsWith(PLUGIN_CLASS_PREFIX));
}

function isNavigable(el: HTMLElement): boolean {
  if (isPluginOwn(el)) return false;

  const rect = el.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return false;

  const style = window.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden') return false;

  return true;
}

export function getParent(el: HTMLElement): HTMLElement | null {
  let current = el.parentElement;
  while (current && current !== document.body) {
    if (isNavigable(current)) return current;
    current = current.parentElement;
  }
  return null;
}

export function getFirstChild(el: HTMLElement): HTMLElement | null {
  let child = el.firstElementChild as HTMLElement | null;
  while (child) {
    if (isNavigable(child)) return child;
    child = child.nextElementSibling as HTMLElement | null;
  }
  return null;
}

export function getPrevSibling(el: HTMLElement): HTMLElement | null {
  let sib = el.previousElementSibling as HTMLElement | null;
  while (sib) {
    if (isNavigable(sib)) return sib;
    sib = sib.previousElementSibling as HTMLElement | null;
  }
  return null;
}

export function getNextSibling(el: HTMLElement): HTMLElement | null {
  let sib = el.nextElementSibling as HTMLElement | null;
  while (sib) {
    if (isNavigable(sib)) return sib;
    sib = sib.nextElementSibling as HTMLElement | null;
  }
  return null;
}
