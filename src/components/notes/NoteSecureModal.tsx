import React, { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Unlock } from 'lucide-react';

interface NoteSecureModalProps {
  isOpen: boolean;
  action: 'lock' | 'unlock' | null;
  password: string;
  onPasswordChange: (password: string) => void;
  onConfirm: () => void;
  onClose: () => void;
}

export const NoteSecureModal = memo(function NoteSecureModal({
  isOpen,
  action,
  password,
  onPasswordChange,
  onConfirm,
  onClose,
}: NoteSecureModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0.9 }}
            className="glass-card p-6 w-full max-w-sm"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              {action === 'lock' ? (
                <Lock className="w-6 h-6 text-primary" />
              ) : (
                <Unlock className="w-6 h-6 text-primary" />
              )}
              <h3 className="text-xl font-bold text-foreground">
                {action === 'lock' ? 'Notiz verschlüsseln' : 'Notiz entschlüsseln'}
              </h3>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              {action === 'lock' 
                ? 'Gib ein Passwort ein, um die Notiz zu verschlüsseln.' 
                : 'Gib das Passwort ein, um die Notiz zu entschlüsseln.'}
            </p>
            <input
              type="password"
              value={password}
              onChange={(e) => onPasswordChange(e.target.value)}
              placeholder="Passwort eingeben..."
              className="w-full px-4 py-3 rounded-xl vault-input text-foreground placeholder:text-muted-foreground mb-4"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && onConfirm()}
            />
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 py-3 rounded-xl border border-border text-foreground hover:bg-muted"
              >
                Abbrechen
              </button>
              <button
                onClick={onConfirm}
                disabled={!password}
                className="flex-1 py-3 rounded-xl bg-gradient-primary text-primary-foreground hover:shadow-glow disabled:opacity-50"
              >
                {action === 'lock' ? 'Verschlüsseln' : 'Entschlüsseln'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});

export default NoteSecureModal;
