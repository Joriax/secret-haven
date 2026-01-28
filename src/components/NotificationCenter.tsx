import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Bell, 
  X, 
  Check, 
  CheckCheck,
  Trash2,
  AlertCircle,
  Calendar,
  Shield,
  Share2,
  Cloud,
  Settings,
  ChevronRight,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useNotifications, Notification } from '@/hooks/useNotifications';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';

const typeIcons: Record<string, React.ReactNode> = {
  reminder: <Calendar className="w-4 h-4" />,
  security: <Shield className="w-4 h-4" />,
  system: <Settings className="w-4 h-4" />,
  share: <Share2 className="w-4 h-4" />,
  backup: <Cloud className="w-4 h-4" />,
};

const typeColors: Record<string, string> = {
  reminder: 'bg-blue-500/20 text-blue-400',
  security: 'bg-red-500/20 text-red-400',
  system: 'bg-gray-500/20 text-gray-400',
  share: 'bg-purple-500/20 text-purple-400',
  backup: 'bg-green-500/20 text-green-400',
};

function NotificationItem({ 
  notification, 
  onMarkRead, 
  onDelete,
  onNavigate 
}: { 
  notification: Notification;
  onMarkRead: (id: string) => void;
  onDelete: (id: string) => void;
  onNavigate: (url: string) => void;
}) {
  const handleClick = () => {
    if (!notification.is_read) {
      onMarkRead(notification.id);
    }
    if (notification.action_url) {
      onNavigate(notification.action_url);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -50 }}
      className={cn(
        "flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors group",
        notification.is_read 
          ? "bg-muted/30 hover:bg-muted/50" 
          : "bg-primary/5 hover:bg-primary/10"
      )}
      onClick={handleClick}
    >
      <div className={cn(
        "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
        typeColors[notification.type] || 'bg-muted text-muted-foreground'
      )}>
        {typeIcons[notification.type] || <AlertCircle className="w-4 h-4" />}
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className={cn(
            "text-sm",
            notification.is_read ? "text-muted-foreground" : "text-foreground font-medium"
          )}>
            {notification.title}
          </p>
          {!notification.is_read && (
            <div className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1.5" />
          )}
        </div>
        {notification.message && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
            {notification.message}
          </p>
        )}
        <p className="text-[10px] text-muted-foreground mt-1">
          {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true, locale: de })}
        </p>
      </div>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {!notification.is_read && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={(e) => {
              e.stopPropagation();
              onMarkRead(notification.id);
            }}
          >
            <Check className="w-3 h-3" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-destructive hover:text-destructive"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(notification.id);
          }}
        >
          <Trash2 className="w-3 h-3" />
        </Button>
        {notification.action_url && (
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        )}
      </div>
    </motion.div>
  );
}

export function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { 
    notifications, 
    unreadCount, 
    isLoading,
    markAsRead, 
    markAllAsRead, 
    deleteNotification,
    clearAll 
  } = useNotifications();

  const handleNavigate = (url: string) => {
    setOpen(false);
    navigate(url);
  };

  const filterByType = (type: string | null) => {
    if (!type) return notifications;
    return notifications.filter(n => n.type === type);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 min-w-[20px] px-1 text-[10px] flex items-center justify-center"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      
      <PopoverContent className="w-[380px] p-0" align="end">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-sm">Benachrichtigungen</h3>
            {unreadCount > 0 && (
              <Badge variant="secondary" className="text-[10px]">
                {unreadCount} neu
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-7 text-xs gap-1"
                onClick={markAllAsRead}
              >
                <CheckCheck className="w-3 h-3" />
                Alle lesen
              </Button>
            )}
          </div>
        </div>

        <Tabs defaultValue="all" className="w-full">
          <TabsList className="w-full justify-start rounded-none border-b border-border bg-transparent h-auto p-0 px-4">
            <TabsTrigger value="all" className="text-xs py-2 rounded-none border-b-2 border-transparent data-[state=active]:border-primary">
              Alle
            </TabsTrigger>
            <TabsTrigger value="unread" className="text-xs py-2 rounded-none border-b-2 border-transparent data-[state=active]:border-primary">
              Ungelesen
            </TabsTrigger>
            <TabsTrigger value="security" className="text-xs py-2 rounded-none border-b-2 border-transparent data-[state=active]:border-primary">
              Sicherheit
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="h-[350px]">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <TabsContent value="all" className="m-0 p-2 space-y-1">
                  <AnimatePresence mode="popLayout">
                    {notifications.length === 0 ? (
                      <div className="text-center py-12">
                        <Bell className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-50" />
                        <p className="text-sm text-muted-foreground">Keine Benachrichtigungen</p>
                      </div>
                    ) : (
                      notifications.map(notification => (
                        <NotificationItem
                          key={notification.id}
                          notification={notification}
                          onMarkRead={markAsRead}
                          onDelete={deleteNotification}
                          onNavigate={handleNavigate}
                        />
                      ))
                    )}
                  </AnimatePresence>
                </TabsContent>

                <TabsContent value="unread" className="m-0 p-2 space-y-1">
                  <AnimatePresence mode="popLayout">
                    {notifications.filter(n => !n.is_read).length === 0 ? (
                      <div className="text-center py-12">
                        <CheckCheck className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-50" />
                        <p className="text-sm text-muted-foreground">Alles gelesen!</p>
                      </div>
                    ) : (
                      notifications.filter(n => !n.is_read).map(notification => (
                        <NotificationItem
                          key={notification.id}
                          notification={notification}
                          onMarkRead={markAsRead}
                          onDelete={deleteNotification}
                          onNavigate={handleNavigate}
                        />
                      ))
                    )}
                  </AnimatePresence>
                </TabsContent>

                <TabsContent value="security" className="m-0 p-2 space-y-1">
                  <AnimatePresence mode="popLayout">
                    {filterByType('security').length === 0 ? (
                      <div className="text-center py-12">
                        <Shield className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-50" />
                        <p className="text-sm text-muted-foreground">Keine Sicherheitswarnungen</p>
                      </div>
                    ) : (
                      filterByType('security').map(notification => (
                        <NotificationItem
                          key={notification.id}
                          notification={notification}
                          onMarkRead={markAsRead}
                          onDelete={deleteNotification}
                          onNavigate={handleNavigate}
                        />
                      ))
                    )}
                  </AnimatePresence>
                </TabsContent>
              </>
            )}
          </ScrollArea>
        </Tabs>

        {notifications.length > 0 && (
          <div className="p-2 border-t border-border">
            <Button 
              variant="ghost" 
              size="sm" 
              className="w-full h-8 text-xs text-destructive hover:text-destructive"
              onClick={clearAll}
            >
              <Trash2 className="w-3 h-3 mr-1" />
              Alle löschen
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

export default NotificationCenter;
