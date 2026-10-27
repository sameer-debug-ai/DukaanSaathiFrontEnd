/** Longest side of an uploaded bill photo: plenty for reading print, a fraction of a phone photo's size. */
export const MAX_PHOTO_SIDE = 1600;
const TARGET_BYTES = 1_500_000;

/** Size that fits inside max x max keeping the aspect ratio; never upscales. Pure. */
export function fitWithin(width: number, height: number, max = MAX_PHOTO_SIDE): { width: number; height: number } {
  if (width <= 0 || height <= 0) return { width: 0, height: 0 };
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

async function decode(file: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try {
      // Respects the camera's EXIF rotation, so the bill is upright.
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      /* fall back to <img> (e.g. HEIC on some browsers) */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

const toBlob = (canvas: HTMLCanvasElement, quality: number) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));

/**
 * Resizes a camera photo to at most MAX_PHOTO_SIDE and re-encodes it as JPEG (also drops EXIF,
 * including location). Typically 3-8 MB in, 200-700 KB out.
 */
export async function compressImage(file: Blob): Promise<Blob> {
  const img = await decode(file);
  const { width, height } = fitWithin(img.width, img.height);
  if (!width || !height) throw new Error('This file is not a readable image');
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not process the photo');
  ctx.fillStyle = '#fff'; // transparent PNGs become white, not black
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);
  if ('close' in img) img.close();

  let quality = 0.82;
  let blob = await toBlob(canvas, quality);
  while (blob && blob.size > TARGET_BYTES && quality > 0.5) {
    quality -= 0.12;
    blob = await toBlob(canvas, quality);
  }
  if (!blob) throw new Error('Could not process the photo');
  return blob;
}
