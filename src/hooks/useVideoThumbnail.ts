import { useCallback } from 'react';

export interface VideoThumbnailResult {
  thumbnail: Blob | null;
  duration: number;
}

/**
 * Format duration in seconds to MM:SS or HH:MM:SS
 */
export function formatDuration(seconds: number): string {
  if (!seconds || isNaN(seconds) || !isFinite(seconds)) return '0:00';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Hook for generating video thumbnails client-side
 * Extracts a frame from the video at a specified time and returns it as a Blob
 * Also returns video duration
 */
export function useVideoThumbnail() {
  /**
   * Generate thumbnail from a video File
   * Returns both the thumbnail blob and video duration
   */
  const generateThumbnail = useCallback(
    async (
      videoFile: File,
      timeInSeconds: number = 1,
      maxWidth: number = 640,
      maxHeight: number = 480
    ): Promise<VideoThumbnailResult> => {
      return new Promise((resolve) => {
        const video = document.createElement('video');
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          console.error('Could not get canvas context');
          resolve({ thumbnail: null, duration: 0 });
          return;
        }

        // Create object URL for the video file
        const videoUrl = URL.createObjectURL(videoFile);
        let duration = 0;

        video.preload = 'metadata';
        video.muted = true;
        video.playsInline = true;

        const cleanup = () => {
          URL.revokeObjectURL(videoUrl);
          video.remove();
          canvas.remove();
        };

        video.onloadedmetadata = () => {
          // Store duration
          duration = video.duration || 0;
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
              resolve({ thumbnail: blob, duration });
            },
            'image/jpeg',
            0.85
          );
        };

        video.onerror = () => {
          console.error('Error loading video for thumbnail');
          cleanup();
          resolve({ thumbnail: null, duration: 0 });
        };

        // Timeout fallback
        const timeout = setTimeout(() => {
          cleanup();
          resolve({ thumbnail: null, duration });
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

  /**
   * Generate thumbnail from a video URL
   * Returns both the thumbnail blob and video duration
   */
  const generateThumbnailFromUrl = useCallback(
    async (
      videoUrl: string,
      timeInSeconds: number = 1,
      maxWidth: number = 640,
      maxHeight: number = 480
    ): Promise<VideoThumbnailResult> => {
      return new Promise((resolve) => {
        const video = document.createElement('video');
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          console.error('Could not get canvas context');
          resolve({ thumbnail: null, duration: 0 });
          return;
        }

        let duration = 0;

        video.preload = 'metadata';
        video.muted = true;
        video.playsInline = true;
        video.crossOrigin = 'anonymous';

        const cleanup = () => {
          video.remove();
          canvas.remove();
        };

        video.onloadedmetadata = () => {
          duration = video.duration || 0;
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
              resolve({ thumbnail: blob, duration });
            },
            'image/jpeg',
            0.85
          );
        };

        video.onerror = () => {
          console.error('Error loading video for thumbnail');
          cleanup();
          resolve({ thumbnail: null, duration: 0 });
        };

        const timeout = setTimeout(() => {
          cleanup();
          resolve({ thumbnail: null, duration });
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

  /**
   * Extract only video duration from a File (faster, no thumbnail generation)
   */
  const getVideoDuration = useCallback(async (videoFile: File): Promise<number> => {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      const videoUrl = URL.createObjectURL(videoFile);

      video.preload = 'metadata';
      video.muted = true;

      video.onloadedmetadata = () => {
        const duration = video.duration || 0;
        URL.revokeObjectURL(videoUrl);
        video.remove();
        resolve(duration);
      };

      video.onerror = () => {
        URL.revokeObjectURL(videoUrl);
        video.remove();
        resolve(0);
      };

      const timeout = setTimeout(() => {
        URL.revokeObjectURL(videoUrl);
        video.remove();
        resolve(0);
      }, 5000);

      video.oncanplay = () => clearTimeout(timeout);

      video.src = videoUrl;
      video.load();
    });
  }, []);

  return { generateThumbnail, generateThumbnailFromUrl, getVideoDuration, formatDuration };
}
