const CAPTURE_CLASS = 'dom-pointer-mcp--capturing-screenshot';

function nextPaint(): Promise<void> {
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => resolve());
    });
  });
}

export async function withExtensionUiHidden<T>(operation: () => Promise<T>): Promise<T> {
  const root = document.documentElement;
  const wasHidden = root.classList.contains(CAPTURE_CLASS);
  root.classList.add(CAPTURE_CLASS);

  try {
    await nextPaint();
    return await operation();
  } finally {
    if (!wasHidden) {
      root.classList.remove(CAPTURE_CLASS);
    }
  }
}
