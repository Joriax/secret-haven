import * as tus from "tus-js-client";
import { SUPABASE_PROJECT_ID, SUPABASE_ANON_KEY, getStorageEndpoint, UPLOAD_CHUNK_SIZE_MB } from '@/config';

export type ResumableUploadOptions = {
  bucket: string;
  objectPath: string;
  file: File;
  contentType: string;
  cacheControl?: string;
  sessionToken: string | null;
  onProgress?: (progress01: number) => void;
};

/**
 * Resumable upload to Lovable Cloud storage using the TUS protocol.
 * This is primarily used for large videos where standard uploads can fail.
 */
export function resumableStorageUpload({
  bucket,
  objectPath,
  file,
  contentType,
  cacheControl = "3600",
  sessionToken,
  onProgress,
}: ResumableUploadOptions): Promise<void> {
  const endpoint = getStorageEndpoint();
  if (!endpoint || !SUPABASE_ANON_KEY) {
    return Promise.reject(new Error("Missing storage configuration. Check src/config/index.ts"));
  }

  return new Promise((resolve, reject) => {
    const upload = new tus.Upload(file, {
      endpoint,
      retryDelays: [0, 3000, 5000, 10000, 20000],
      chunkSize: UPLOAD_CHUNK_SIZE_MB * 1024 * 1024,
      removeFingerprintOnSuccess: true,
      headers: {
        apikey: SUPABASE_ANON_KEY,
        authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        ...(sessionToken ? { "x-session-token": sessionToken } : {}),
      },
      metadata: {
        bucketName: bucket,
        objectName: objectPath,
        contentType,
        cacheControl,
        metadata: JSON.stringify({}),
      },
      onError: (error) => reject(error),
      onProgress: (bytesUploaded, bytesTotal) => {
        if (!bytesTotal) return;
        onProgress?.(Math.min(1, Math.max(0, bytesUploaded / bytesTotal)));
      },
      onSuccess: () => resolve(),
    });

    upload.start();
  });
}
