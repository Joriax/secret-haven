import { useCallback } from 'react';

/**
 * Hook for generating video thumbnails client-side
 * Extracts a frame from the video at a specified time and returns it as a Blob
 */
export function useVideoThumbnail() {
  const generateThumbnail = useCallback(
    async (
      videoFile: File,
      timeInSeconds: number = 1,
      maxWidth: number = 640,
      maxHeight: number = 480
    ): Promise<Blob | null> => {
      return new Promise((resolve) => {
        const video = document.createElement('video');
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          console.error('Could not get canvas context');
          resolve(null);
          return;
        }

        // Create object URL for the video file
        const videoUrl = URL.createObjectURL(videoFile);

        video.preload = 'metadata';
        video.muted = true;
        video.playsInline = true;

        const cleanup = () => {
          URL.revokeObjectURL(videoUrl);
          video.remove();
          canvas.remove();
        };

        video.onloadedmetadata = () => {
          // Seek to the specified time, but not beyond duration
          const seekTime = Math.min(timeInSeconds, video.duration * 0.1 || 1);
          video.currentTime = seekTime;
        };

        video.onseeked = () => {
          // Calculate dimensions while maintaining aspect ratio
          let width = video.videoWidth;
          let height = video.videoHeight;

          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }
          if (height > maxHeight) {
            width = (width * maxHeight) / height;
            height = maxHeight;
          }

          canvas.width = width;
          canvas.height = height;

          // Draw the video frame to the canvas
          ctx.drawImage(video, 0, 0, width, height);

          // Convert canvas to blob
          canvas.toBlob(
            (blob) => {
              cleanup();
              resolve(blob);
            },
            'image/jpeg',
            0.85
          );
        };

        video.onerror = () => {
          console.error('Error loading video for thumbnail');
          cleanup();
          resolve(null);
        };

        // Timeout fallback
        const timeout = setTimeout(() => {
          cleanup();
          resolve(null);
        }, 10000);

        video.oncanplay = () => {
          clearTimeout(timeout);
        };

        video.src = videoUrl;
        video.load();
      });
    },
    []
  );

  const generateThumbnailFromUrl = useCallback(
    async (
      videoUrl: string,
      timeInSeconds: number = 1,
      maxWidth: number = 640,
      maxHeight: number = 480
    ): Promise<Blob | null> => {
      return new Promise((resolve) => {
        const video = document.createElement('video');
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          console.error('Could not get canvas context');
          resolve(null);
          return;
        }

        video.preload = 'metadata';
        video.muted = true;
        video.playsInline = true;
        video.crossOrigin = 'anonymous';

        const cleanup = () => {
          video.remove();
          canvas.remove();
        };

        video.onloadedmetadata = () => {
          const seekTime = Math.min(timeInSeconds, video.duration * 0.1 || 1);
          video.currentTime = seekTime;
        };

        video.onseeked = () => {
          let width = video.videoWidth;
          let height = video.videoHeight;

          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }
          if (height > maxHeight) {
            width = (width * maxHeight) / height;
            height = maxHeight;
          }

          canvas.width = width;
          canvas.height = height;
          ctx.drawImage(video, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              cleanup();
              resolve(blob);
            },
            'image/jpeg',
            0.85
          );
        };

        video.onerror = () => {
          console.error('Error loading video for thumbnail');
          cleanup();
          resolve(null);
        };

        const timeout = setTimeout(() => {
          cleanup();
          resolve(null);
        }, 10000);

        video.oncanplay = () => {
          clearTimeout(timeout);
        };

        video.src = videoUrl;
        video.load();
      });
    },
    []
  );

  return { generateThumbnail, generateThumbnailFromUrl };
}
