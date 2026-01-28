import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Flame, 
  Plus, 
  Clock, 
  Eye, 
  Lock, 
  Trash2, 
  AlertTriangle,
  Timer,
  Copy,
  Check
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { PageHeader } from '@/components/PageHeader';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { encryptText, decryptText } from '@/lib/encryption';
import { format, formatDistanceToNow, isPast } from 'date-fns';
import { de } from 'date-fns/locale';

interface SelfDestructingNote {
  id: string;
  user_id: string;
  title: string;
  content: string | null;
  encrypted_content: string | null;
  is_encrypted: boolean;
  destruct_at: string;
  view_count: number;
  max_views: number | null;
  created_at: string;
}

type DestructMode = 'time' | 'views' | 'both';

export default function SelfDestructingNotes() {
  const { userId, supabaseClient: supabase } = useAuth();
  const [notes, setNotes] = useState<SelfDestructingNote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedNote, setSelectedNote] = useState<SelfDestructingNote | null>(null);
  const [decryptedContent, setDecryptedContent] = useState<string | null>(null);
  const [password, setPassword] = useState('');

  // Create form state
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [destructMode, setDestructMode] = useState<DestructMode>('time');
  const [destructHours, setDestructHours] = useState(24);
  const [maxViews, setMaxViews] = useState(1);
  const [useEncryption, setUseEncryption] = useState(false);
  const [encryptionPassword, setEncryptionPassword] = useState('');

  // Fetch notes
  useEffect(() => {
    const fetchNotes = async () => {
      if (!userId) return;

      const { data, error } = await supabase
        .from('self_destructing_notes')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (!error && data) {
        // Filter out expired notes
        const validNotes = data.filter(note => {
          const isExpired = isPast(new Date(note.destruct_at));
          const maxViewsReached = note.max_views && note.view_count >= note.max_views;
          return !isExpired && !maxViewsReached;
        });
        setNotes(validNotes);

        // Clean up expired notes
        const expiredIds = data
          .filter(note => isPast(new Date(note.destruct_at)) || (note.max_views && note.view_count >= note.max_views))
          .map(note => note.id);

        if (expiredIds.length > 0) {
          await supabase
            .from('self_destructing_notes')
            .delete()
            .in('id', expiredIds);
        }
      }
      setIsLoading(false);
    };

    fetchNotes();
  }, [userId, supabase]);

  const handleCreate = async () => {
    if (!userId || !newTitle.trim() || !newContent.trim()) {
      toast.error('Titel und Inhalt sind erforderlich');
      return;
    }

    if (useEncryption && !encryptionPassword) {
      toast.error('Passwort für Verschlüsselung erforderlich');
      return;
    }

    const destructAt = new Date();
    destructAt.setHours(destructAt.getHours() + destructHours);

    let content = newContent;
    let encryptedContent: string | null = null;

    if (useEncryption) {
      encryptedContent = await encryptText(newContent, encryptionPassword);
      content = null as any;
    }

    const { data, error } = await supabase
      .from('self_destructing_notes')
      .insert({
        user_id: userId,
        title: newTitle,
        content: useEncryption ? null : content,
        encrypted_content: encryptedContent,
        is_encrypted: useEncryption,
        destruct_at: destructAt.toISOString(),
        max_views: destructMode === 'views' || destructMode === 'both' ? maxViews : null,
        view_count: 0
      })
      .select()
      .single();

    if (!error && data) {
      setNotes(prev => [data, ...prev]);
      setShowCreate(false);
      resetForm();
      toast.success('Selbstzerstörende Notiz erstellt');
    } else {
      toast.error('Fehler beim Erstellen');
    }
  };

  const resetForm = () => {
    setNewTitle('');
    setNewContent('');
    setDestructMode('time');
    setDestructHours(24);
    setMaxViews(1);
    setUseEncryption(false);
    setEncryptionPassword('');
  };

  const handleView = async (note: SelfDestructingNote) => {
    // Increment view count
    const newViewCount = note.view_count + 1;
    
    await supabase
      .from('self_destructing_notes')
      .update({ view_count: newViewCount })
      .eq('id', note.id);

    // Update local state
    setNotes(prev => prev.map(n => 
      n.id === note.id ? { ...n, view_count: newViewCount } : n
    ));

    setSelectedNote({ ...note, view_count: newViewCount });

    if (note.is_encrypted) {
      setDecryptedContent(null);
    } else {
      setDecryptedContent(note.content);
    }

    // Check if this was the last allowed view
    if (note.max_views && newViewCount >= note.max_views) {
      toast.warning('Letzte Ansicht - Notiz wird gelöscht');
      
      // Delete after a short delay
      setTimeout(async () => {
        await supabase
          .from('self_destructing_notes')
          .delete()
          .eq('id', note.id);
        
        setNotes(prev => prev.filter(n => n.id !== note.id));
        setSelectedNote(null);
        setDecryptedContent(null);
      }, 3000);
    }
  };

  const handleDecrypt = async () => {
    if (!selectedNote || !password) return;

    try {
      const decrypted = await decryptText(selectedNote.encrypted_content!, password);
      setDecryptedContent(decrypted);
      setPassword('');
    } catch {
      toast.error('Falsches Passwort');
    }
  };

  const handleDelete = async (noteId: string) => {
    const { error } = await supabase
      .from('self_destructing_notes')
      .delete()
      .eq('id', noteId);

    if (!error) {
      setNotes(prev => prev.filter(n => n.id !== noteId));
      if (selectedNote?.id === noteId) {
        setSelectedNote(null);
        setDecryptedContent(null);
      }
      toast.success('Notiz gelöscht');
    }
  };

  const copyShareableLink = (note: SelfDestructingNote) => {
    // In a real app, this would generate a shareable link
    navigator.clipboard.writeText(`${window.location.origin}/shared/${note.id}`);
    toast.success('Link kopiert (Demo)');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <PageHeader
        title="Selbstzerstörende Notizen"
        subtitle="Notizen die nach Zeit oder Ansichten verschwinden"
        icon={<Flame className="w-5 h-5 text-orange-500" />}
        backTo="/dashboard"
        actions={
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-xl hover:bg-orange-600 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Neue Notiz
          </button>
        }
      />

      {/* Notes Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full" />
        </div>
      ) : notes.length === 0 ? (
        <div className="text-center py-16">
          <Flame className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-foreground mb-2">Keine selbstzerstörenden Notizen</h2>
          <p className="text-muted-foreground max-w-md mx-auto mb-6">
            Erstelle Notizen die nach einer bestimmten Zeit oder Anzahl von Ansichten automatisch gelöscht werden.
          </p>
          <button
            onClick={() => setShowCreate(true)}
            className="px-6 py-3 bg-orange-500 text-white rounded-xl hover:bg-orange-600 transition-colors"
          >
            Erste Notiz erstellen
          </button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {notes.map((note, index) => {
            const timeLeft = formatDistanceToNow(new Date(note.destruct_at), { locale: de, addSuffix: true });
            const viewsLeft = note.max_views ? note.max_views - note.view_count : null;

            return (
              <motion.div
                key={note.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="glass-card p-4 relative group"
              >
                {/* Destruct indicator */}
                <div className="absolute top-3 right-3 flex items-center gap-2">
                  {note.is_encrypted && (
                    <div className="p-1.5 rounded-lg bg-purple-500/20">
                      <Lock className="w-3.5 h-3.5 text-purple-500" />
                    </div>
                  )}
                  <div className="p-1.5 rounded-lg bg-orange-500/20">
                    <Flame className="w-3.5 h-3.5 text-orange-500" />
                  </div>
                </div>

                <h3 className="font-semibold text-foreground pr-16 mb-2 truncate">{note.title}</h3>

                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Timer className="w-4 h-4" />
                    <span>Läuft ab {timeLeft}</span>
                  </div>
                  
                  {viewsLeft !== null && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Eye className="w-4 h-4" />
                      <span>{viewsLeft} Ansicht{viewsLeft !== 1 ? 'en' : ''} übrig</span>
                    </div>
                  )}

                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="w-4 h-4" />
                    <span>{format(new Date(note.created_at), 'dd.MM.yyyy HH:mm', { locale: de })}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border">
                  <button
                    onClick={() => handleView(note)}
                    className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors text-sm"
                  >
                    <Eye className="w-4 h-4" />
                    Ansehen
                  </button>
                  <button
                    onClick={() => copyShareableLink(note)}
                    className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                    title="Link kopieren"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(note.id)}
                    className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                    title="Jetzt löschen"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Create Modal */}
      <AnimatePresence>
        {showCreate && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
            onClick={() => setShowCreate(false)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="glass-card p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-6">
                <Flame className="w-6 h-6 text-orange-500" />
                <h3 className="text-xl font-bold text-foreground">Neue selbstzerstörende Notiz</h3>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Titel</label>
                  <input
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="Titel der Notiz..."
                    className="w-full px-4 py-3 rounded-xl vault-input text-foreground placeholder:text-muted-foreground"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Inhalt</label>
                  <textarea
                    value={newContent}
                    onChange={(e) => setNewContent(e.target.value)}
                    placeholder="Geheimer Inhalt..."
                    rows={5}
                    className="w-full px-4 py-3 rounded-xl vault-input text-foreground placeholder:text-muted-foreground resize-none"
                  />
                </div>

                {/* Destruction Mode */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Zerstörungsmodus</label>
                  <div className="flex gap-2">
                    {(['time', 'views', 'both'] as DestructMode[]).map((mode) => (
                      <button
                        key={mode}
                        onClick={() => setDestructMode(mode)}
                        className={cn(
                          "flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors",
                          destructMode === mode
                            ? "bg-orange-500 text-white"
                            : "bg-muted text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {mode === 'time' && 'Nach Zeit'}
                        {mode === 'views' && 'Nach Ansichten'}
                        {mode === 'both' && 'Beides'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Time Setting */}
                {(destructMode === 'time' || destructMode === 'both') && (
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Zerstören nach (Stunden)
                    </label>
                    <select
                      value={destructHours}
                      onChange={(e) => setDestructHours(Number(e.target.value))}
                      className="w-full px-4 py-3 rounded-xl vault-input text-foreground"
                    >
                      <option value={1}>1 Stunde</option>
                      <option value={6}>6 Stunden</option>
                      <option value={12}>12 Stunden</option>
                      <option value={24}>24 Stunden</option>
                      <option value={48}>2 Tage</option>
                      <option value={168}>1 Woche</option>
                    </select>
                  </div>
                )}

                {/* Views Setting */}
                {(destructMode === 'views' || destructMode === 'both') && (
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Maximale Ansichten
                    </label>
                    <select
                      value={maxViews}
                      onChange={(e) => setMaxViews(Number(e.target.value))}
                      className="w-full px-4 py-3 rounded-xl vault-input text-foreground"
                    >
                      <option value={1}>1 Ansicht (Burn after reading)</option>
                      <option value={3}>3 Ansichten</option>
                      <option value={5}>5 Ansichten</option>
                      <option value={10}>10 Ansichten</option>
                    </select>
                  </div>
                )}

                {/* Encryption Toggle */}
                <div className="p-4 rounded-xl bg-muted/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Lock className="w-5 h-5 text-purple-500" />
                      <span className="font-medium text-foreground">Verschlüsselung</span>
                    </div>
                    <button
                      onClick={() => setUseEncryption(!useEncryption)}
                      className={cn(
                        "w-12 h-6 rounded-full transition-colors relative",
                        useEncryption ? "bg-purple-500" : "bg-muted"
                      )}
                    >
                      <motion.div
                        className="absolute top-1 w-4 h-4 rounded-full bg-white"
                        animate={{ left: useEncryption ? 28 : 4 }}
                      />
                    </button>
                  </div>

                  {useEncryption && (
                    <input
                      type="password"
                      value={encryptionPassword}
                      onChange={(e) => setEncryptionPassword(e.target.value)}
                      placeholder="Verschlüsselungspasswort..."
                      className="w-full px-4 py-3 rounded-xl vault-input text-foreground placeholder:text-muted-foreground"
                    />
                  )}
                </div>

                {/* Warning */}
                <div className="flex items-start gap-3 p-4 rounded-xl bg-orange-500/10 border border-orange-500/20">
                  <AlertTriangle className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-orange-500/80">
                    Diese Notiz wird unwiderruflich gelöscht, sobald die Bedingungen erfüllt sind.
                    {useEncryption && ' Vergiss dein Passwort nicht!'}
                  </p>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => { setShowCreate(false); resetForm(); }}
                  className="flex-1 py-3 rounded-xl border border-border text-foreground hover:bg-muted transition-colors"
                >
                  Abbrechen
                </button>
                <button
                  onClick={handleCreate}
                  disabled={!newTitle.trim() || !newContent.trim()}
                  className="flex-1 py-3 rounded-xl bg-orange-500 text-white hover:bg-orange-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Flame className="w-4 h-4" />
                  Erstellen
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* View Modal */}
      <AnimatePresence>
        {selectedNote && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
            onClick={() => { setSelectedNote(null); setDecryptedContent(null); setPassword(''); }}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="glass-card p-6 w-full max-w-lg"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-4">
                {selectedNote.is_encrypted ? (
                  <Lock className="w-6 h-6 text-purple-500" />
                ) : (
                  <Flame className="w-6 h-6 text-orange-500" />
                )}
                <h3 className="text-xl font-bold text-foreground">{selectedNote.title}</h3>
              </div>

              {/* Stats */}
              <div className="flex items-center gap-4 mb-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Eye className="w-4 h-4" />
                  {selectedNote.view_count} Ansicht{selectedNote.view_count !== 1 ? 'en' : ''}
                </div>
                {selectedNote.max_views && (
                  <div className="flex items-center gap-1">
                    <AlertTriangle className="w-4 h-4 text-orange-500" />
                    {selectedNote.max_views - selectedNote.view_count} übrig
                  </div>
                )}
              </div>

              {/* Content */}
              {selectedNote.is_encrypted && !decryptedContent ? (
                <div className="space-y-4">
                  <p className="text-muted-foreground text-sm">
                    Diese Notiz ist verschlüsselt. Gib das Passwort ein, um sie zu lesen.
                  </p>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Passwort..."
                    className="w-full px-4 py-3 rounded-xl vault-input text-foreground placeholder:text-muted-foreground"
                    onKeyDown={(e) => e.key === 'Enter' && handleDecrypt()}
                  />
                  <button
                    onClick={handleDecrypt}
                    disabled={!password}
                    className="w-full py-3 rounded-xl bg-purple-500 text-white hover:bg-purple-600 transition-colors disabled:opacity-50"
                  >
                    Entschlüsseln
                  </button>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-muted/30 whitespace-pre-wrap text-foreground">
                  {decryptedContent}
                </div>
              )}

              <button
                onClick={() => { setSelectedNote(null); setDecryptedContent(null); setPassword(''); }}
                className="w-full mt-4 py-3 rounded-xl border border-border text-foreground hover:bg-muted transition-colors"
              >
                Schließen
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
