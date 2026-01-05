import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export interface DashboardWidget {
  id: string;
  type: 'quick-stats' | 'recent-activity' | 'quick-actions' | 'storage' | 'recently-viewed' | 'favorites' | 'custom-shortcut';
  title: string;
  order: number;
  visible: boolean;
  size: 'small' | 'medium' | 'large';
  config?: {
    path?: string;
    icon?: string;
    label?: string;
  };
}

const DEFAULT_WIDGETS: DashboardWidget[] = [
  { id: 'quick-stats', type: 'quick-stats', title: 'Statistiken', order: 0, visible: true, size: 'large' },
  { id: 'recent-activity', type: 'recent-activity', title: 'Kürzlich bearbeitet', order: 1, visible: true, size: 'large' },
  { id: 'quick-actions', type: 'quick-actions', title: 'Schnellzugriff', order: 2, visible: true, size: 'medium' },
  { id: 'storage', type: 'storage', title: 'Speicher', order: 3, visible: true, size: 'medium' },
  { id: 'recently-viewed', type: 'recently-viewed', title: 'Zuletzt angesehen', order: 4, visible: true, size: 'small' },
];

export function useDashboardWidgets() {
  const { userId } = useAuth();
  const [widgets, setWidgets] = useState<DashboardWidget[]>(DEFAULT_WIDGETS);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (!userId) return;
    
    const stored = localStorage.getItem(`dashboard-widgets-${userId}`);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        // Merge with defaults to handle new widget types
        const mergedWidgets = DEFAULT_WIDGETS.map(defaultWidget => {
          const storedWidget = parsed.find((w: DashboardWidget) => w.id === defaultWidget.id);
          return storedWidget || defaultWidget;
        });
        setWidgets(mergedWidgets.sort((a, b) => a.order - b.order));
      } catch {
        setWidgets(DEFAULT_WIDGETS);
      }
    }
  }, [userId]);

  const saveWidgets = (newWidgets: DashboardWidget[]) => {
    if (!userId) return;
    setWidgets(newWidgets);
    localStorage.setItem(`dashboard-widgets-${userId}`, JSON.stringify(newWidgets));
  };

  const moveWidget = (dragIndex: number, hoverIndex: number) => {
    const newWidgets = [...widgets];
    const [removed] = newWidgets.splice(dragIndex, 1);
    newWidgets.splice(hoverIndex, 0, removed);
    
    // Update order
    const reordered = newWidgets.map((w, idx) => ({ ...w, order: idx }));
    saveWidgets(reordered);
  };

  const toggleWidgetVisibility = (widgetId: string) => {
    const newWidgets = widgets.map(w => 
      w.id === widgetId ? { ...w, visible: !w.visible } : w
    );
    saveWidgets(newWidgets);
  };

  const resetToDefaults = () => {
    saveWidgets(DEFAULT_WIDGETS);
  };

  return {
    widgets: widgets.filter(w => w.visible || isEditing),
    allWidgets: widgets,
    isEditing,
    setIsEditing,
    moveWidget,
    toggleWidgetVisibility,
    resetToDefaults,
  };
}
