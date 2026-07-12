import { autoUpdate, computePosition, size } from '@floating-ui/dom';

const offset = 6; // pixels

async function updatePositionAndSize(target: HTMLElement, overlay: HTMLElement) {
  await computePosition(target, overlay, {
    middleware: [
      size({
        apply({ rects, elements }) {
          const docWidth = Math.max(
            document.documentElement.scrollWidth,
            document.documentElement.offsetWidth,
            document.documentElement.clientWidth,
          );
          const docHeight = Math.max(
            document.documentElement.scrollHeight,
            document.documentElement.offsetHeight,
            document.documentElement.clientHeight,
          );

          const left = Math.max(rects.reference.x - offset, 0);
          const top = Math.max(rects.reference.y - offset, 0);
          const width = Math.min(rects.reference.width + (offset * 2), docWidth - left);
          const height = Math.min(rects.reference.height + (offset * 2), docHeight - top);

          // Use explicit width/height (not only min-*) so CSS transitions can
          // morph the hover outline between differently-sized targets.
          Object.assign(elements.floating.style, {
            left: `${left}px`,
            top: `${top}px`,
            width: `${width}px`,
            height: `${height}px`,
          });
        },
      }),
    ],
  });
}

export default function autoAssignOverlayPositionAndSize(
  target: HTMLElement,
  overlay: HTMLElement,
): () => void {
  const wrappedUpdatePosition = () => updatePositionAndSize(target, overlay);

  return autoUpdate(target, overlay, wrappedUpdatePosition);
}
