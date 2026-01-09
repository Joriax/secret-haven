/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/react" />

// Wake Lock API types
interface WakeLockSentinel {
  readonly released: boolean;
  readonly type: 'screen';
  release(): Promise<void>;
  addEventListener(type: 'release', listener: EventListener): void;
  removeEventListener(type: 'release', listener: EventListener): void;
}

interface Navigator {
  wakeLock?: {
    request(type: 'screen'): Promise<WakeLockSentinel>;
  };
}
