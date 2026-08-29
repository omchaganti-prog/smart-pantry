/**
 * Image sizing for the scanner.
 *
 * Photos were being sent to the server at full camera resolution — 500KB to 3MB once
 * base64-encoded — and stored in `localStorage` at that size too. Both were problems:
 * the upload exceeded the request body limit, and a handful of scans would exhaust the
 * browser's storage quota.
 */

/** Long edge sent to the vision model. Plenty for detection; ~100KB encoded. */
const UPLOAD_MAX_EDGE = 1024;
/** Long edge kept on the pantry item. It renders in a 48px box. */
const THUMBNAIL_MAX_EDGE = 160;

const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not read that image'));
    img.src = src;
  });

const drawScaled = (img: HTMLImageElement, maxEdge: number, quality: number): string => {
  const longEdge = Math.max(img.width, img.height);
  const scale = longEdge > maxEdge ? maxEdge / longEdge : 1;

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);

  const ctx = canvas.getContext('2d');
  if (!ctx) return img.src;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', quality);
};

/**
 * Produces both sizes in one decode: the copy we upload, and the small one we store.
 * Falls back to the original on any failure — a scan should never be blocked by resizing.
 */
export const prepareScanImage = async (
  dataUrl: string
): Promise<{ upload: string; thumbnail: string }> => {
  try {
    const img = await loadImage(dataUrl);
    return {
      upload: drawScaled(img, UPLOAD_MAX_EDGE, 0.75),
      thumbnail: drawScaled(img, THUMBNAIL_MAX_EDGE, 0.6),
    };
  } catch {
    return { upload: dataUrl, thumbnail: dataUrl };
  }
};

/** Rough encoded size, for logging and quota decisions. */
export const approximateKB = (dataUrl: string): number =>
  Math.round((dataUrl.length * 0.75) / 1024);
