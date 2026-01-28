import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Layout, 
  Zap, 
  Image, 
  BarChart3, 
  Download, 
  Upload, 
  Check,
  Sparkles,
  Moon,
  FileText,
  Lock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { DashboardWidget } from '@/hooks/useDashboardWidgets';

interface DashboardPreset {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  widgets: Pick<DashboardWidget, 'id' | 'type' | 'order' | 'size' | 'visible'>[];
  isSystem?: boolean;
}

const SYSTEM_PRESETS: DashboardPreset[] = [
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'Nur die wichtigsten Widgets',
    icon: <Moon className="w-5 h-5" />,
    isSystem: true,
    widgets: [
      { id: 'quick-capture', type: 'quick-capture', order: 0, size: 'large', visible: true },
      { id: 'quick-actions', type: 'quick-actions', order: 1, size: 'medium', visible: true },
      { id: 'favorites', type: 'favorites', order: 2, size: 'medium', visible: true },
    ],
  },
  {
    id: 'productivity',
    name: 'Produktivität',
    description: 'Fokus auf Notizen und Aufgaben',
    icon: <Zap className="w-5 h-5" />,
    isSystem: true,
    widgets: [
      { id: 'quick-capture', type: 'quick-capture', order: 0, size: 'large', visible: true },
      { id: 'recent-activity', type: 'recent-activity', order: 1, size: 'large', visible: true },
      { id: 'quick-stats', type: 'quick-stats', order: 2, size: 'medium', visible: true },
      { id: 'favorites', type: 'favorites', order: 3, size: 'medium', visible: true },
      { id: 'recently-viewed', type: 'recently-viewed', order: 4, size: 'small', visible: true },
    ],
  },
  {
    id: 'media',
    name: 'Media Focus',
    description: 'Schwerpunkt auf Fotos und Dateien',
    icon: <Image className="w-5 h-5" />,
    isSystem: true,
    widgets: [
      { id: 'recent-activity', type: 'recent-activity', order: 0, size: 'large', visible: true },
      { id: 'storage', type: 'storage', order: 1, size: 'large', visible: true },
      { id: 'favorites', type: 'favorites', order: 2, size: 'medium', visible: true },
      { id: 'recently-viewed', type: 'recently-viewed', order: 3, size: 'medium', visible: true },
    ],
  },
  {
    id: 'analytics',
    name: 'Analytics',
    description: 'Statistiken und Übersichten',
    icon: <BarChart3 className="w-5 h-5" />,
    isSystem: true,
    widgets: [
      { id: 'quick-stats', type: 'quick-stats', order: 0, size: 'large', visible: true },
      { id: 'storage', type: 'storage', order: 1, size: 'medium', visible: true },
      { id: 'recent-activity', type: 'recent-activity', order: 2, size: 'medium', visible: true },
      { id: 'recently-viewed', type: 'recently-viewed', order: 3, size: 'small', visible: true },
    ],
  },
  {
    id: 'secure',
    name: 'Sicherheit',
    description: 'Fokus auf Datenschutz-Features',
    icon: <Lock className="w-5 h-5" />,
    isSystem: true,
    widgets: [
      { id: 'quick-stats', type: 'quick-stats', order: 0, size: 'large', visible: true },
      { id: 'recent-activity', type: 'recent-activity', order: 1, size: 'medium', visible: true },
      { id: 'quick-capture', type: 'quick-capture', order: 2, size: 'medium', visible: true },
    ],
  },
];

const STORAGE_KEY = 'dashboard-custom-presets';

interface DashboardPresetsProps {
  currentWidgets: DashboardWidget[];
  onApplyPreset: (widgets: Pick<DashboardWidget, 'id' | 'type' | 'order' | 'size' | 'visible'>[]) => void;
}

