import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';

export const usePushNotifications = () => {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSupported, setIsSupported] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const supported = 'Notification' in window && 'serviceWorker' in navigator;
    setIsSupported(supported);
    
    if (supported) {
      setPermission(Notification.permission);
    }
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
          description: "Du erhältst jetzt Erinnerungen für deine Pausen."
        });
        return true;
      } else if (result === 'denied') {
        toast({
          title: "Benachrichtigungen blockiert",
          description: "Du hast Benachrichtigungen blockiert. Aktiviere sie in den Browsereinstellungen.",
          variant: "destructive"
        });
        return false;
      }
      return false;
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    }
  }, [isSupported, toast]);

  const showNotification = useCallback((title: string, options?: NotificationOptions) => {
    if (!isSupported || permission !== 'granted') {
      return;
    }

    try {
      new Notification(title, {
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        ...options
      });
    } catch (error) {
      console.error('Error showing notification:', error);
    }
  }, [isSupported, permission]);

  const scheduleBreakReminder = useCallback((time: string) => {
    if (!isSupported || permission !== 'granted') return null;

    const [hours, minutes] = time.split(':').map(Number);
    const now = new Date();
    const scheduledTime = new Date(now);
    scheduledTime.setHours(hours, minutes, 0, 0);

    // If the time has passed today, schedule for tomorrow
    if (scheduledTime <= now) {
      scheduledTime.setDate(scheduledTime.getDate() + 1);
    }

    const timeUntilReminder = scheduledTime.getTime() - now.getTime();

    const timeoutId = setTimeout(() => {
      showNotification('Pausen-Erinnerung ☕', {
        body: 'Zeit für deine Pause! Vergiss nicht, sie zu tracken.',
        tag: 'break-reminder',
        requireInteraction: true
      });
      
      // Reschedule for next day
      scheduleBreakReminder(time);
    }, timeUntilReminder);

    return timeoutId;
  }, [isSupported, permission, showNotification]);

  return {
    isSupported,
    permission,
    requestPermission,
    showNotification,
    scheduleBreakReminder
  };
};
