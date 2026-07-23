import { RawReferenceImage, ReferenceImageMimeType } from '@dom-pointer-mcp/shared/types';

const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.8;

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Failed to decode pasted image'));
    image.src = dataUrl;
  });
}

function readBlobAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read pasted image'));
    reader.readAsDataURL(blob);
  });
}

// Downscale a pasted image so its longest edge is <= MAX_EDGE and re-encode
// as JPEG to bound the payload sent over WebSocket and fed to the agent.
export default async function buildReferenceImage(
  blob: Blob,
): Promise<RawReferenceImage | undefined> {
  if (!blob.type.startsWith('image/')) return undefined;

  const sourceDataUrl = await readBlobAsDataUrl(blob);
  const image = await loadImage(sourceDataUrl);

  const { naturalWidth: width, naturalHeight: height } = image;
  if (width === 0 || height === 0) return undefined;

  const scale = Math.min(1, MAX_EDGE / Math.max(width, height));
  const targetWidth = Math.max(1, Math.round(width * scale));
  const targetHeight = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return undefined;
  ctx.drawImage(image, 0, 0, targetWidth, targetHeight);

  // Preserve PNG only when no downscale happened and the source was PNG
  // (keeps crisp UI mockups); otherwise JPEG keeps the payload small.
  const keepPng = scale === 1 && blob.type === 'image/png';
  const mimeType: ReferenceImageMimeType = keepPng ? 'image/png' : 'image/jpeg';
  const dataUrl = keepPng
    ? canvas.toDataURL('image/png')
    : canvas.toDataURL('image/jpeg', JPEG_QUALITY);

  return {
    dataUrl,
    mimeType,
    width: targetWidth,
    height: targetHeight,
    capturedAt: Date.now(),
  };
}
