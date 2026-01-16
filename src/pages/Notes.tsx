import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, 
  Search, 
  FileText, 
  Trash2, 
  Edit2, 
  X, 
  Save, 
  Loader2, 
  Star, 
  Lock, 
  Tag, 
  History, 
  RotateCcw,
  Copy,
  Share,
  MoreVertical,
  ChevronLeft,
  Unlock,
  Bold,
  Italic,
  List,
  ListOrdered,
  Quote,
  Code,
  Link,
  Heading1,
  Heading2,
  Heading3,
  Eye,
  EyeOff,
  CheckSquare,
  Folder,
  Share2,
  Scan
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useAuth } from '@/contexts/AuthContext';
import { useTags, Tag as TagType } from '@/hooks/useTags';
import { useNoteFolders } from '@/hooks/useNoteFolders';
import { useViewHistory } from '@/hooks/useViewHistory';
import { useNoteAttachments } from '@/hooks/useNoteAttachments';
import { encryptText, decryptText } from '@/lib/encryption';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { DeleteConfirmDialog } from '@/components/DeleteConfirmDialog';
import { NoteFolderSidebar } from '@/components/NoteFolderSidebar';
import { NoteAttachmentsPanel } from '@/components/NoteAttachmentsPanel';
import { ShareToAlbumDialog } from '@/components/ShareToAlbumDialog';
import { OCRScanner } from '@/components/OCRScanner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Note {
  id: string;
  title: string;
  content: string | null;
  secure_content: string | null;
  is_secure: boolean;
  is_favorite: boolean;
  tags: string[];
  folder_id: string | null;
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
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; note: Note | null }>({ isOpen: false, note: null });
  const [shareToAlbum, setShareToAlbum] = useState<{ isOpen: boolean; note: Note | null }>({ isOpen: false, note: null });
  const [autoSaveTimeout, setAutoSaveTimeout] = useState<NodeJS.Timeout | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { userId, isDecoyMode, supabaseClient: supabase } = useAuth();
  const { tags, createTag } = useTags();
  const { folders, createFolder, updateFolder, deleteFolder } = useNoteFolders();
  const { recordView } = useViewHistory();
  const { 
    attachments, 
    isLoading: attachmentsLoading, 
    isUploading: attachmentsUploading, 
    fetchAttachments, 
    uploadAttachment, 
    deleteAttachment 
  } = useNoteAttachments(selectedNote?.id || null);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [showFolderSidebar, setShowFolderSidebar] = useState(true);

  const fetchNotes = useCallback(async () => {
    if (!userId) return;

    try {
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      
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
  }, [userId, isDecoyMode]);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  // Fetch attachments when note changes
  useEffect(() => {
    if (selectedNote?.id) {
      fetchAttachments();
    }
  }, [selectedNote?.id, fetchAttachments]);

  // Real-time updates
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel('notes-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notes' }, fetchNotes)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, fetchNotes]);

  // Auto-save functionality
  useEffect(() => {
    if (!isEditing || !selectedNote) return;

    if (autoSaveTimeout) {
      clearTimeout(autoSaveTimeout);
    }

    const timeout = setTimeout(() => {
      if (editTitle !== selectedNote.title || editContent !== selectedNote.content) {
        saveNoteQuiet();
      }
    }, 2000);

    setAutoSaveTimeout(timeout);

    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [editTitle, editContent]);

  const createNote = async (folderId?: string | null) => {
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
          folder_id: folderId ?? selectedFolderId,
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
      toast.error('Fehler beim Erstellen');
    }
  };

  const moveNoteToFolder = async (noteId: string, folderId: string | null) => {
    try {
      const { error } = await supabase
        .from('notes')
        .update({ folder_id: folderId })
        .eq('id', noteId);

      if (error) throw error;

      setNotes(notes.map(n => n.id === noteId ? { ...n, folder_id: folderId } : n));
      if (selectedNote?.id === noteId) {
        setSelectedNote({ ...selectedNote, folder_id: folderId });
      }
      toast.success(folderId ? 'In Ordner verschoben' : 'Aus Ordner entfernt');
    } catch (error) {
      console.error('Error moving note:', error);
      toast.error('Fehler beim Verschieben');
    }
  };

  const saveNoteQuiet = async () => {
    if (!selectedNote) return;

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
    } catch (error) {
      console.error('Error auto-saving note:', error);
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

  const handleDelete = async () => {
    if (!deleteConfirm.note) return;

    try {
      const { error } = await supabase
        .from('notes')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', deleteConfirm.note.id);

      if (error) throw error;

      setNotes(notes.filter(n => n.id !== deleteConfirm.note!.id));
      if (selectedNote?.id === deleteConfirm.note.id) {
        setSelectedNote(null);
        setIsEditing(false);
      }
      setDeleteConfirm({ isOpen: false, note: null });
      toast.success('In Papierkorb verschoben');
    } catch (error) {
      console.error('Error deleting note:', error);
      toast.error('Fehler beim Löschen');
    }
  };

  const toggleFavorite = async (note: Note) => {
    try {
      const { error } = await supabase
        .from('notes')
        .update({ is_favorite: !note.is_favorite })
        .eq('id', note.id);

      if (error) throw error;

      const updated = { ...note, is_favorite: !note.is_favorite };
      setNotes(notes.map(n => n.id === note.id ? updated : n));
      if (selectedNote?.id === note.id) {
        setSelectedNote(updated);
      }
      toast.success(updated.is_favorite ? 'Zu Favoriten hinzugefügt' : 'Aus Favoriten entfernt');
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

      // Permanently unlock the note
      const { error } = await supabase
        .from('notes')
        .update({ 
          is_secure: false, 
          secure_content: null,
          content: decrypted
        })
        .eq('id', selectedNote.id);

      if (error) throw error;

      const updatedNote = { ...selectedNote, is_secure: false, secure_content: null, content: decrypted };
      setNotes(notes.map(n => n.id === selectedNote.id ? updatedNote : n));
      setSelectedNote(updatedNote);
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
      toast.error('Fehler beim Wiederherstellen');
    }
  };

  const duplicateNote = async (note: Note) => {
    if (!userId) return;

    try {
      const { data, error } = await supabase
        .from('notes')
        .insert({
          user_id: userId,
          title: `${note.title} (Kopie)`,
          content: note.content,
          is_favorite: false,
          is_secure: false,
          tags: note.tags,
        })
        .select()
        .single();

      if (error) throw error;
      
      setNotes([data, ...notes]);
      toast.success('Notiz dupliziert');
    } catch (error) {
      console.error('Error duplicating note:', error);
      toast.error('Fehler beim Duplizieren');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('In Zwischenablage kopiert');
  };

  const shareNote = async (note: Note) => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: note.title,
          text: note.content || '',
        });
      } catch (err) {
        // User cancelled
      }
    } else {
      copyToClipboard(`${note.title}\n\n${note.content || ''}`);
    }
  };

  const filteredNotes = notes.filter(note => {
    if (filterFavorites && !note.is_favorite) return false;
    if (filterSecure && !note.is_secure) return false;
    if (selectedTagFilter && !note.tags?.includes(selectedTagFilter)) return false;
    if (selectedFolderId !== null && note.folder_id !== selectedFolderId) return false;
    if (searchQuery) {
      return note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (note.content || '').toLowerCase().includes(searchQuery.toLowerCase());
    }
    return true;
  });

  // Calculate note counts per folder
  const noteCounts = folders.reduce((acc, folder) => {
    acc[folder.id] = notes.filter(n => n.folder_id === folder.id).length;
    return acc;
  }, {} as Record<string, number>);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getWordCount = (text: string) => {
    return text.trim().split(/\s+/).filter(Boolean).length;
  };

  // Markdown formatting helpers
  const insertMarkdown = (prefix: string, suffix: string = '', placeholder: string = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = editContent.substring(start, end);
    const textToInsert = selectedText || placeholder;
    
    const newContent = 
      editContent.substring(0, start) + 
      prefix + textToInsert + suffix + 
      editContent.substring(end);
    
    setEditContent(newContent);
    
    // Set cursor position after insertion
    setTimeout(() => {
      const newCursorPos = start + prefix.length + textToInsert.length + suffix.length;
      textarea.focus();
      textarea.setSelectionRange(
        selectedText ? newCursorPos : start + prefix.length,
        selectedText ? newCursorPos : start + prefix.length + placeholder.length
      );
    }, 0);
  };

  const formatActions = [
    { icon: Bold, label: 'Fett', action: () => insertMarkdown('**', '**', 'fett') },
    { icon: Italic, label: 'Kursiv', action: () => insertMarkdown('*', '*', 'kursiv') },
    { icon: Heading1, label: 'Überschrift 1', action: () => insertMarkdown('\n# ', '\n', 'Überschrift') },
    { icon: Heading2, label: 'Überschrift 2', action: () => insertMarkdown('\n## ', '\n', 'Überschrift') },
    { icon: Heading3, label: 'Überschrift 3', action: () => insertMarkdown('\n### ', '\n', 'Überschrift') },
    { icon: List, label: 'Liste', action: () => insertMarkdown('\n- ', '\n', 'Listenpunkt') },
    { icon: ListOrdered, label: 'Nummerierte Liste', action: () => insertMarkdown('\n1. ', '\n', 'Listenpunkt') },
    { icon: CheckSquare, label: 'Checkbox', action: () => insertMarkdown('\n- [ ] ', '\n', 'Aufgabe') },
    { icon: Quote, label: 'Zitat', action: () => insertMarkdown('\n> ', '\n', 'Zitat') },
    { icon: Code, label: 'Code', action: () => insertMarkdown('`', '`', 'code') },
    { icon: Link, label: 'Link', action: () => insertMarkdown('[', '](url)', 'Linktext') },
  ];

  return (
    <div className="h-[calc(100vh-6rem)] flex flex-col lg:flex-row gap-4">
      {/* Folder Sidebar */}
      {showFolderSidebar && (
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className={cn(
            "w-full lg:w-56 glass-card p-4 shrink-0",
            selectedNote && "hidden lg:block"
          )}
        >
          <NoteFolderSidebar
            folders={folders}
            selectedFolderId={selectedFolderId}
            onSelectFolder={setSelectedFolderId}
            onCreateFolder={createFolder}
            onUpdateFolder={updateFolder}
            onDeleteFolder={deleteFolder}
            noteCounts={noteCounts}
            totalNotes={notes.length}
          />
        </motion.div>
      )}

      {/* Notes List */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className={cn(
          "w-full lg:w-80 xl:w-96 flex flex-col glass-card",
          selectedNote && "hidden lg:flex"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h1 className="text-xl font-bold text-foreground">Notizen</h1>
          <button
            onClick={() => createNote()}
            className="p-2 rounded-xl bg-gradient-primary hover:shadow-glow transition-all"
          >
            <Plus className="w-5 h-5 text-primary-foreground" />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-border">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Suchen..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl vault-input text-foreground placeholder:text-muted-foreground"
            />
          </div>
        </div>

        {/* Filters */}
        <div className="p-4 border-b border-border space-y-3">
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setFilterFavorites(!filterFavorites)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs flex items-center gap-1 transition-all",
                filterFavorites ? "bg-yellow-500/20 text-yellow-500" : "bg-muted text-muted-foreground"
              )}
            >
              <Star className="w-3 h-3" />
              Favoriten
            </button>
            <button
              onClick={() => setFilterSecure(!filterSecure)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs flex items-center gap-1 transition-all",
                filterSecure ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
              )}
            >
              <Lock className="w-3 h-3" />
              Sicher
            </button>
          </div>

          {/* Tag Filter */}
          {tags.length > 0 && (
            <div className="flex gap-1 flex-wrap">
              {tags.map(tag => (
                <button
                  key={tag.id}
                  onClick={() => setSelectedTagFilter(selectedTagFilter === tag.id ? null : tag.id)}
                  className={cn(
                    "px-2 py-1 rounded text-xs transition-all",
                    selectedTagFilter === tag.id ? "ring-2 ring-primary" : ""
                  )}
                  style={{ backgroundColor: `${tag.color}30`, color: tag.color }}
                >
                  {tag.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Notes List */}
        <div className="flex-1 overflow-y-auto p-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
            </div>
          ) : filteredNotes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>Keine Notizen gefunden</p>
              <button
                onClick={() => createNote()}
                className="mt-4 px-4 py-2 rounded-xl bg-gradient-primary text-primary-foreground text-sm"
              >
                Erste Notiz erstellen
              </button>
            </div>
          ) : (
            <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-2">
              {filteredNotes.map((note) => (
                <motion.div
                  key={note.id}
                  variants={itemVariants}
                  onClick={() => {
                    setSelectedNote(note);
                    setEditTitle(note.title);
                    setEditContent(note.content || '');
                    setIsEditing(false);
                    recordView('note', note.id);
                    if (note.is_secure && note.secure_content) {
                      setPendingSecureAction('unlock');
                      setShowSecureModal(true);
                    }
                  }}
                  className={cn(
                    "p-4 rounded-xl cursor-pointer transition-all group relative",
                    selectedNote?.id === note.id
                      ? "bg-primary/10 border border-primary/30"
                      : "hover:bg-muted border border-transparent"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {note.is_favorite && <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />}
                        {note.is_secure && <Lock className="w-3 h-3 text-primary" />}
                        <h3 className="font-medium text-foreground truncate">{note.title}</h3>
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {note.is_secure ? '[Verschlüsselt]' : (note.content || 'Keine Inhalte')}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <p className="text-xs text-muted-foreground/70">{formatDate(note.updated_at)}</p>
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

                    {/* Quick Actions */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          onClick={(e) => e.stopPropagation()}
                          className="p-1.5 opacity-0 group-hover:opacity-100 hover:bg-muted rounded-lg transition-all"
                        >
                          <MoreVertical className="w-4 h-4 text-muted-foreground" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); toggleFavorite(note); }}>
                          <Star className={cn("w-4 h-4 mr-2", note.is_favorite && "fill-yellow-500 text-yellow-500")} />
                          {note.is_favorite ? 'Aus Favoriten' : 'Zu Favoriten'}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); duplicateNote(note); }}>
                          <Copy className="w-4 h-4 mr-2" />
                          Duplizieren
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); shareNote(note); }}>
                          <Share className="w-4 h-4 mr-2" />
                          Teilen
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setShareToAlbum({ isOpen: true, note }); }}>
                          <Share2 className="w-4 h-4 mr-2" />
                          Zu Album hinzufügen
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {/* Move to folder */}
                        {folders.length > 0 && (
                          <>
                            <div className="px-2 py-1.5 text-xs text-muted-foreground font-medium">In Ordner verschieben</div>
                            {note.folder_id && (
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); moveNoteToFolder(note.id, null); }}>
                                <X className="w-4 h-4 mr-2" />
                                Aus Ordner entfernen
                              </DropdownMenuItem>
                            )}
                            {folders.filter(f => f.id !== note.folder_id).map(folder => (
                              <DropdownMenuItem 
                                key={folder.id}
                                onClick={(e) => { e.stopPropagation(); moveNoteToFolder(note.id, folder.id); }}
                              >
                                <Folder className="w-4 h-4 mr-2" style={{ color: folder.color }} />
                                {folder.name}
                              </DropdownMenuItem>
                            ))}
                            <DropdownMenuSeparator />
                          </>
                        )}
                        <DropdownMenuItem 
                          onClick={(e) => { e.stopPropagation(); setDeleteConfirm({ isOpen: true, note }); }}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Löschen
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}
        </div>

        {/* Stats */}
        <div className="p-4 border-t border-border">
          <p className="text-xs text-muted-foreground text-center">
            {notes.length} Notizen • {notes.filter(n => n.is_favorite).length} Favoriten
          </p>
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
            className="flex-1 glass-card flex flex-col overflow-hidden"
          >
            {/* Editor Header */}
            <div className="flex items-center justify-between p-4 border-b border-border">
              <button
                onClick={() => { setSelectedNote(null); setIsEditing(false); }}
                className="lg:hidden p-2 hover:bg-muted rounded-lg transition-colors"
              >
                <ChevronLeft className="w-5 h-5 text-foreground" />
              </button>
              
              <div className="flex items-center gap-2">
                {/* Favorite Toggle */}
                <button
                  onClick={() => toggleFavorite(selectedNote)}
                  className={cn(
                    "p-2 rounded-lg transition-all",
                    selectedNote.is_favorite ? "bg-yellow-500/20 text-yellow-500" : "hover:bg-muted text-muted-foreground"
                  )}
                  title="Favorit"
                >
                  <Star className={cn("w-4 h-4", selectedNote.is_favorite && "fill-yellow-500")} />
                </button>

                {/* Tag Selector */}
                <div className="relative">
                  <button
                    onClick={() => setShowTagSelector(!showTagSelector)}
                    className="p-2 rounded-lg hover:bg-muted text-muted-foreground transition-all"
                    title="Tags"
                  >
                    <Tag className="w-4 h-4" />
                  </button>
                  {showTagSelector && (
                    <div className="absolute top-full right-0 mt-2 w-56 glass-card p-3 z-20 space-y-2">
                      <p className="text-xs text-muted-foreground font-medium mb-2">Tags auswählen</p>
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
                            selectedNote.tags?.includes(tag.id) ? "bg-muted" : "hover:bg-muted/50"
                          )}
                        >
                          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: tag.color }} />
                          <span className="text-foreground text-sm">{tag.name}</span>
                          {selectedNote.tags?.includes(tag.id) && (
                            <span className="ml-auto text-primary">✓</span>
                          )}
                        </button>
                      ))}
                      <button
                        onClick={() => setShowTagSelector(false)}
                        className="w-full mt-2 py-2 text-sm text-muted-foreground hover:text-foreground"
                      >
                        Schließen
                      </button>
                    </div>
                  )}
                </div>

                {/* Version History */}
                <button
                  onClick={() => {
                    fetchVersions(selectedNote.id);
                    setShowVersions(true);
                  }}
                  className="p-2 rounded-lg hover:bg-muted text-muted-foreground transition-all"
                  title="Versionen"
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
                    selectedNote.is_secure ? "bg-primary/20 text-primary" : "hover:bg-muted text-muted-foreground"
                  )}
                  title={selectedNote.is_secure ? "Entsperren" : "Verschlüsseln"}
                >
                  {selectedNote.is_secure ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                </button>

                {/* Edit/Save Button */}
                {isEditing ? (
                  <button
                    onClick={saveNote}
                    disabled={isSaving}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-primary hover:shadow-glow transition-all disabled:opacity-50"
                  >
                    {isSaving ? (
                      <Loader2 className="w-4 h-4 text-primary-foreground animate-spin" />
                    ) : (
                      <Save className="w-4 h-4 text-primary-foreground" />
                    )}
                    <span className="text-primary-foreground text-sm">Speichern</span>
                  </button>
                ) : (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border hover:bg-muted transition-all"
                  >
                    <Edit2 className="w-4 h-4 text-foreground" />
                    <span className="text-foreground text-sm">Bearbeiten</span>
                  </button>
                )}
              </div>
            </div>

            {/* Tag Display */}
            {selectedNote.tags?.length > 0 && (
              <div className="flex gap-2 px-6 pt-4 flex-wrap">
                {selectedNote.tags.map(tagId => {
                  const tag = tags.find(t => t.id === tagId);
                  return tag ? (
                    <span
                      key={tagId}
                      className="px-3 py-1 rounded-full text-xs font-medium"
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
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Formatting Toolbar */}
                <div className="flex items-center gap-1 px-6 py-3 border-b border-border bg-muted/30 flex-wrap">
                  {formatActions.map((action, index) => (
                    <button
                      key={index}
                      onClick={action.action}
                      className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                      title={action.label}
                    >
                      <action.icon className="w-4 h-4" />
                    </button>
                  ))}
                  
                  {/* OCR Scanner Button */}
                  <OCRScanner 
                    onTextExtracted={(text) => {
                      setEditContent(prev => prev + (prev ? '\n\n' : '') + text);
                      toast.success('Text eingefügt');
                    }}
                    trigger={
                      <button
                        className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                        title="Text aus Bild (OCR)"
                      >
                        <Scan className="w-4 h-4" />
                      </button>
                    }
                  />
                  
                  <div className="flex-1" />
                  <button
                    onClick={() => setShowPreview(!showPreview)}
                    className={cn(
                      "flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors text-sm",
                      showPreview ? "bg-primary/20 text-primary" : "hover:bg-muted text-muted-foreground"
                    )}
                  >
                    {showPreview ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    <span className="hidden sm:inline">{showPreview ? 'Editor' : 'Vorschau'}</span>
                  </button>
                </div>

                <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
                  {/* Editor Panel */}
                  <div className={cn(
                    "flex-1 flex flex-col p-6 overflow-hidden",
                    showPreview && "hidden lg:flex lg:border-r lg:border-border"
                  )}>
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      placeholder="Titel..."
                      className="text-2xl font-bold bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground mb-4"
                    />
                    <textarea
                      ref={textareaRef}
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      placeholder="Schreibe deine Notiz... (Markdown unterstützt)"
                      className="flex-1 bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground resize-none font-mono text-sm leading-relaxed select-text cursor-text"
                      style={{ userSelect: 'text', WebkitUserSelect: 'text' }}
                    />
                  </div>

                  {/* Preview Panel */}
                  {showPreview && (
                    <div className="flex-1 overflow-y-auto p-6 bg-background/50">
                      <h1 className="text-2xl font-bold text-foreground mb-6">{editTitle || 'Vorschau'}</h1>
                      <div className="prose prose-neutral dark:prose-invert max-w-none">
                        <ReactMarkdown
                          components={{
                            code: ({ className, children, ...props }) => {
                              const match = /language-(\w+)/.exec(className || '');
                              const isInline = !match && String(children).split('\n').length === 1;
                              
                              if (isInline) {
                                return (
                                  <code className="bg-muted rounded px-1.5 py-0.5 text-primary font-mono text-sm">
                                    {children}
                                  </code>
                                );
                              }
                              
                              return match ? (
                                <SyntaxHighlighter
                                  style={oneDark}
                                  language={match[1]}
                                  PreTag="div"
                                  className="rounded-xl !bg-[#1e1e2e] !mt-0 !mb-4"
                                  customStyle={{ 
                                    fontSize: '0.875rem',
                                    borderRadius: '0.75rem',
                                    padding: '1rem',
                                    margin: 0,
                                  }}
                                >
                                  {String(children).replace(/\n$/, '')}
                                </SyntaxHighlighter>
                              ) : (
                                <code className="bg-muted rounded px-1.5 py-0.5 text-primary font-mono text-sm block p-4 overflow-x-auto">
                                  {children}
                                </code>
                              );
                            },
                            pre: ({ children }) => <>{children}</>,
                            h1: ({ children }) => <h1 className="text-2xl font-bold text-foreground mt-6 mb-4">{children}</h1>,
                            h2: ({ children }) => <h2 className="text-xl font-bold text-foreground mt-5 mb-3">{children}</h2>,
                            h3: ({ children }) => <h3 className="text-lg font-bold text-foreground mt-4 mb-2">{children}</h3>,
                            p: ({ children }) => <p className="text-foreground mb-4 leading-relaxed">{children}</p>,
                            ul: ({ children }) => <ul className="list-disc list-inside text-foreground mb-4 space-y-1">{children}</ul>,
                            ol: ({ children }) => <ol className="list-decimal list-inside text-foreground mb-4 space-y-1">{children}</ol>,
                            li: ({ children }) => {
                              const text = String(children);
                              if (text.startsWith('[ ] ')) {
                                return <li className="flex items-center gap-2"><span className="w-4 h-4 border border-muted-foreground rounded" />{text.slice(4)}</li>;
                              }
                              if (text.startsWith('[x] ')) {
                                return <li className="flex items-center gap-2"><span className="w-4 h-4 bg-primary rounded flex items-center justify-center text-xs text-primary-foreground">✓</span>{text.slice(4)}</li>;
                              }
                              return <li>{children}</li>;
                            },
                            a: ({ href, children }) => <a href={href} className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">{children}</a>,
                            blockquote: ({ children }) => <blockquote className="border-l-4 border-primary pl-4 italic text-muted-foreground my-4">{children}</blockquote>,
                          }}
                        >
                          {editContent || '*Schreibe etwas um die Vorschau zu sehen...*'}
                        </ReactMarkdown>
                      </div>
                    </div>
                  )}
                </div>

                {/* Attachments Panel */}
                <NoteAttachmentsPanel
                  attachments={attachments}
                  isLoading={attachmentsLoading}
                  isUploading={attachmentsUploading}
                  isEditing={true}
                  onUpload={uploadAttachment}
                  onDelete={deleteAttachment}
                />

                <div className="px-6 py-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                  <span>{getWordCount(editContent)} Wörter • {editContent.length} Zeichen • {attachments.length} Anhänge</span>
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    Auto-Save aktiv
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="flex-1 overflow-y-auto p-6">
                  <h1 className="text-2xl font-bold text-foreground mb-6">{selectedNote.title}</h1>
                  <div className="prose prose-neutral dark:prose-invert max-w-none">
                    <ReactMarkdown
                      components={{
                        code: ({ className, children }) => (
                          <code className={cn(className, "bg-muted rounded px-2 py-1 text-primary font-mono text-sm")}>
                            {children}
                          </code>
                        ),
                        pre: ({ children }) => (
                          <pre className="bg-muted rounded-xl p-4 overflow-x-auto border border-border">
                            {children}
                          </pre>
                        ),
                        h1: ({ children }) => <h1 className="text-2xl font-bold text-foreground mt-6 mb-4">{children}</h1>,
                        h2: ({ children }) => <h2 className="text-xl font-bold text-foreground mt-5 mb-3">{children}</h2>,
                        h3: ({ children }) => <h3 className="text-lg font-bold text-foreground mt-4 mb-2">{children}</h3>,
                        p: ({ children }) => <p className="text-foreground mb-4 leading-relaxed">{children}</p>,
                        ul: ({ children }) => <ul className="list-disc list-inside text-foreground mb-4 space-y-1">{children}</ul>,
                        ol: ({ children }) => <ol className="list-decimal list-inside text-foreground mb-4 space-y-1">{children}</ol>,
                        a: ({ href, children }) => <a href={href} className="text-primary hover:underline">{children}</a>,
                        blockquote: ({ children }) => <blockquote className="border-l-4 border-primary pl-4 italic text-muted-foreground my-4">{children}</blockquote>,
                      }}
                    >
                      {editContent || '*Keine Inhalte*'}
                    </ReactMarkdown>
                  </div>
                </div>

                {/* Attachments Panel in View Mode */}
                {attachments.length > 0 && (
                  <NoteAttachmentsPanel
                    attachments={attachments}
                    isLoading={attachmentsLoading}
                    isUploading={false}
                    isEditing={false}
                    onUpload={() => {}}
                    onDelete={() => {}}
                  />
                )}
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex-1 glass-card hidden lg:flex items-center justify-center"
          >
            <div className="text-center text-muted-foreground">
              <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p className="mb-4">Wähle eine Notiz aus oder erstelle eine neue</p>
              <button
                onClick={() => createNote()}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-primary text-primary-foreground hover:shadow-glow transition-all"
              >
                <Plus className="w-5 h-5" />
                Neue Notiz
              </button>
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
                {pendingSecureAction === 'lock' ? (
                  <Lock className="w-6 h-6 text-primary" />
                ) : (
                  <Unlock className="w-6 h-6 text-primary" />
                )}
                <h3 className="text-xl font-bold text-foreground">
                  {pendingSecureAction === 'lock' ? 'Notiz verschlüsseln' : 'Notiz entschlüsseln'}
                </h3>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                {pendingSecureAction === 'lock' 
                  ? 'Gib ein Passwort ein, um die Notiz zu verschlüsseln.' 
                  : 'Gib das Passwort ein, um die Notiz zu entschlüsseln.'}
              </p>
              <input
                type="password"
                value={securePassword}
                onChange={(e) => setSecurePassword(e.target.value)}
                placeholder="Passwort eingeben..."
                className="w-full px-4 py-3 rounded-xl vault-input text-foreground placeholder:text-muted-foreground mb-4"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && (pendingSecureAction === 'lock' ? lockNote() : unlockNote())}
              />
              <div className="flex gap-3">
                <button
                  onClick={() => { setShowSecureModal(false); setSecurePassword(''); }}
                  className="flex-1 py-3 rounded-xl border border-border text-foreground hover:bg-muted"
                >
                  Abbrechen
                </button>
                <button
                  onClick={pendingSecureAction === 'lock' ? lockNote : unlockNote}
                  disabled={!securePassword}
                  className="flex-1 py-3 rounded-xl bg-gradient-primary text-primary-foreground hover:shadow-glow disabled:opacity-50"
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
              className="glass-card p-6 w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-4">
                <History className="w-6 h-6 text-primary" />
                <h3 className="text-xl font-bold text-foreground">Versionshistorie</h3>
                <span className="text-muted-foreground text-sm ml-auto">{versions.length} Versionen</span>
              </div>
              
              <div className="flex-1 overflow-y-auto space-y-3">
                {versions.length === 0 ? (
                  <div className="text-center py-12">
                    <History className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-muted-foreground">Keine früheren Versionen</p>
                    <p className="text-muted-foreground/60 text-sm mt-1">Versionen werden beim Speichern erstellt</p>
                  </div>
                ) : (
                  versions.map((version, index) => (
                    <motion.div 
                      key={version.id} 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="p-4 rounded-xl bg-muted/50 hover:bg-muted transition-colors group"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-primary font-semibold text-sm">v{version.version_number}</span>
                            <span className="text-muted-foreground text-xs">•</span>
                            <span className="text-muted-foreground text-sm">{formatDate(version.created_at)}</span>
                          </div>
                          <p className="text-foreground font-medium truncate">{version.title}</p>
                          {version.content && (
                            <p className="text-muted-foreground text-sm line-clamp-2 mt-2">
                              {version.content.slice(0, 150)}{version.content.length > 150 ? '...' : ''}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={() => restoreVersion(version)}
                          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary transition-all shrink-0"
                        >
                          <RotateCcw className="w-4 h-4" />
                          <span className="text-sm hidden sm:inline">Wiederherstellen</span>
                        </button>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
              
              <button
                onClick={() => setShowVersions(false)}
                className="mt-4 w-full py-3 rounded-xl border border-border text-foreground hover:bg-muted"
              >
                Schließen
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation */}
      <DeleteConfirmDialog
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, note: null })}
        onConfirm={handleDelete}
        itemName={deleteConfirm.note?.title}
      />

      {/* Share to Album Dialog */}
      <ShareToAlbumDialog
        isOpen={shareToAlbum.isOpen}
        onClose={() => setShareToAlbum({ isOpen: false, note: null })}
        itemId={shareToAlbum.note?.id || ''}
        itemType="note"
        contentType="notes"
      />

      {/* Click outside to close tag selector */}
      {showTagSelector && (
        <div 
          className="fixed inset-0 z-10" 
          onClick={() => setShowTagSelector(false)}
        />
      )}
    </div>
  );
}
