import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Bell, BellOff, Clock, AlertCircle, CheckCircle, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { BreakSettings } from '@/hooks/useBreakTracker';

interface NotificationSettingsProps {
  settings: BreakSettings | null;
  onUpdateSettings: (settings: Partial<BreakSettings>) => Promise<void>;
}

export const NotificationSettings: React.FC<NotificationSettingsProps> = ({
  settings,
  onUpdateSettings
}) => {
  const [open, setOpen] = useState(false);
  const [reminderTime, setReminderTime] = useState(settings?.reminder_time || '12:00');
  const { 
    isSupported, 
    permission, 
    requestPermission, 
    scheduleBreakReminder,
    swRegistration 
  } = usePushNotifications();
  const scheduledRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (settings?.reminder_time) {
      setReminderTime(settings.reminder_time);
    }
  }, [settings?.reminder_time]);

  // Schedule reminder when settings change
  useEffect(() => {
    if (settings?.reminder_enabled && permission === 'granted' && settings?.reminder_time) {
      if (scheduledRef.current) {
        clearTimeout(scheduledRef.current);
      }
      const timeoutId = scheduleBreakReminder(settings.reminder_time);
      scheduledRef.current = timeoutId;
    }

    return () => {
      if (scheduledRef.current) {
        clearTimeout(scheduledRef.current);
      }
    };
  }, [settings?.reminder_enabled, settings?.reminder_time, permission, scheduleBreakReminder]);

  const handleEnableReminder = async (enabled: boolean) => {
    if (enabled && permission !== 'granted') {
      const granted = await requestPermission();
      if (!granted) return;
    }
    await onUpdateSettings({ reminder_enabled: enabled });
  };

  const handleSaveSettings = async () => {
    await onUpdateSettings({
      reminder_enabled: settings?.reminder_enabled ?? true,
      reminder_time: reminderTime
    });
    setOpen(false);
  };

  const handleTestNotification = () => {
    if (permission === 'granted') {
      new Notification('Pausen-Erinnerung ☕', {
        body: 'Dies ist eine Testbenachrichtigung. Zeit für deine Pause!',
        icon: '/pwa-192x192.png',
        tag: 'break-reminder-test'
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          {settings?.reminder_enabled ? (
            <Bell className="h-4 w-4" />
          ) : (
            <BellOff className="h-4 w-4" />
          )}
          Erinnerung
          {settings?.reminder_enabled && permission === 'granted' && (
            <Badge variant="secondary" className="ml-1 bg-green-500/10 text-green-600 text-xs">
              Aktiv
            </Badge>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Erinnerungseinstellungen
          </DialogTitle>
          <DialogDescription>
            Lass dich täglich an deine Pause erinnern
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* Browser Support Info */}
          {!isSupported && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Dein Browser unterstützt keine Push-Benachrichtigungen.
              </AlertDescription>
            </Alert>
          )}

          {isSupported && permission === 'denied' && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Benachrichtigungen wurden blockiert. Aktiviere sie in deinen Browsereinstellungen.
              </AlertDescription>
            </Alert>
          )}

          {isSupported && permission === 'granted' && settings?.reminder_enabled && (
            <Alert className="border-green-500/20 bg-green-500/10">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <AlertDescription className="text-green-700 dark:text-green-400">
                Benachrichtigungen sind aktiviert. Du erhältst um {settings.reminder_time} Uhr eine Erinnerung.
              </AlertDescription>
            </Alert>
          )}

          {/* Enable/Disable Switch */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Tägliche Erinnerung</Label>
              <p className="text-sm text-muted-foreground">
                Erhalte eine Benachrichtigung zur Pausenzeit
              </p>
            </div>
            <Switch
              checked={settings?.reminder_enabled ?? false}
              onCheckedChange={handleEnableReminder}
              disabled={!isSupported}
            />
          </div>
          
          {/* Time Picker */}
          {settings?.reminder_enabled && (
            <div className="space-y-2">
              <Label htmlFor="reminder-time" className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Uhrzeit
              </Label>
              <Input
                id="reminder-time"
                type="time"
                value={reminderTime}
                onChange={(e) => setReminderTime(e.target.value)}
                className="w-32"
              />
              <p className="text-xs text-muted-foreground">
                Die Erinnerung wird nur gesendet, wenn der Browser/Tab geöffnet ist.
              </p>
            </div>
          )}

          {/* Test Button */}
          {permission === 'granted' && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleTestNotification}
              className="w-full"
            >
              Testbenachrichtigung senden
            </Button>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Abbrechen
          </Button>
          <Button onClick={handleSaveSettings}>
            Speichern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
