import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Search, FileText, Trash2, Edit2, X, Save, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

interface Note {
  id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
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
  const { userId } = useAuth();

  useEffect(() => {
    fetchNotes();
  }, [userId]);

  const fetchNotes = async () => {
    if (!userId) return;

    try {
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setNotes(data || []);
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
        })
        .select()
        .single();

      if (error) throw error;
      
      setNotes([data, ...notes]);
      setSelectedNote(data);
      setEditTitle(data.title);
      setEditContent(data.content);
      setIsEditing(true);
    } catch (error) {
      console.error('Error creating note:', error);
    }
  };

  const saveNote = async () => {
    if (!selectedNote) return;

    setIsSaving(true);
    try {
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
    } catch (error) {
      console.error('Error saving note:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const deleteNote = async (noteId: string) => {
    try {
      const { error } = await supabase
        .from('notes')
        .delete()
        .eq('id', noteId);

      if (error) throw error;

      setNotes(notes.filter(n => n.id !== noteId));
      if (selectedNote?.id === noteId) {
        setSelectedNote(null);
        setIsEditing(false);
      }
    } catch (error) {
      console.error('Error deleting note:', error);
    }
  };

  const filteredNotes = notes.filter(note =>
    note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    note.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
                    setEditContent(note.content);
                    setIsEditing(false);
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
                      <h3 className="font-medium text-white truncate">{note.title}</h3>
                      <p className="text-sm text-white/50 truncate mt-1">
                        {note.content || 'Keine Inhalte'}
                      </p>
                      <p className="text-xs text-white/30 mt-2">
                        {formatDate(note.updated_at)}
                      </p>
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
                        <code className={cn(
                          className,
                          "bg-black/40 rounded px-2 py-1 text-purple-300 font-mono text-sm"
                        )}>
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
                    {selectedNote.content || '*Keine Inhalte*'}
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
    </div>
  );
}
