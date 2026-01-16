import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings2, Trash2, Clock, AlertTriangle, Check, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface SecurityLogsSettingsProps {
  displayLimit: number;
  totalCount: number;
  onLimitChange: (limit: number) => void;
  onDeleteAll: () => Promise<boolean>;
  onDeleteOld: (days: number) => Promise<boolean>;
  onRefresh: () => void;
}

const limitOptions = [
  { value: 50, label: '50 Einträge' },
  { value: 100, label: '100 Einträge' },
  { value: 200, label: '200 Einträge' },
  { value: 500, label: '500 Einträge' },
  { value: 1000, label: '1000 Einträge' },
];

const deleteOldOptions = [
  { value: 7, label: 'Älter als 7 Tage' },
  { value: 30, label: 'Älter als 30 Tage' },
  { value: 90, label: 'Älter als 90 Tage' },
  { value: 180, label: 'Älter als 6 Monate' },
  { value: 365, label: 'Älter als 1 Jahr' },
];

export const SecurityLogsSettings = ({
  displayLimit,
  totalCount,
  onLimitChange,
  onDeleteAll,
  onDeleteOld,
  onRefresh,
}: SecurityLogsSettingsProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
  const [showDeleteOldConfirm, setShowDeleteOldConfirm] = useState(false);
  const [deleteOldDays, setDeleteOldDays] = useState(30);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteAll = async () => {
    setIsDeleting(true);
    const success = await onDeleteAll();
    setIsDeleting(false);
    setShowDeleteAllConfirm(false);
    
    if (success) {
      toast.success('Alle Protokolle wurden gelöscht');
      onRefresh();
    } else {
      toast.error('Fehler beim Löschen der Protokolle');
    }
  };

  const handleDeleteOld = async () => {
    setIsDeleting(true);
    const success = await onDeleteOld(deleteOldDays);
    setIsDeleting(false);
    setShowDeleteOldConfirm(false);
    
    if (success) {
      toast.success(`Protokolle älter als ${deleteOldDays} Tage wurden gelöscht`);
      onRefresh();
    } else {
      toast.error('Fehler beim Löschen der Protokolle');
    }
  };

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setIsOpen(true)}
        className="rounded-xl hover:bg-muted/50"
      >
        <Settings2 className="w-5 h-5" />
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="glass-card border-border/50 max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings2 className="w-5 h-5 text-primary" />
              Protokoll-Einstellungen
            </DialogTitle>
            <DialogDescription>
              Verwalte deine Sicherheitsprotokolle
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Display Limit */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Anzahl der angezeigten Protokolle
              </label>
              <Select
                value={displayLimit.toString()}
                onValueChange={(value) => onLimitChange(parseInt(value))}
              >
                <SelectTrigger className="glass-card border-border/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="glass-card border-border/50">
                  {limitOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value.toString()}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Insgesamt {totalCount} Protokolle gespeichert
              </p>
            </div>

            {/* Delete Actions */}
            <div className="space-y-3">
              <label className="text-sm font-medium text-foreground">
                Protokolle löschen
              </label>
              
              {/* Delete Old */}
              <div className="flex gap-2">
                <Select
                  value={deleteOldDays.toString()}
                  onValueChange={(value) => setDeleteOldDays(parseInt(value))}
                >
                  <SelectTrigger className="glass-card border-border/50 flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="glass-card border-border/50">
                    {deleteOldOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value.toString()}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  onClick={() => setShowDeleteOldConfirm(true)}
                  className="gap-2"
                >
                  <Clock className="w-4 h-4" />
                  Löschen
                </Button>
              </div>

              {/* Delete All */}
              <Button
                variant="destructive"
                onClick={() => setShowDeleteAllConfirm(true)}
                className="w-full gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Alle Protokolle löschen
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete All Confirmation */}
      <Dialog open={showDeleteAllConfirm} onOpenChange={setShowDeleteAllConfirm}>
        <DialogContent className="glass-card border-border/50 max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              Alle Protokolle löschen?
            </DialogTitle>
            <DialogDescription>
              Diese Aktion kann nicht rückgängig gemacht werden. 
              Alle {totalCount} Sicherheitsprotokolle werden dauerhaft gelöscht.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setShowDeleteAllConfirm(false)}
              disabled={isDeleting}
            >
              <X className="w-4 h-4 mr-2" />
              Abbrechen
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteAll}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4 mr-2" />
              )}
              Alle löschen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Old Confirmation */}
      <Dialog open={showDeleteOldConfirm} onOpenChange={setShowDeleteOldConfirm}>
        <DialogContent className="glass-card border-border/50 max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-500">
              <Clock className="w-5 h-5" />
              Alte Protokolle löschen?
            </DialogTitle>
            <DialogDescription>
              Alle Sicherheitsprotokolle, die älter als {deleteOldDays} Tage sind, 
              werden dauerhaft gelöscht.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setShowDeleteOldConfirm(false)}
              disabled={isDeleting}
            >
              <X className="w-4 h-4 mr-2" />
              Abbrechen
            </Button>
            <Button
              variant="default"
              onClick={handleDeleteOld}
              disabled={isDeleting}
              className="bg-amber-500 hover:bg-amber-600"
            >
              {isDeleting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Check className="w-4 h-4 mr-2" />
              )}
              Löschen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
