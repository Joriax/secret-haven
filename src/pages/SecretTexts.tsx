import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Lock, 
  Plus, 
  Search, 
  Eye, 
  EyeOff, 
  Save, 
  Trash2, 
  KeyRound,
  Shield,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { encryptText, decryptText } from '@/lib/encryption';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useSecurityLogs } from '@/hooks/useSecurityLogs';

interface SecretText {
  id: string;
  title: string;
  encrypted_content: string;
  created_at: string;
  updated_at: string;
}

export default function SecretTexts() {
  const [texts, setTexts] = useState<SecretText[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedText, setSelectedText] = useState<SecretText | null>(null);
  const [decryptedContent, setDecryptedContent] = useState('');
  const [password, setPassword] = useState('');
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const { userId, isDecoyMode } = useAuth();
  const { logEvent } = useSecurityLogs();

  const fetchTexts = useCallback(async () => {
    if (!userId || isDecoyMode) {
      setTexts([]);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('secret_texts')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setTexts(data || []);
    } catch (err) {
      console.error('Error fetching secret texts:', err);
    } finally {
      setLoading(false);
    }
  }, [userId, isDecoyMode]);

  useEffect(() => {
    fetchTexts();
  }, [fetchTexts]);

  const createNewText = async () => {
    if (!password || !userId) return;

    try {
      const encrypted = await encryptText('', password);
      const { data, error } = await supabase
        .from('secret_texts')
        .insert({
          user_id: userId,
          title: 'Neuer geheimer Text',
          encrypted_content: encrypted
        })
        .select()
        .single();

      if (error) throw error;
      setTexts(prev => [data, ...prev]);
      setSelectedText(data);
      setDecryptedContent('');
      setEditTitle('Neuer geheimer Text');
      setEditContent('');
      setIsUnlocked(true);
      toast.success('Neuer geheimer Text erstellt');
      logEvent('secret_text_create', { title: 'Neuer geheimer Text' });
    } catch (err) {
      console.error('Error creating secret text:', err);
      toast.error('Fehler beim Erstellen');
    }
  };

  const unlockText = async () => {
    if (!selectedText || !password) return;

    setError('');
    try {
      const decrypted = await decryptText(selectedText.encrypted_content, password);
      
      if (decrypted !== null) {
        setDecryptedContent(decrypted);
        setEditTitle(selectedText.title);
        setEditContent(decrypted);
        setIsUnlocked(true);
        toast.success('Text entschlüsselt');
        logEvent('secret_text_unlock', { title: selectedText.title });
      } else {
        setError('Falsches Passwort');
        toast.error('Falsches Passwort');
        logEvent('secret_text_unlock_failed', { title: selectedText.title });
      }
    } catch (err) {
      setError('Fehler beim Entschlüsseln');
      toast.error('Fehler beim Entschlüsseln');
    }
  };

  const saveText = async () => {
    if (!selectedText || !password || !userId) return;

    setSaving(true);
    try {
      const encrypted = await encryptText(editContent, password);
      const { error } = await supabase
        .from('secret_texts')
        .update({
          title: editTitle,
          encrypted_content: encrypted
        })
        .eq('id', selectedText.id);

      if (error) throw error;
      
      setTexts(prev => prev.map(t => 
        t.id === selectedText.id 
          ? { ...t, title: editTitle, encrypted_content: encrypted, updated_at: new Date().toISOString() }
          : t
      ));
      setSelectedText(prev => prev ? { ...prev, title: editTitle, encrypted_content: encrypted } : null);
      toast.success('Gespeichert');
      logEvent('secret_text_save', { title: editTitle });
    } catch (err) {
      console.error('Error saving secret text:', err);
      toast.error('Fehler beim Speichern');
    } finally {
      setSaving(false);
    }
  };

  const deleteText = async (id: string) => {
    const textToDelete = texts.find(t => t.id === id);
    try {
      const { error } = await supabase
        .from('secret_texts')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setTexts(prev => prev.filter(t => t.id !== id));
      if (selectedText?.id === id) {
        setSelectedText(null);
        setIsUnlocked(false);
        setDecryptedContent('');
      }
      toast.success('Gelöscht');
      logEvent('secret_text_delete', { title: textToDelete?.title });
    } catch (err) {
      console.error('Error deleting secret text:', err);
      toast.error('Fehler beim Löschen');
    }
  };

  const lockText = () => {
    setIsUnlocked(false);
    setDecryptedContent('');
    setEditContent('');
    setPassword('');
  };

  const filteredTexts = texts.filter(t => 
    t.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (isDecoyMode) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center justify-center h-[60vh] text-center"
      >
        <Shield className="w-16 h-16 text-white/20 mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">Geheimer Bereich</h2>
        <p className="text-white/50">Keine geheimen Texte vorhanden</p>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="h-[calc(100vh-8rem)]"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-primary flex items-center justify-center">
            <Lock className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white">Geheimer Text-Safe</h1>
            <p className="text-white/60 text-sm">{texts.length} verschlüsselte Texte</p>
          </div>
        </div>
      </div>

      {/* Password Entry */}
      {!isUnlocked && (
        <div className="glass-card p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <KeyRound className="w-5 h-5 text-purple-400" />
            <h3 className="font-medium text-white">Verschlüsselungs-Passwort</h3>
          </div>
          <div className="flex gap-3">
            <div className="relative flex-1">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Passwort für Verschlüsselung eingeben"
                className="w-full px-4 py-3 pr-12 rounded-xl vault-input text-white placeholder:text-white/30"
              />
              <button
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/60"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            <button
              onClick={createNewText}
              disabled={!password}
              className="px-4 py-3 rounded-xl bg-gradient-primary hover:shadow-glow transition-all disabled:opacity-50 flex items-center gap-2"
            >
              <Plus className="w-5 h-5 text-white" />
              <span className="text-white font-medium hidden md:inline">Neu</span>
            </button>
          </div>
          <p className="text-white/40 text-xs mt-2">
            Dieses Passwort wird für die lokale Verschlüsselung verwendet. Merke es dir gut!
          </p>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6 h-[calc(100%-12rem)]">
        {/* Text List */}
        <div className="lg:col-span-1 glass-card p-4 overflow-hidden flex flex-col">
          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Suchen..."
              className="w-full pl-10 pr-4 py-2 rounded-lg vault-input text-sm text-white placeholder:text-white/40"
            />
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto space-y-2">
            {loading ? (
              <div className="text-center text-white/50 py-8">Lädt...</div>
            ) : filteredTexts.length === 0 ? (
              <div className="text-center text-white/50 py-8">
                {searchQuery ? 'Keine Ergebnisse' : 'Keine geheimen Texte'}
              </div>
            ) : (
              filteredTexts.map((text) => (
                <motion.button
                  key={text.id}
                  onClick={() => {
                    setSelectedText(text);
                    setIsUnlocked(false);
                    setDecryptedContent('');
                    setError('');
                  }}
                  className={cn(
                    "w-full p-3 rounded-xl text-left transition-all",
                    selectedText?.id === text.id
                      ? "bg-purple-500/20 border border-purple-500/30"
                      : "bg-white/5 hover:bg-white/10 border border-transparent"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Lock className="w-4 h-4 text-purple-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium truncate">{text.title}</p>
                      <p className="text-white/40 text-xs">{formatDate(text.updated_at)}</p>
                    </div>
                  </div>
                </motion.button>
              ))
            )}
          </div>
        </div>

        {/* Editor */}
        <div className="lg:col-span-2 glass-card p-6 flex flex-col">
          {selectedText ? (
            isUnlocked ? (
              <>
                <div className="flex items-center justify-between mb-4">
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="text-xl font-bold text-white bg-transparent border-none outline-none flex-1"
                    placeholder="Titel"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      onClick={saveText}
                      disabled={saving}
                      className="p-2 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 transition-colors"
                    >
                      <Save className="w-5 h-5" />
                    </button>
                    <button
                      onClick={lockText}
                      className="p-2 rounded-lg bg-white/10 hover:bg-white/15 text-white/60 transition-colors"
                    >
                      <Lock className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => deleteText(selectedText.id)}
                      className="p-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 transition-colors"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  placeholder="Geheimen Text eingeben..."
                  className="flex-1 w-full p-4 rounded-xl vault-input text-white placeholder:text-white/30 resize-none"
                />
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center">
                <Lock className="w-16 h-16 text-purple-400 mb-4" />
                <h3 className="text-xl font-bold text-white mb-2">{selectedText.title}</h3>
                <p className="text-white/50 mb-6">Gib dein Passwort ein, um den Inhalt zu entschlüsseln</p>
                
                <div className="w-full max-w-sm space-y-4">
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && unlockText()}
                      placeholder="Passwort"
                      className="w-full px-4 py-3 pr-12 rounded-xl vault-input text-white placeholder:text-white/30 text-center"
                    />
                    <button
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/60"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>

                  <AnimatePresence>
                    {error && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="flex items-center justify-center gap-2 text-red-400"
                      >
                        <AlertCircle className="w-4 h-4" />
                        <span className="text-sm">{error}</span>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <button
                    onClick={unlockText}
                    disabled={!password}
                    className="w-full py-3 rounded-xl bg-gradient-primary hover:shadow-glow transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <Lock className="w-4 h-4 text-white" />
                    <span className="text-white font-medium">Entschlüsseln</span>
                  </button>
                </div>
              </div>
            )
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center">
              <Lock className="w-16 h-16 text-white/20 mb-4" />
              <h3 className="text-xl font-bold text-white mb-2">Wähle einen Text</h3>
              <p className="text-white/50">Oder erstelle einen neuen geheimen Text</p>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
