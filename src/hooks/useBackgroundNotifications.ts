import { useState, useEffect, useCallback, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';

interface NotificationPayload {
  title: string;
  body: string;
  tag?: string;
  url?: string;
  delay?: number;
}

interface UseBackgroundNotificationsReturn {
  isSupported: boolean;
  permission: NotificationPermission;
  swRegistration: ServiceWorkerRegistration | null;
  requestPermission: () => Promise<boolean>;
  showNotification: (payload: NotificationPayload) => Promise<void>;
  scheduleNotification: (payload: NotificationPayload) => void;
  cacheRemindersForBackground: (reminders: any[]) => void;
  registerPeriodicSync: () => Promise<boolean>;
}

export function useBackgroundNotifications(): UseBackgroundNotificationsReturn {
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [swRegistration, setSwRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const { toast } = useToast();
  const initRef = useRef(false);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    const init = async () => {
      // Check support
      const notificationsSupported = 'Notification' in window;
      const swSupported = 'serviceWorker' in navigator;
      
      setIsSupported(notificationsSupported && swSupported);
      
      if (notificationsSupported) {
        setPermission(Notification.permission);
      }

      // Get service worker registration
      if (swSupported) {
        try {
          const registration = await navigator.serviceWorker.ready;
          setSwRegistration(registration);
        } catch (error) {
          console.error('SW registration failed:', error);
        }
      }
    };

    init();
  }, []);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!isSupported) {
      toast({
        title: "Nicht unterstützt",
        description: "Dein Browser unterstützt keine Push-Benachrichtigungen.",
        variant: "destructive"
      });
      return false;
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      
      if (result === 'granted') {
        toast({
          title: "Benachrichtigungen aktiviert",
          description: "Du erhältst jetzt Benachrichtigungen auch im Hintergrund."
        });
        return true;
      } else if (result === 'denied') {
        toast({
          title: "Benachrichtigungen blockiert",
          description: "Aktiviere Benachrichtigungen in den Browsereinstellungen.",
          variant: "destructive"
        });
      }
      return false;
    } catch (error) {
      console.error('Error requesting permission:', error);
      return false;
    }
  }, [isSupported, toast]);

  const showNotification = useCallback(async (payload: NotificationPayload): Promise<void> => {
    if (!isSupported || permission !== 'granted') return;

    try {
      // Use SW for better background support
      if (swRegistration) {
        await swRegistration.showNotification(payload.title, {
          body: payload.body,
          icon: '/pwa-192x192.png',
          badge: '/pwa-192x192.png',
          tag: payload.tag || 'phantomlock',
          data: { url: payload.url || '/dashboard' },
        } as NotificationOptions);
      } else {
        // Fallback to regular notification
        new Notification(payload.title, {
          body: payload.body,
          icon: '/pwa-192x192.png',
          tag: payload.tag,
        });
      }
    } catch (error) {
      console.error('Error showing notification:', error);
    }
  }, [isSupported, permission, swRegistration]);

  const scheduleNotification = useCallback((payload: NotificationPayload): void => {
    if (!swRegistration || permission !== 'granted') return;

    // Send message to SW to schedule notification
    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'SCHEDULE_NOTIFICATION',
        payload: {
          title: payload.title,
          body: payload.body,
          tag: payload.tag,
          url: payload.url,
          delay: payload.delay || 0,
        },
      });
    }
  }, [swRegistration, permission]);

  const cacheRemindersForBackground = useCallback((reminders: any[]): void => {
    if (!navigator.serviceWorker.controller) return;

    navigator.serviceWorker.controller.postMessage({
      type: 'CACHE_REMINDERS',
      payload: reminders,
    });
  }, []);

  const registerPeriodicSync = useCallback(async (): Promise<boolean> => {
    if (!swRegistration) return false;

    try {
      // Check if periodic sync is supported
      if ('periodicSync' in swRegistration) {
        const status = await navigator.permissions.query({
          name: 'periodic-background-sync' as PermissionName,
        });

        if (status.state === 'granted') {
          await (swRegistration as any).periodicSync.register('check-reminders', {
            minInterval: 60 * 60 * 1000, // 1 hour minimum
          });
          console.log('Periodic sync registered');
          return true;
        }
      }
      return false;
    } catch (error) {
      console.error('Error registering periodic sync:', error);
      return false;
    }
  }, [swRegistration]);

  return {
    isSupported,
    permission,
    swRegistration,
    requestPermission,
    showNotification,
    scheduleNotification,
    cacheRemindersForBackground,
    registerPeriodicSync,
  };
}

export default useBackgroundNotifications;
