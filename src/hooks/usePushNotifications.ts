import { useState, useEffect, useCallback, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useBackgroundNotifications } from './useBackgroundNotifications';

export const usePushNotifications = () => {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSupported, setIsSupported] = useState(false);
  const { toast } = useToast();
  const { 
    swRegistration, 
    showNotification: bgShowNotification,
    scheduleNotification,
    cacheRemindersForBackground,
    registerPeriodicSync 
  } = useBackgroundNotifications();
  const initRef = useRef(false);
  const scheduledRemindersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

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
        
        // Try to register periodic sync for background notifications
        await registerPeriodicSync();
        
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
  }, [isSupported, toast, registerPeriodicSync]);

  const showNotification = useCallback((title: string, options?: NotificationOptions) => {
    if (!isSupported || permission !== 'granted') {
      return;
    }

    // Use background notifications hook for better SW support
    bgShowNotification({
      title,
      body: options?.body || '',
      tag: options?.tag,
    });
  }, [isSupported, permission, bgShowNotification]);

  const scheduleBreakReminder = useCallback((time: string): NodeJS.Timeout | null => {
    if (!isSupported || permission !== 'granted') return null;

    // Clear existing reminder for this time
    const existingTimeout = scheduledRemindersRef.current.get(time);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    const [hours, minutes] = time.split(':').map(Number);
    const now = new Date();
    const scheduledTime = new Date(now);
    scheduledTime.setHours(hours, minutes, 0, 0);

    // If the time has passed today, schedule for tomorrow
    if (scheduledTime <= now) {
      scheduledTime.setDate(scheduledTime.getDate() + 1);
    }

    const timeUntilReminder = scheduledTime.getTime() - now.getTime();

    // For times less than 5 minutes, use SW scheduled notification
    if (timeUntilReminder < 5 * 60 * 1000 && swRegistration) {
      scheduleNotification({
        title: 'Pausen-Erinnerung ☕',
        body: 'Zeit für deine Pause! Vergiss nicht, sie zu tracken.',
        tag: 'break-reminder',
        delay: timeUntilReminder,
      });
      return null;
    }

    // For longer times, use setTimeout but also cache for background sync
    const timeoutId = setTimeout(() => {
      showNotification('Pausen-Erinnerung ☕', {
        body: 'Zeit für deine Pause! Vergiss nicht, sie zu tracken.',
        tag: 'break-reminder',
        requireInteraction: true
      });
      
      // Reschedule for next day
      scheduleBreakReminder(time);
    }, timeUntilReminder);

    scheduledRemindersRef.current.set(time, timeoutId);

    return timeoutId;
  }, [isSupported, permission, swRegistration, scheduleNotification, showNotification]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      scheduledRemindersRef.current.forEach(timeout => clearTimeout(timeout));
      scheduledRemindersRef.current.clear();
    };
  }, []);

  return {
    isSupported,
    permission,
    requestPermission,
    showNotification,
    scheduleBreakReminder,
    cacheRemindersForBackground,
    swRegistration,
  };
};
