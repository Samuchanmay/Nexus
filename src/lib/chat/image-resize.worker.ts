/// <reference lib="webworker" />
/**
 * Worker de redimensionado para el chat (pipeline thumb/medium/original).
 *
 * Recibe el ArrayBuffer de la imagen original y devuelve dos variantes
 * WebP: `thumb` (miniatura, ≤ 384 px por lado) y `medium` (vista, ≤ 1280
 * px). El original se sube sin tocar en el main thread. Si el navegador
 * no soporta createImageBitmap/OffscreenCanvas el worker falla limpio y
 * el hook cae a la ruta de subida simple (original únicamente).
 *
 * `self` se castea porque tsconfig compila con lib dom (no webworker);
 * la API usada aquí (createImageBitmap, OffscreenCanvas) existe en ambos.
 */

type WorkerApi = {
  onmessage: ((e: MessageEvent<ResizeRequest>) => void) | null;
  onerror: ((e: ErrorEvent) => void) | null;
  postMessage: (message: ResizeResult, transfer?: Transferable[]) => void;
};

const ctx = self as unknown as WorkerApi;

export interface ResizeRequest {
  id: string;
  buffer: ArrayBuffer;
  mime: string;
}

export interface ResizeResult {
  id: string;
  thumb: ArrayBuffer | null;
  medium: ArrayBuffer | null;
}

const MAX_THUMB = 384;
const MAX_MEDIUM = 1280;
const QUALITY_THUMB = 0.72;
const QUALITY_MEDIUM = 0.82;

async function scale(
  buffer: ArrayBuffer,
  mime: string,
  maxDim: number,
  quality: number,
): Promise<ArrayBuffer | null> {
  const bitmap = await createImageBitmap(new Blob([buffer], { type: mime }));
  try {
    const { width, height } = bitmap;
    const factor = Math.min(1, maxDim / Math.max(width, height));
    const w = Math.max(1, Math.round(width * factor));
    const h = Math.max(1, Math.round(height * factor));
    const canvas = new OffscreenCanvas(w, h);
    const c = canvas.getContext("2d");
    if (!c) return null;
    c.imageSmoothingEnabled = true;
    c.imageSmoothingQuality = "high";
    c.drawImage(bitmap, 0, 0, w, h);
    const blob = await canvas.convertToBlob({ type: "image/webp", quality });
    if (!blob || blob.type !== "image/webp" || blob.size === 0) return null;
    return blob.arrayBuffer();
  } finally {
    bitmap.close();
  }
}

ctx.onmessage = async (e: MessageEvent<ResizeRequest>) => {
  const { id, buffer, mime } = e.data;
  const fail = (): void => ctx.postMessage({ id, thumb: null, medium: null });
  try {
    const [thumb, medium] = await Promise.all([
      scale(buffer, mime, MAX_THUMB, QUALITY_THUMB),
      scale(buffer, mime, MAX_MEDIUM, QUALITY_MEDIUM),
    ]);
    const transfer: Transferable[] = [];
    if (thumb) transfer.push(thumb);
    if (medium) transfer.push(medium);
    ctx.postMessage({ id, thumb, medium }, transfer);
  } catch {
    fail();
  }
};

export {};
