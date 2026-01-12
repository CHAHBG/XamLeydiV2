import type { GeoJSONFeature } from './types';

type Progress = {
  bytesRead: number;
  totalBytes: number;
  lines: number;
  features: number;
};

function isFeature(obj: any): obj is GeoJSONFeature {
  return obj && typeof obj === 'object' && obj.type === 'Feature';
}

function extractFeatures(obj: any): GeoJSONFeature[] {
  if (!obj || typeof obj !== 'object') return [];
  if (isFeature(obj)) return [obj];
  if (obj.type === 'FeatureCollection' && Array.isArray(obj.features)) {
    return obj.features.filter(isFeature);
  }
  return [];
}

export async function* iterateFeaturesFromGeoJSONL(
  file: File,
  opts?: {
    onProgress?: (p: Progress) => void;
    signal?: AbortSignal;
  }
): AsyncGenerator<GeoJSONFeature, void, void> {
  const totalBytes = file.size;
  let bytesRead = 0;
  let buffer = '';
  let lines = 0;
  let features = 0;

  const stream = file.stream();
  const reader = stream.getReader();
  const decoder = new TextDecoder('utf-8');

  try {
    while (true) {
      if (opts?.signal?.aborted) return;
      const { value, done } = await reader.read();
      if (done) break;

      bytesRead += value.byteLength;
      buffer += decoder.decode(value, { stream: true });

      // Process full lines
      let idx: number;
      while ((idx = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, idx).trim();
        buffer = buffer.slice(idx + 1);
        lines += 1;

        if (!line) continue;

        try {
          const obj = JSON.parse(line);
          const feats = extractFeatures(obj);
          for (const f of feats) {
            features += 1;
            yield f;
          }
        } catch {
          // ignore malformed lines
        }
      }

      opts?.onProgress?.({ bytesRead, totalBytes, lines, features });
    }

    // Flush remainder
    const last = buffer.trim();
    if (last) {
      lines += 1;
      try {
        const obj = JSON.parse(last);
        const feats = extractFeatures(obj);
        for (const f of feats) {
          features += 1;
          yield f;
        }
      } catch {
        // ignore
      }
    }

    opts?.onProgress?.({ bytesRead: totalBytes, totalBytes, lines, features });
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // ignore
    }
  }
}