export function DashboardPresets({ currentWidgets, onApplyPreset }: DashboardPresetsProps) {
  const [customPresets, setCustomPresets] = useState<DashboardPreset[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);

  const allPresets = [...SYSTEM_PRESETS, ...customPresets];

  const saveCustomPreset = () => {
    if (!newPresetName.trim()) {
      toast.error('Bitte gib einen Namen ein');
      return;
    }

    const newPreset: DashboardPreset = {
      id: `custom-${Date.now()}`,
      name: newPresetName,
      description: 'Eigenes Layout',
      icon: <FileText className="w-5 h-5" />,
      widgets: currentWidgets.map(w => ({
        id: w.id,
        type: w.type,
        order: w.order,
        size: w.size,
        visible: w.visible,
      })),
    };

    const updated = [...customPresets, newPreset];
    setCustomPresets(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    
    setShowSaveDialog(false);
    setNewPresetName('');
    toast.success('Layout gespeichert');
  };

  const deleteCustomPreset = (id: string) => {
    const updated = customPresets.filter(p => p.id !== id);
    setCustomPresets(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    toast.success('Layout gelöscht');
  };

  const exportPresets = () => {
    const data = JSON.stringify({ presets: customPresets, exportedAt: new Date().toISOString() }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'dashboard-presets.json';
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Presets exportiert');
  };

  const importPresets = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (data.presets && Array.isArray(data.presets)) {
          const imported = data.presets.map((p: DashboardPreset) => ({
            ...p,
            id: `imported-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            icon: <FileText className="w-5 h-5" />,
          }));
          const updated = [...customPresets, ...imported];
          setCustomPresets(updated);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
          toast.success(`${imported.length} Presets importiert`);
        }
      } catch {
        toast.error('Ungültige Datei');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layout className="w-5 h-5 text-primary" />
          <h3 className="font-medium text-foreground">Layout-Presets</h3>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowSaveDialog(true)}
          >
            <Sparkles className="w-4 h-4 mr-1" />
            Aktuelles speichern
          </Button>
        </div>
      </div>

      {/* Preset Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {allPresets.map((preset) => (
          <motion.button
            key={preset.id}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              setSelectedPreset(preset.id);
              onApplyPreset(preset.widgets);
              toast.success(`"${preset.name}" angewendet`);
            }}
            className={cn(
              "relative p-4 rounded-xl border-2 text-left transition-all group",
              selectedPreset === preset.id
                ? "border-primary bg-primary/10"
                : "border-border hover:border-primary/50"
            )}
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="text-primary">{preset.icon}</div>
              <span className="font-medium text-sm">{preset.name}</span>
              {preset.isSystem && (
                <span className="text-[10px] px-1.5 py-0.5 bg-muted rounded">System</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{preset.description}</p>
            <p className="text-[10px] text-muted-foreground/60 mt-1">
              {preset.widgets.length} Widgets
            </p>

            {selectedPreset === preset.id && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute top-2 right-2"
              >
                <Check className="w-4 h-4 text-primary" />
              </motion.div>
            )}

            {/* Delete button for custom presets */}
            {!preset.isSystem && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteCustomPreset(preset.id);
                }}
                className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all"
              >
                ×
              </button>
            )}
          </motion.button>
        ))}
      </div>

      {/* Import/Export */}
      <div className="flex items-center gap-2 pt-2 border-t border-border">
        <Button size="sm" variant="ghost" onClick={exportPresets}>
          <Download className="w-4 h-4 mr-1" />
          Exportieren
        </Button>
        <label>
          <Button size="sm" variant="ghost" asChild>
            <span>
              <Upload className="w-4 h-4 mr-1" />
              Importieren
            </span>
          </Button>
          <input
            type="file"
            accept=".json"
            className="hidden"
            onChange={importPresets}
          />
        </label>
      </div>

      {/* Save Dialog */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Layout speichern</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="preset-name">Name</Label>
              <Input
                id="preset-name"
                placeholder="Mein Layout"
                value={newPresetName}
                onChange={(e) => setNewPresetName(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowSaveDialog(false)}>
                Abbrechen
              </Button>
              <Button onClick={saveCustomPreset}>
                Speichern
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default DashboardPresets;
