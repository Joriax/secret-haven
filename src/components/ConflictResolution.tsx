import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  GitMerge, 
  ArrowLeft, 
  ArrowRight, 
  Check, 
  X,
  Clock,
  Cloud,
  Smartphone,
  AlertTriangle,
  FileText,
  Copy
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

export interface ConflictItem {
  id: string;
  type: 'note' | 'file' | 'photo' | 'link';
  title: string;
  localVersion: {
    content: string;
    updated_at: string;
    device?: string;
  };
  remoteVersion: {
    content: string;
    updated_at: string;
    device?: string;
  };
}

export type Resolution = 'local' | 'remote' | 'merge' | 'both';

interface ConflictResolutionProps {
  conflicts: ConflictItem[];
  onResolve: (resolutions: Map<string, Resolution>) => Promise<void>;
  onCancel: () => void;
  open: boolean;
}

function DiffView({ local, remote }: { local: string; remote: string }) {
  // Simple line-by-line diff
  const localLines = local.split('\n');
  const remoteLines = remote.split('\n');
  const maxLines = Math.max(localLines.length, remoteLines.length);

  return (
    <div className="grid grid-cols-2 gap-2 text-xs font-mono">
      <div className="space-y-0.5">
        <div className="text-muted-foreground text-[10px] uppercase mb-1">Lokal</div>
        {localLines.map((line, i) => {
          const isDifferent = line !== remoteLines[i];
          return (
            <div 
              key={i} 
              className={cn(
                "px-2 py-0.5 rounded",
                isDifferent ? "bg-green-500/20 text-green-400" : "text-muted-foreground"
              )}
            >
              {line || ' '}
            </div>
          );
        })}
      </div>
      <div className="space-y-0.5">
        <div className="text-muted-foreground text-[10px] uppercase mb-1">Server</div>
        {remoteLines.map((line, i) => {
          const isDifferent = line !== localLines[i];
          return (
            <div 
              key={i} 
              className={cn(
                "px-2 py-0.5 rounded",
                isDifferent ? "bg-blue-500/20 text-blue-400" : "text-muted-foreground"
              )}
            >
              {line || ' '}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ConflictCard({ 
  conflict, 
  resolution, 
  onResolve 
}: { 
  conflict: ConflictItem;
  resolution?: Resolution;
  onResolve: (resolution: Resolution) => void;
}) {
  const [showDiff, setShowDiff] = useState(false);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "border rounded-xl p-4 transition-colors",
        resolution ? "border-primary/50 bg-primary/5" : "border-border"
      )}
    >
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-yellow-500/20 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-yellow-400" />
          </div>
          <div>
            <h4 className="font-medium">{conflict.title}</h4>
            <p className="text-xs text-muted-foreground capitalize">{conflict.type}</p>
          </div>
        </div>
        {resolution && (
          <Badge variant="secondary" className="capitalize">
            {resolution === 'local' ? 'Lokal' : 
             resolution === 'remote' ? 'Server' :
             resolution === 'merge' ? 'Zusammenführen' : 'Beide'}
          </Badge>
        )}
      </div>

      {/* Version comparison */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className={cn(
          "p-3 rounded-lg border transition-all cursor-pointer",
          resolution === 'local' 
            ? "border-primary bg-primary/10" 
            : "border-border hover:border-primary/50"
        )}
        onClick={() => onResolve('local')}
        >
          <div className="flex items-center gap-2 mb-2">
            <Smartphone className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs font-medium">Lokal</span>
          </div>
          <p className="text-[10px] text-muted-foreground mb-2">
            {format(new Date(conflict.localVersion.updated_at), 'dd.MM.yy HH:mm', { locale: de })}
          </p>
          <p className="text-xs line-clamp-3 text-muted-foreground">
            {conflict.localVersion.content.slice(0, 150)}...
          </p>
        </div>

        <div className={cn(
          "p-3 rounded-lg border transition-all cursor-pointer",
          resolution === 'remote' 
            ? "border-primary bg-primary/10" 
            : "border-border hover:border-primary/50"
        )}
        onClick={() => onResolve('remote')}
        >
          <div className="flex items-center gap-2 mb-2">
            <Cloud className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs font-medium">Server</span>
          </div>
          <p className="text-[10px] text-muted-foreground mb-2">
            {format(new Date(conflict.remoteVersion.updated_at), 'dd.MM.yy HH:mm', { locale: de })}
          </p>
          <p className="text-xs line-clamp-3 text-muted-foreground">
            {conflict.remoteVersion.content.slice(0, 150)}...
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <Button 
          variant="outline" 
          size="sm" 
          className="flex-1"
          onClick={() => setShowDiff(!showDiff)}
        >
          <FileText className="w-3 h-3 mr-1" />
          {showDiff ? 'Diff ausblenden' : 'Diff anzeigen'}
        </Button>
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => onResolve('both')}
          className={cn(resolution === 'both' && "border-primary bg-primary/10")}
        >
          <Copy className="w-3 h-3 mr-1" />
          Beide
        </Button>
      </div>

      {/* Diff view */}
      <AnimatePresence>
        {showDiff && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-4 p-3 rounded-lg bg-muted/50 max-h-[200px] overflow-auto">
              <DiffView 
                local={conflict.localVersion.content} 
                remote={conflict.remoteVersion.content} 
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function ConflictResolution({ conflicts, onResolve, onCancel, open }: ConflictResolutionProps) {
  const [resolutions, setResolutions] = useState<Map<string, Resolution>>(new Map());
  const [isResolving, setIsResolving] = useState(false);

  const handleResolve = (id: string, resolution: Resolution) => {
    setResolutions(prev => new Map(prev).set(id, resolution));
  };

  const handleApply = async () => {
    if (resolutions.size !== conflicts.length) return;
    
    setIsResolving(true);
    try {
      await onResolve(resolutions);
    } finally {
      setIsResolving(false);
    }
  };

  const resolveAllLocal = () => {
    const newResolutions = new Map<string, Resolution>();
    conflicts.forEach(c => newResolutions.set(c.id, 'local'));
    setResolutions(newResolutions);
  };

  const resolveAllRemote = () => {
    const newResolutions = new Map<string, Resolution>();
    conflicts.forEach(c => newResolutions.set(c.id, 'remote'));
    setResolutions(newResolutions);
  };

  const resolvedCount = resolutions.size;
  const totalCount = conflicts.length;

  return (
    <Dialog open={open} onOpenChange={() => onCancel()}>
      <DialogContent className="max-w-2xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitMerge className="w-5 h-5 text-primary" />
            {totalCount} Sync-Konflikte
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center justify-between text-sm text-muted-foreground mb-4">
          <span>{resolvedCount} von {totalCount} aufgelöst</span>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={resolveAllLocal}>
              <ArrowLeft className="w-3 h-3 mr-1" />
              Alle lokal
            </Button>
            <Button variant="ghost" size="sm" onClick={resolveAllRemote}>
              <ArrowRight className="w-3 h-3 mr-1" />
              Alle Server
            </Button>
          </div>
        </div>

        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-3">
            {conflicts.map((conflict) => (
              <ConflictCard
                key={conflict.id}
                conflict={conflict}
                resolution={resolutions.get(conflict.id)}
                onResolve={(resolution) => handleResolve(conflict.id, resolution)}
              />
            ))}
          </div>
        </ScrollArea>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onCancel}>
            Abbrechen
          </Button>
          <Button 
            onClick={handleApply}
            disabled={resolvedCount !== totalCount || isResolving}
          >
            {isResolving ? (
              <Clock className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Check className="w-4 h-4 mr-2" />
            )}
            Konflikte auflösen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ConflictResolution;
