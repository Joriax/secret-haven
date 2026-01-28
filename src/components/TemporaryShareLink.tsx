import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Clock, 
  Link2, 
  Copy, 
  Check, 
  Lock, 
  Eye, 
  EyeOff,
  Calendar,
  Hash,
  AlertTriangle,
  Settings2,
  QrCode
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { QuickQRCode } from './QRCodeGenerator';
import { cn } from '@/lib/utils';
import { useTempShares } from '@/hooks/useTempShares';

interface TemporaryShareLinkProps {
  itemId: string;
  itemType: 'photo' | 'file' | 'album' | 'note' | 'link';
  itemName: string;
  trigger?: React.ReactNode;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const EXPIRY_OPTIONS = [
  { value: 1, label: '1 Stunde' },
  { value: 6, label: '6 Stunden' },
  { value: 24, label: '1 Tag' },
  { value: 72, label: '3 Tage' },
  { value: 168, label: '1 Woche' },
  { value: 720, label: '30 Tage' },
];

export const TemporaryShareLink: React.FC<TemporaryShareLinkProps> = ({
  itemId,
  itemType,
  itemName,
  trigger,
  defaultOpen = false,
  onOpenChange
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  
  // Config state
  const [expiryHours, setExpiryHours] = useState(24);
  const [limitClicks, setLimitClicks] = useState(false);
  const [maxClicks, setMaxClicks] = useState(10);
  const [usePassword, setUsePassword] = useState(false);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showQR, setShowQR] = useState(false);

  const { createShareLink, isCreating } = useTempShares();

  const handleCreateLink = async () => {
    const link = await createShareLink({
      itemId,
      itemType,
      expiresInHours: expiryHours,
      maxClicks: limitClicks ? maxClicks : null,
      password: usePassword ? password : null,
    });

    if (link) {
      setShareLink(link);
      toast.success('Temporärer Link erstellt');
    }
  };

  const handleCopy = async () => {
    if (!shareLink) return;
    await navigator.clipboard.writeText(shareLink);
    setCopied(true);
    toast.success('Link kopiert');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleReset = () => {
    setShareLink(null);
    setExpiryHours(24);
    setLimitClicks(false);
    setMaxClicks(10);
    setUsePassword(false);
    setPassword('');
    setShowQR(false);
  };

  const getExpiryLabel = (hours: number) => {
    return EXPIRY_OPTIONS.find(o => o.value === hours)?.label || `${hours} Stunden`;
  };

  const getExpiryDate = (hours: number) => {
    const date = new Date();
    date.setHours(date.getHours() + hours);
    return date.toLocaleString('de-DE', { 
      dateStyle: 'medium', 
      timeStyle: 'short' 
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); onOpenChange?.(open); if (!open) handleReset(); }}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-2">
            <Clock className="w-4 h-4" />
            Temporär teilen
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            Temporären Link erstellen
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 pt-4">
          {/* Item Info */}
          <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
            <Link2 className="w-5 h-5 text-muted-foreground" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{itemName}</p>
              <p className="text-xs text-muted-foreground capitalize">{itemType}</p>
            </div>
          </div>

          {!shareLink ? (
            <>
              {/* Expiry Setting */}
              <div className="space-y-3">
                <Label className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Gültigkeitsdauer
                </Label>
                <div className="grid grid-cols-3 gap-2">
                  {EXPIRY_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setExpiryHours(option.value)}
                      className={cn(
                        "px-3 py-2 rounded-lg text-sm font-medium transition-all",
                        expiryHours === option.value
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted hover:bg-muted/80 text-foreground"
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Läuft ab: {getExpiryDate(expiryHours)}
                </p>
              </div>

              {/* Click Limit */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2">
                    <Hash className="w-4 h-4" />
                    Klick-Limit
                  </Label>
                  <Switch checked={limitClicks} onCheckedChange={setLimitClicks} />
                </div>
                
                <AnimatePresence>
                  {limitClicks && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Max. Aufrufe:</span>
                        <span className="text-sm font-medium text-primary">{maxClicks}</span>
                      </div>
                      <Slider
                        value={[maxClicks]}
                        onValueChange={([v]) => setMaxClicks(v)}
                        min={1}
                        max={100}
                        step={1}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Password Protection */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2">
                    <Lock className="w-4 h-4" />
                    Passwortschutz
                  </Label>
                  <Switch checked={usePassword} onCheckedChange={setUsePassword} />
                </div>
                
                <AnimatePresence>
                  {usePassword && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                    >
                      <div className="relative">
                        <Input
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Passwort eingeben..."
                          className="pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Create Button */}
              <Button
                className="w-full"
                onClick={handleCreateLink}
                disabled={isCreating || (usePassword && !password)}
              >
                {isCreating ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  >
                    <Settings2 className="w-4 h-4 mr-2" />
                  </motion.div>
                ) : (
                  <Link2 className="w-4 h-4 mr-2" />
                )}
                Link erstellen
              </Button>
            </>
          ) : (
            <>
              {/* Generated Link */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                  <p className="text-sm text-green-400 flex items-center gap-2 mb-2">
                    <Check className="w-4 h-4" />
                    Link wurde erstellt!
                  </p>
                  <code className="text-xs text-foreground break-all">{shareLink}</code>
                </div>

                {/* Link Info */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="w-4 h-4" />
                    <span>{getExpiryLabel(expiryHours)}</span>
                  </div>
                  {limitClicks && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Hash className="w-4 h-4" />
                      <span>{maxClicks} Klicks</span>
                    </div>
                  )}
                  {usePassword && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Lock className="w-4 h-4" />
                      <span>Passwortgeschützt</span>
                    </div>
                  )}
                </div>

                {/* QR Code Toggle */}
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setShowQR(!showQR)}
                >
                  <QrCode className="w-4 h-4 mr-2" />
                  {showQR ? 'QR-Code verbergen' : 'QR-Code anzeigen'}
                </Button>

                <AnimatePresence>
                  {showQR && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="flex justify-center"
                    >
                      <QuickQRCode url={shareLink} size={150} />
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Actions */}
                <div className="flex gap-2">
                  <Button className="flex-1" onClick={handleCopy}>
                    {copied ? (
                      <Check className="w-4 h-4 mr-2 text-green-500" />
                    ) : (
                      <Copy className="w-4 h-4 mr-2" />
                    )}
                    Kopieren
                  </Button>
                  <Button variant="outline" onClick={handleReset}>
                    Neuer Link
                  </Button>
                </div>

                {/* Warning */}
                <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                  <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-200">
                    Jeder mit diesem Link kann auf das Element zugreifen. 
                    Teile ihn nur mit vertrauenswürdigen Personen.
                  </p>
                </div>
              </motion.div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
