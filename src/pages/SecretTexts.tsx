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
  AlertCircle,
  FileText,
  ChevronLeft,
  Loader2,
  Clock,
  LockOpen
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { encryptText, decryptText } from '@/lib/encryption';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useSecurityLogs } from '@/hooks/useSecurityLogs';
import { useViewHistory } from '@/hooks/useViewHistory';
import { DeleteConfirmDialog } from '@/components/DeleteConfirmDialog';

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
  const [showMobileEditor, setShowMobileEditor] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; id: string | null }>({ isOpen: false, id: null });
  const { userId, isDecoyMode, supabaseClient: supabase } = useAuth();
  const { logEvent } = useSecurityLogs();
  const { recordView } = useViewHistory();

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
  }, [userId, isDecoyMode, supabase]);

  useEffect(() => {
    fetchTexts();
  }, [fetchTexts]);

  // Real-time updates
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel('secret-texts-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'secret_texts' }, fetchTexts)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, fetchTexts, supabase]);

  const createNewText = async () => {
    if (!password || !userId) {
      toast.error('Bitte gib zuerst ein Passwort ein');
      return;
    }

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
      setShowMobileEditor(true);
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
        recordView('secret_text', selectedText.id);
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

  const deleteText = async () => {
    if (!deleteConfirm.id) return;
    
    const textToDelete = texts.find(t => t.id === deleteConfirm.id);
    try {
      const { error } = await supabase
        .from('secret_texts')
        .delete()
        .eq('id', deleteConfirm.id);

      if (error) throw error;
      setTexts(prev => prev.filter(t => t.id !== deleteConfirm.id));
      if (selectedText?.id === deleteConfirm.id) {
        setSelectedText(null);
        setIsUnlocked(false);
        setDecryptedContent('');
        setShowMobileEditor(false);
      }
      toast.success('Gelöscht');
      logEvent('secret_text_delete', { title: textToDelete?.title });
    } catch (err) {
      console.error('Error deleting secret text:', err);
      toast.error('Fehler beim Löschen');
    } finally {
      setDeleteConfirm({ isOpen: false, id: null });
    }
  };

  const lockText = () => {
    setIsUnlocked(false);
    setDecryptedContent('');
    setEditContent('');
    setPassword('');
  };

  const handleSelectText = (text: SecretText) => {
    setSelectedText(text);
    setIsUnlocked(false);
    setDecryptedContent('');
    setError('');
    setShowMobileEditor(true);
  };

  const handleBack = () => {
    setShowMobileEditor(false);
    setSelectedText(null);
    setIsUnlocked(false);
    lockText();
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
        className="flex flex-col items-center justify-center h-[60vh] text-center px-4"
      >
        <Shield className="w-16 h-16 text-muted-foreground/30 mb-4" />
        <h2 className="text-xl font-bold text-foreground mb-2">Geheimer Bereich</h2>
        <p className="text-muted-foreground">Keine geheimen Texte vorhanden</p>
      </motion.div>
    );
  }

  // Mobile Editor View
  if (showMobileEditor && selectedText) {
    return (
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        className="flex flex-col h-[calc(100vh-8rem)] md:hidden"
      >
        {/* Mobile Header */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={handleBack}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
            <span>Zurück</span>
          </button>
          <div className="flex items-center gap-2">
            {isUnlocked && (
              <>
                <button
                  onClick={saveText}
                  disabled={saving}
                  className="p-2 rounded-lg bg-primary/20 text-primary hover:bg-primary/30 transition-colors"
                >
                  {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                </button>
                <button
                  onClick={lockText}
                  className="p-2 rounded-lg bg-muted text-muted-foreground hover:bg-muted/80 transition-colors"
                >
                  <Lock className="w-5 h-5" />
                </button>
              </>
            )}
            <button
              onClick={() => setDeleteConfirm({ isOpen: true, id: selectedText.id })}
              className="p-2 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        </div>

        {isUnlocked ? (
          <div className="flex-1 flex flex-col gap-4">
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="text-xl font-bold text-foreground bg-transparent border-b border-border pb-2 outline-none focus:border-primary transition-colors"
              placeholder="Titel eingeben..."
            />
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              placeholder="Geheimen Text eingeben..."
              className="flex-1 w-full p-4 rounded-xl bg-muted/50 border border-border text-foreground placeholder:text-muted-foreground resize-none focus:border-primary outline-none transition-colors"
            />
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
              <Lock className="w-10 h-10 text-primary" />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-2">{selectedText.title}</h3>
            <p className="text-muted-foreground mb-6 text-sm">Gib dein Passwort ein, um den Inhalt zu entschlüsseln</p>
            
            <div className="w-full max-w-sm space-y-4">
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && unlockText()}
                  placeholder="Passwort"
                  className="w-full px-4 py-3 pr-12 rounded-xl bg-muted border border-border text-foreground placeholder:text-muted-foreground text-center focus:border-primary outline-none transition-colors"
                />
                <button
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
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
                    className="flex items-center justify-center gap-2 text-destructive"
                  >
                    <AlertCircle className="w-4 h-4" />
                    <span className="text-sm">{error}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              <button
                onClick={unlockText}
                disabled={!password}
                className="w-full py-3 rounded-xl bg-primary hover:bg-primary/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-primary-foreground font-medium"
              >
                <LockOpen className="w-4 h-4" />
                <span>Entschlüsseln</span>
              </button>
            </div>
          </div>
        )}

        <DeleteConfirmDialog
          isOpen={deleteConfirm.isOpen}
          onClose={() => setDeleteConfirm({ isOpen: false, id: null })}
          onConfirm={deleteText}
          title="Text löschen"
          description="Möchtest du diesen geheimen Text wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden."
          isPermanent
        />
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col h-[calc(100vh-8rem)]"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-lg">
            <Lock className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">Geheimer Safe</h1>
            <p className="text-muted-foreground text-sm">{texts.length} verschlüsselte Texte</p>
          </div>
        </div>
      </div>

      {/* Password Entry */}
      {!isUnlocked && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-4 md:p-6 mb-6"
        >
          <div className="flex items-center gap-3 mb-4">
            <KeyRound className="w-5 h-5 text-primary" />
            <h3 className="font-medium text-foreground">Verschlüsselungs-Passwort</h3>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Passwort für Verschlüsselung eingeben"
                className="w-full px-4 py-3 pr-12 rounded-xl bg-muted border border-border text-foreground placeholder:text-muted-foreground focus:border-primary outline-none transition-colors"
              />
              <button
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            <button
              onClick={createNewText}
              disabled={!password}
              className="px-6 py-3 rounded-xl bg-primary hover:bg-primary/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-primary-foreground font-medium"
            >
              <Plus className="w-5 h-5" />
              <span>Neu erstellen</span>
            </button>
          </div>
          <p className="text-muted-foreground text-xs mt-3">
            Dieses Passwort wird für die lokale Verschlüsselung verwendet. Merke es dir gut!
          </p>
        </motion.div>
      )}

      <div className="flex-1 grid lg:grid-cols-3 gap-6 min-h-0">
        {/* Text List */}
        <div className="lg:col-span-1 glass-card p-4 overflow-hidden flex flex-col">
          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Suchen..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground focus:border-primary outline-none transition-colors"
            />
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : filteredTexts.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
                <p className="text-muted-foreground text-sm">
                  {searchQuery ? 'Keine Ergebnisse' : 'Keine geheimen Texte'}
                </p>
                {!searchQuery && (
                  <p className="text-muted-foreground/60 text-xs mt-1">
                    Erstelle deinen ersten Text oben
                  </p>
                )}
              </div>
            ) : (
              filteredTexts.map((text) => (
                <motion.button
                  key={text.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() => handleSelectText(text)}
                  className={cn(
                    "w-full p-4 rounded-xl text-left transition-all border",
                    selectedText?.id === text.id
                      ? "bg-primary/10 border-primary/30 shadow-sm"
                      : "bg-muted/50 hover:bg-muted border-transparent"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
                      selectedText?.id === text.id ? "bg-primary/20" : "bg-muted"
                    )}>
                      <Lock className={cn(
                        "w-4 h-4",
                        selectedText?.id === text.id ? "text-primary" : "text-muted-foreground"
                      )} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-foreground font-medium truncate">{text.title}</p>
                      <div className="flex items-center gap-1.5 mt-1 text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        <span className="text-xs">{formatDate(text.updated_at)}</span>
                      </div>
                    </div>
                  </div>
                </motion.button>
              ))
            )}
          </div>
        </div>

        {/* Editor - Desktop only */}
        <div className="hidden lg:flex lg:col-span-2 glass-card p-6 flex-col">
          {selectedText ? (
            isUnlocked ? (
              <>
                <div className="flex items-center justify-between mb-4 pb-4 border-b border-border">
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="text-xl font-bold text-foreground bg-transparent border-none outline-none flex-1"
                    placeholder="Titel eingeben..."
                  />
                  <div className="flex items-center gap-2">
                    <button
                      onClick={saveText}
                      disabled={saving}
                      className="p-2.5 rounded-lg bg-primary/20 hover:bg-primary/30 text-primary transition-colors"
                      title="Speichern"
                    >
                      {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                    </button>
                    <button
                      onClick={lockText}
                      className="p-2.5 rounded-lg bg-muted hover:bg-muted/80 text-muted-foreground transition-colors"
                      title="Sperren"
                    >
                      <Lock className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => setDeleteConfirm({ isOpen: true, id: selectedText.id })}
                      className="p-2.5 rounded-lg bg-destructive/10 hover:bg-destructive/20 text-destructive transition-colors"
                      title="Löschen"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  placeholder="Geheimen Text eingeben..."
                  className="flex-1 w-full p-4 rounded-xl bg-muted/50 border border-border text-foreground placeholder:text-muted-foreground resize-none focus:border-primary outline-none transition-colors"
                />
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center">
                <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center mb-6">
                  <Lock className="w-12 h-12 text-primary" />
                </div>
                <h3 className="text-xl font-bold text-foreground mb-2">{selectedText.title}</h3>
                <p className="text-muted-foreground mb-8">Gib dein Passwort ein, um den Inhalt zu entschlüsseln</p>
                
                <div className="w-full max-w-sm space-y-4">
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && unlockText()}
                      placeholder="Passwort"
                      className="w-full px-4 py-3 pr-12 rounded-xl bg-muted border border-border text-foreground placeholder:text-muted-foreground text-center focus:border-primary outline-none transition-colors"
                    />
                    <button
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
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
                        className="flex items-center justify-center gap-2 text-destructive"
                      >
                        <AlertCircle className="w-4 h-4" />
                        <span className="text-sm">{error}</span>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <button
                    onClick={unlockText}
                    disabled={!password}
                    className="w-full py-3 rounded-xl bg-primary hover:bg-primary/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-primary-foreground font-medium"
                  >
                    <LockOpen className="w-4 h-4" />
                    <span>Entschlüsseln</span>
                  </button>
                </div>
              </div>
            )
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center">
              <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center mb-6">
                <FileText className="w-12 h-12 text-muted-foreground/30" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-2">Wähle einen Text</h3>
              <p className="text-muted-foreground">Oder erstelle einen neuen geheimen Text</p>
            </div>
          )}
        </div>
      </div>

      <DeleteConfirmDialog
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, id: null })}
        onConfirm={deleteText}
        title="Text löschen"
        description="Möchtest du diesen geheimen Text wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden."
        isPermanent
      />
    </motion.div>
  );
}