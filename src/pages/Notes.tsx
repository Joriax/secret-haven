import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Search, FileText, Trash2, Edit2, X, Save, Loader2, Star, Lock, Tag, History, RotateCcw } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTags } from '@/hooks/useTags';
import { encryptText, decryptText } from '@/lib/encryption';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface Note {
  id: string;
  title: string;
  content: string | null;
  secure_content: string | null;
  is_secure: boolean;
  is_favorite: boolean;
  tags: string[];
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

interface NoteVersion {
  id: string;
  note_id: string;
  version_number: number;
  title: string;
  content: string | null;
  created_at: string;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

export default function Notes() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [filterFavorites, setFilterFavorites] = useState(false);
  const [filterSecure, setFilterSecure] = useState(false);
  const [selectedTagFilter, setSelectedTagFilter] = useState<string | null>(null);
  const [showTagSelector, setShowTagSelector] = useState(false);
  const [securePassword, setSecurePassword] = useState('');
  const [showSecureModal, setShowSecureModal] = useState(false);
  const [pendingSecureAction, setPendingSecureAction] = useState<'lock' | 'unlock' | null>(null);
  const [versions, setVersions] = useState<NoteVersion[]>([]);
  const [showVersions, setShowVersions] = useState(false);
  const { userId, isDecoyMode } = useAuth();
  const { tags } = useTags();

  useEffect(() => {
    fetchNotes();
  }, [userId, isDecoyMode]);

  const fetchNotes = async () => {
    if (!userId) return;

    try {
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      
      // In decoy mode, show empty or only non-secure notes
      if (isDecoyMode) {
        setNotes([]);
      } else {
        setNotes(data || []);
      }
    } catch (error) {
      console.error('Error fetching notes:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const createNote = async () => {
    if (!userId) return;

    try {
      const { data, error } = await supabase
        .from('notes')
        .insert({
          user_id: userId,
          title: 'Neue Notiz',
          content: '',
          is_favorite: false,
          is_secure: false,
          tags: [],
        })
        .select()
        .single();

      if (error) throw error;
      
      setNotes([data, ...notes]);
      setSelectedNote(data);
      setEditTitle(data.title);
      setEditContent(data.content || '');
      setIsEditing(true);
    } catch (error) {
      console.error('Error creating note:', error);
    }
  };

  const saveNote = async () => {
    if (!selectedNote) return;

    setIsSaving(true);
    try {
      // Save version before updating
      const currentVersion = await supabase
        .from('note_versions')
        .select('version_number')
        .eq('note_id', selectedNote.id)
        .order('version_number', { ascending: false })
        .limit(1);
      
      const newVersionNumber = (currentVersion.data?.[0]?.version_number || 0) + 1;
      
      await supabase.from('note_versions').insert({
        note_id: selectedNote.id,
        user_id: userId!,
        version_number: newVersionNumber,
        title: selectedNote.title,
        content: selectedNote.content,
      });

      const { error } = await supabase
        .from('notes')
        .update({
          title: editTitle,
          content: editContent,
        })
        .eq('id', selectedNote.id);

      if (error) throw error;

      const updatedNote = { ...selectedNote, title: editTitle, content: editContent, updated_at: new Date().toISOString() };
      setNotes(notes.map(n => n.id === selectedNote.id ? updatedNote : n));
      setSelectedNote(updatedNote);
      setIsEditing(false);
      toast.success('Notiz gespeichert');
    } catch (error) {
      console.error('Error saving note:', error);
      toast.error('Fehler beim Speichern');
    } finally {
      setIsSaving(false);
    }
  };

  const deleteNote = async (noteId: string) => {
    try {
      // Soft delete - move to trash
      const { error } = await supabase
        .from('notes')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', noteId);

      if (error) throw error;

      setNotes(notes.filter(n => n.id !== noteId));
      if (selectedNote?.id === noteId) {
        setSelectedNote(null);
        setIsEditing(false);
      }
      toast.success('In Papierkorb verschoben');
    } catch (error) {
      console.error('Error deleting note:', error);
    }
  };

  const toggleFavorite = async (note: Note) => {
    try {
      const { error } = await supabase
        .from('notes')
        .update({ is_favorite: !note.is_favorite })
        .eq('id', note.id);

      if (error) throw error;

      setNotes(notes.map(n => n.id === note.id ? { ...n, is_favorite: !n.is_favorite } : n));
      if (selectedNote?.id === note.id) {
        setSelectedNote({ ...note, is_favorite: !note.is_favorite });
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
    }
  };

  const updateNoteTags = async (noteId: string, newTags: string[]) => {
    try {
      const { error } = await supabase
        .from('notes')
        .update({ tags: newTags })
        .eq('id', noteId);

      if (error) throw error;

      setNotes(notes.map(n => n.id === noteId ? { ...n, tags: newTags } : n));
      if (selectedNote?.id === noteId) {
        setSelectedNote({ ...selectedNote, tags: newTags });
      }
      toast.success('Tags aktualisiert');
    } catch (error) {
      console.error('Error updating tags:', error);
    }
  };

  const lockNote = async () => {
    if (!selectedNote || !securePassword) return;

    try {
      const encrypted = await encryptText(editContent, securePassword);
      const { error } = await supabase
        .from('notes')
        .update({ 
          is_secure: true, 
          secure_content: encrypted,
          content: '[Verschlüsselt]'
        })
        .eq('id', selectedNote.id);

      if (error) throw error;

      const updatedNote = { ...selectedNote, is_secure: true, secure_content: encrypted, content: '[Verschlüsselt]' };
      setNotes(notes.map(n => n.id === selectedNote.id ? updatedNote : n));
      setSelectedNote(updatedNote);
      setShowSecureModal(false);
      setSecurePassword('');
      setPendingSecureAction(null);
      toast.success('Notiz verschlüsselt');
    } catch (error) {
      console.error('Error locking note:', error);
      toast.error('Fehler beim Verschlüsseln');
    }
  };

  const unlockNote = async () => {
    if (!selectedNote || !securePassword || !selectedNote.secure_content) return;

    try {
      const decrypted = await decryptText(selectedNote.secure_content, securePassword);
      if (decrypted === null) {
        toast.error('Falsches Passwort');
        return;
      }

      setEditContent(decrypted);
      setShowSecureModal(false);
      setSecurePassword('');
      setPendingSecureAction(null);
      toast.success('Notiz entschlüsselt');
    } catch (error) {
      console.error('Error unlocking note:', error);
      toast.error('Fehler beim Entschlüsseln');
    }
  };

  const fetchVersions = async (noteId: string) => {
    const { data } = await supabase
      .from('note_versions')
      .select('*')
      .eq('note_id', noteId)
      .order('version_number', { ascending: false });
    
    setVersions(data || []);
  };

  const restoreVersion = async (version: NoteVersion) => {
    if (!selectedNote) return;

    try {
      const { error } = await supabase
        .from('notes')
        .update({ 
          title: version.title, 
          content: version.content 
        })
        .eq('id', selectedNote.id);

      if (error) throw error;

      const updatedNote = { ...selectedNote, title: version.title, content: version.content };
      setNotes(notes.map(n => n.id === selectedNote.id ? updatedNote : n));
      setSelectedNote(updatedNote);
      setEditTitle(version.title);
      setEditContent(version.content || '');
      setShowVersions(false);
      toast.success('Version wiederhergestellt');
    } catch (error) {
      console.error('Error restoring version:', error);
    }
  };

  const filteredNotes = notes.filter(note => {
    if (filterFavorites && !note.is_favorite) return false;
    if (filterSecure && !note.is_secure) return false;
    if (selectedTagFilter && !note.tags?.includes(selectedTagFilter)) return false;
    if (searchQuery) {
      return note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (note.content || '').toLowerCase().includes(searchQuery.toLowerCase());
    }
    return true;
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="h-[calc(100vh-6rem)] flex flex-col lg:flex-row gap-6">
      {/* Notes List */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className={cn(
          "w-full lg:w-80 flex flex-col glass-card p-4",
          selectedNote && "hidden lg:flex"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-white">Notizen</h1>
          <button
            onClick={createNote}
            className="p-2 rounded-xl bg-gradient-primary hover:shadow-glow transition-all"
          >
            <Plus className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
          <input
            type="text"
            placeholder="Suchen..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl vault-input text-white placeholder:text-white/40"
          />
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-4 flex-wrap">
          <button
            onClick={() => setFilterFavorites(!filterFavorites)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs flex items-center gap-1 transition-all",
              filterFavorites ? "bg-yellow-500/20 text-yellow-400" : "bg-white/5 text-white/60"
            )}
          >
            <Star className="w-3 h-3" />
            Favoriten
          </button>
          <button
            onClick={() => setFilterSecure(!filterSecure)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs flex items-center gap-1 transition-all",
              filterSecure ? "bg-purple-500/20 text-purple-400" : "bg-white/5 text-white/60"
            )}
          >
            <Lock className="w-3 h-3" />
            Sicher
          </button>
        </div>

        {/* Tag Filter */}
        {tags.length > 0 && (
          <div className="flex gap-1 mb-4 flex-wrap">
            {tags.slice(0, 5).map(tag => (
              <button
                key={tag.id}
                onClick={() => setSelectedTagFilter(selectedTagFilter === tag.id ? null : tag.id)}
                className={cn(
                  "px-2 py-1 rounded text-xs transition-all",
                  selectedTagFilter === tag.id ? "ring-2 ring-purple-500" : ""
                )}
                style={{ backgroundColor: `${tag.color}30`, color: tag.color }}
              >
                {tag.name}
              </button>
            ))}
          </div>
        )}

        {/* Notes List */}
        <div className="flex-1 overflow-y-auto space-y-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
            </div>
          ) : filteredNotes.length === 0 ? (
            <div className="text-center py-8 text-white/40">
              <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>Keine Notizen gefunden</p>
            </div>
          ) : (
            <motion.div variants={containerVariants} initial="hidden" animate="visible">
              {filteredNotes.map((note) => (
                <motion.div
                  key={note.id}
                  variants={itemVariants}
                  onClick={() => {
                    setSelectedNote(note);
                    setEditTitle(note.title);
                    setEditContent(note.content || '');
                    setIsEditing(false);
                    if (note.is_secure && note.secure_content) {
                      setPendingSecureAction('unlock');
                      setShowSecureModal(true);
                    }
                  }}
                  className={cn(
                    "p-4 rounded-xl cursor-pointer transition-all group",
                    selectedNote?.id === note.id
                      ? "bg-purple-500/20 border border-purple-500/30"
                      : "hover:bg-white/5 border border-transparent"
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {note.is_favorite && <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />}
                        {note.is_secure && <Lock className="w-3 h-3 text-purple-400" />}
                        <h3 className="font-medium text-white truncate">{note.title}</h3>
                      </div>
                      <p className="text-sm text-white/50 truncate mt-1">
                        {note.is_secure ? '[Verschlüsselt]' : (note.content || 'Keine Inhalte')}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <p className="text-xs text-white/30">{formatDate(note.updated_at)}</p>
                        {note.tags?.length > 0 && (
                          <div className="flex gap-1">
                            {note.tags.slice(0, 2).map(tagId => {
                              const tag = tags.find(t => t.id === tagId);
                              return tag ? (
                                <span key={tagId} className="w-2 h-2 rounded-full" style={{ backgroundColor: tag.color }} />
                              ) : null;
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteNote(note.id);
                      }}
                      className="p-2 opacity-0 group-hover:opacity-100 hover:bg-red-500/20 rounded-lg transition-all"
                    >
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}
        </div>
      </motion.div>

      {/* Note Editor */}
      <AnimatePresence mode="wait">
        {selectedNote ? (
          <motion.div
            key={selectedNote.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="flex-1 glass-card p-6 flex flex-col"
          >
            {/* Editor Header */}
            <div className="flex items-center justify-between mb-6">
              <button
                onClick={() => setSelectedNote(null)}
                className="lg:hidden p-2 hover:bg-white/5 rounded-lg"
              >
                <X className="w-5 h-5 text-white" />
              </button>
              
              <div className="flex items-center gap-2">
                {/* Favorite Toggle */}
                <button
                  onClick={() => toggleFavorite(selectedNote)}
                  className={cn(
                    "p-2 rounded-lg transition-all",
                    selectedNote.is_favorite ? "bg-yellow-500/20 text-yellow-400" : "hover:bg-white/5 text-white/60"
                  )}
                >
                  <Star className={cn("w-4 h-4", selectedNote.is_favorite && "fill-yellow-400")} />
                </button>

                {/* Tag Selector */}
                <div className="relative">
                  <button
                    onClick={() => setShowTagSelector(!showTagSelector)}
                    className="p-2 rounded-lg hover:bg-white/5 text-white/60 transition-all"
                  >
                    <Tag className="w-4 h-4" />
                  </button>
                  {showTagSelector && (
                    <div className="absolute top-full right-0 mt-2 w-48 glass-card p-2 z-10">
                      {tags.map(tag => (
                        <button
                          key={tag.id}
                          onClick={() => {
                            const newTags = selectedNote.tags?.includes(tag.id)
                              ? selectedNote.tags.filter(t => t !== tag.id)
                              : [...(selectedNote.tags || []), tag.id];
                            updateNoteTags(selectedNote.id, newTags);
                          }}
                          className={cn(
                            "w-full px-3 py-2 rounded-lg text-left flex items-center gap-2 transition-all",
                            selectedNote.tags?.includes(tag.id) ? "bg-white/10" : "hover:bg-white/5"
                          )}
                        >
                          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: tag.color }} />
                          <span className="text-white text-sm">{tag.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Version History */}
                <button
                  onClick={() => {
                    fetchVersions(selectedNote.id);
                    setShowVersions(true);
                  }}
                  className="p-2 rounded-lg hover:bg-white/5 text-white/60 transition-all"
                >
                  <History className="w-4 h-4" />
                </button>

                {/* Secure Lock */}
                <button
                  onClick={() => {
                    if (selectedNote.is_secure) {
                      setPendingSecureAction('unlock');
                    } else {
                      setPendingSecureAction('lock');
                    }
                    setShowSecureModal(true);
                  }}
                  className={cn(
                    "p-2 rounded-lg transition-all",
                    selectedNote.is_secure ? "bg-purple-500/20 text-purple-400" : "hover:bg-white/5 text-white/60"
                  )}
                >
                  <Lock className="w-4 h-4" />
                </button>

                {isEditing ? (
                  <button
                    onClick={saveNote}
                    disabled={isSaving}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-primary hover:shadow-glow transition-all disabled:opacity-50"
                  >
                    {isSaving ? (
                      <Loader2 className="w-4 h-4 text-white animate-spin" />
                    ) : (
                      <Save className="w-4 h-4 text-white" />
                    )}
                    <span className="text-white text-sm">Speichern</span>
                  </button>
                ) : (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 hover:bg-white/5 transition-all"
                  >
                    <Edit2 className="w-4 h-4 text-white" />
                    <span className="text-white text-sm">Bearbeiten</span>
                  </button>
                )}
              </div>
            </div>

            {/* Tag Display */}
            {selectedNote.tags?.length > 0 && (
              <div className="flex gap-2 mb-4 flex-wrap">
                {selectedNote.tags.map(tagId => {
                  const tag = tags.find(t => t.id === tagId);
                  return tag ? (
                    <span
                      key={tagId}
                      className="px-2 py-1 rounded text-xs"
                      style={{ backgroundColor: `${tag.color}30`, color: tag.color }}
                    >
                      {tag.name}
                    </span>
                  ) : null;
                })}
              </div>
            )}

            {/* Editor Content */}
            {isEditing ? (
              <div className="flex-1 flex flex-col gap-4">
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="Titel..."
                  className="text-2xl font-bold bg-transparent border-none outline-none text-white placeholder:text-white/30"
                />
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  placeholder="Schreibe deine Notiz... (Markdown unterstützt)"
                  className="flex-1 bg-transparent border-none outline-none text-white placeholder:text-white/40 resize-none font-mono text-sm leading-relaxed"
                />
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto">
                <h1 className="text-2xl font-bold text-white mb-6">{selectedNote.title}</h1>
                <div className="prose prose-invert prose-purple max-w-none">
                  <ReactMarkdown
                    components={{
                      code: ({ className, children }) => (
                        <code className={cn(className, "bg-black/40 rounded px-2 py-1 text-purple-300 font-mono text-sm")}>
                          {children}
                        </code>
                      ),
                      pre: ({ children }) => (
                        <pre className="bg-black/40 rounded-xl p-4 overflow-x-auto border border-white/10">
                          {children}
                        </pre>
                      ),
                    }}
                  >
                    {editContent || '*Keine Inhalte*'}
                  </ReactMarkdown>
                </div>
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex-1 glass-card hidden lg:flex items-center justify-center"
          >
            <div className="text-center text-white/40">
              <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p>Wähle eine Notiz aus oder erstelle eine neue</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Secure Modal */}
      <AnimatePresence>
        {showSecureModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
            onClick={() => { setShowSecureModal(false); setSecurePassword(''); }}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="glass-card p-6 w-full max-w-sm"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-4">
                <Lock className="w-6 h-6 text-purple-400" />
                <h3 className="text-xl font-bold text-white">
                  {pendingSecureAction === 'lock' ? 'Notiz verschlüsseln' : 'Notiz entschlüsseln'}
                </h3>
              </div>
              <input
                type="password"
                value={securePassword}
                onChange={(e) => setSecurePassword(e.target.value)}
                placeholder="Passwort eingeben..."
                className="w-full px-4 py-3 rounded-xl vault-input text-white placeholder:text-white/30 mb-4"
                autoFocus
              />
              <div className="flex gap-3">
                <button
                  onClick={() => { setShowSecureModal(false); setSecurePassword(''); }}
                  className="flex-1 py-3 rounded-xl border border-white/10 text-white hover:bg-white/5"
                >
                  Abbrechen
                </button>
                <button
                  onClick={pendingSecureAction === 'lock' ? lockNote : unlockNote}
                  disabled={!securePassword}
                  className="flex-1 py-3 rounded-xl bg-gradient-primary text-white hover:shadow-glow disabled:opacity-50"
                >
                  {pendingSecureAction === 'lock' ? 'Verschlüsseln' : 'Entschlüsseln'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Version History Modal */}
      <AnimatePresence>
        {showVersions && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
            onClick={() => setShowVersions(false)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="glass-card p-6 w-full max-w-md max-h-[80vh] overflow-hidden flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-4">
                <History className="w-6 h-6 text-purple-400" />
                <h3 className="text-xl font-bold text-white">Versionshistorie</h3>
              </div>
              <div className="flex-1 overflow-y-auto space-y-2">
                {versions.length === 0 ? (
                  <p className="text-white/50 text-center py-8">Keine früheren Versionen</p>
                ) : (
                  versions.map(version => (
                    <div key={version.id} className="p-3 rounded-xl bg-white/5 flex items-center justify-between">
                      <div>
                        <p className="text-white font-medium">Version {version.version_number}</p>
                        <p className="text-white/50 text-sm">{formatDate(version.created_at)}</p>
                        <p className="text-white/40 text-xs truncate">{version.title}</p>
                      </div>
                      <button
                        onClick={() => restoreVersion(version)}
                        className="p-2 rounded-lg hover:bg-purple-500/20 text-purple-400 transition-all"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
              <button
                onClick={() => setShowVersions(false)}
                className="mt-4 w-full py-3 rounded-xl border border-white/10 text-white hover:bg-white/5"
              >
                Schließen
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
