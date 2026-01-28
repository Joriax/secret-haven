import React, { useState, useCallback } from 'react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { ShieldAlert, Trash2, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SecureDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemName: string;
  itemType: 'photo' | 'file' | 'note' | 'link';
  onConfirm: (passes: number) => Promise<void>;
}

export function SecureDeleteDialog({
  open,
  onOpenChange,
  itemName,
  itemType,
  onConfirm,
}: SecureDeleteDialogProps) {
  const [pin, setPin] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [passes, setPasses] = useState(3);
  const [isDeleting, setIsDeleting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [understood, setUnderstood] = useState(false);

  const typeLabels: Record<string, string> = {
    photo: 'Foto',
    file: 'Datei',
    note: 'Notiz',
    link: 'Link',
  };

  const handleDelete = useCallback(async () => {
    if (confirmText !== 'LÖSCHEN' || !understood) return;

    setIsDeleting(true);
    setProgress(0);

    // Simulate secure overwrite passes
    for (let i = 0; i < passes; i++) {
      setProgress(((i + 1) / passes) * 100);
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    await onConfirm(passes);
    
    setIsDeleting(false);
    setPin('');
    setConfirmText('');
    setUnderstood(false);
    onOpenChange(false);
  }, [confirmText, understood, passes, onConfirm, onOpenChange]);

  const canDelete = confirmText === 'LÖSCHEN' && understood && !isDeleting;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <ShieldAlert className="w-5 h-5" />
            Sicheres Löschen
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                <div className="flex gap-2">
                  <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-destructive">Unwiderrufliche Aktion!</p>
                    <p className="text-muted-foreground mt-1">
                      Diese {typeLabels[itemType]} wird {passes}x überschrieben und kann 
                      NICHT wiederhergestellt werden. Auch nicht mit Forensik-Tools.
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-muted">
                <p className="text-sm font-medium truncate">{itemName}</p>
              </div>

              {/* Overwrite passes */}
              <div className="space-y-2">
                <Label>Überschreib-Durchgänge</Label>
                <div className="flex gap-2">
                  {[1, 3, 7].map((p) => (
                    <Button
                      key={p}
                      variant={passes === p ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setPasses(p)}
                      disabled={isDeleting}
                      className="flex-1"
                    >
                      {p}x
                    </Button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  {passes === 1 && 'Schnell, aber weniger sicher'}
                  {passes === 3 && 'DoD Standard (empfohlen)'}
                  {passes === 7 && 'Gutmann-Methode (sehr sicher)'}
                </p>
              </div>

              {/* Confirmation */}
              <div className="space-y-2">
                <Label>Tippe "LÖSCHEN" zur Bestätigung</Label>
                <Input
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
                  placeholder="LÖSCHEN"
                  disabled={isDeleting}
                  className={cn(
                    confirmText === 'LÖSCHEN' && 'border-destructive'
                  )}
                />
              </div>

              {/* Checkbox */}
              <div className="flex items-start gap-2">
                <Checkbox
                  id="understood"
                  checked={understood}
                  onCheckedChange={(checked) => setUnderstood(checked === true)}
                  disabled={isDeleting}
                />
                <Label htmlFor="understood" className="text-sm leading-relaxed cursor-pointer">
                  Ich verstehe, dass diese Aktion nicht rückgängig gemacht werden kann 
                  und die Daten permanent verloren sind.
                </Label>
              </div>

              {/* Progress */}
              {isDeleting && (
                <div className="space-y-2">
                  <Progress value={progress} className="h-2" />
                  <p className="text-sm text-center text-muted-foreground">
                    Überschreibe Daten... Durchgang {Math.ceil((progress / 100) * passes)}/{passes}
                  </p>
                </div>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isDeleting}
          >
            Abbrechen
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={!canDelete}
            className="gap-2"
          >
            <Trash2 className="w-4 h-4" />
            {isDeleting ? 'Lösche sicher...' : 'Sicher löschen'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default SecureDeleteDialog;
