import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Shield, 
  Plus, 
  Trash2, 
  Image, 
  FileText, 
  File,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Sparkles,
  Folder
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface DecoyItem {
  id: string;
  type: 'note' | 'photo' | 'file';
  title: string;
  content?: string;
  preview?: string;
}

interface DecoyVaultManagerProps {
  onClose?: () => void;
}

// Predefined decoy data templates
const DECOY_TEMPLATES = {
  notes: [
    { title: 'Einkaufsliste', content: '- Milch\n- Brot\n- Butter\n- Eier\n- Käse' },
    { title: 'Termine', content: 'Montag: Zahnarzt 10:00\nMittwoch: Meeting 14:00\nFreitag: Sport 18:00' },
    { title: 'Rezept - Spaghetti', content: '500g Spaghetti\n400g Tomaten\n2 Knoblauchzehen\nBasilikum\nOlivenöl' },
    { title: 'Urlaubsplanung', content: 'Mögliche Ziele:\n- Barcelona\n- Rom\n- Paris\n\nBudget: ca. 1500€' },
    { title: 'Geburtstagsideen', content: 'Mama: Blumen + Restaurant\nPapa: Werkzeug\nSchwester: Gutschein' },
    { title: 'Workout-Plan', content: 'Mo: Brust + Trizeps\nDi: Rücken + Bizeps\nMi: Pause\nDo: Beine\nFr: Schultern' },
    { title: 'Bücherliste', content: '- Der Alchemist\n- 1984\n- Sapiens\n- Atomic Habits' },
    { title: 'Filmabend', content: 'Noch zu schauen:\n- Inception\n- Interstellar\n- The Matrix' },
  ],
  photos: [
    { title: 'Strand Urlaub', preview: '🏖️' },
    { title: 'Berge Wanderung', preview: '🏔️' },
    { title: 'Stadtbummel', preview: '🏙️' },
    { title: 'Essen', preview: '🍕' },
    { title: 'Haustier', preview: '🐕' },
    { title: 'Familie', preview: '👨‍👩‍👧' },
    { title: 'Sonnenuntergang', preview: '🌅' },
    { title: 'Party', preview: '🎉' },
  ],
  files: [
    { title: 'Lebenslauf.pdf', preview: '📄' },
    { title: 'Rechnung_2024.pdf', preview: '📄' },
    { title: 'Vertrag.docx', preview: '📝' },
    { title: 'Präsentation.pptx', preview: '📊' },
    { title: 'Tabelle.xlsx', preview: '📈' },
    { title: 'Foto_001.jpg', preview: '🖼️' },
  ],
};

export function DecoyVaultManager({ onClose }: DecoyVaultManagerProps) {
  const { userId } = useAuth();
  const [decoyItems, setDecoyItems] = useState<DecoyItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedTab, setSelectedTab] = useState<'notes' | 'photos' | 'files'>('notes');

  // Load saved decoy items
  useEffect(() => {
    if (!userId) return;
    
    const saved = localStorage.getItem(`decoy-vault-${userId}`);
    if (saved) {
      try {
        setDecoyItems(JSON.parse(saved));
      } catch (e) {
        console.error('Error loading decoy items:', e);
      }
    }
    setIsLoading(false);
  }, [userId]);

  // Save decoy items
  const saveItems = (items: DecoyItem[]) => {
    if (!userId) return;
    localStorage.setItem(`decoy-vault-${userId}`, JSON.stringify(items));
    setDecoyItems(items);
  };

  // Generate random decoy data
  const generateDecoyData = () => {
    setIsGenerating(true);
    
    setTimeout(() => {
      const newItems: DecoyItem[] = [];
      
      // Add random notes
      const noteTemplates = DECOY_TEMPLATES.notes;
      const selectedNotes = noteTemplates
        .sort(() => Math.random() - 0.5)
        .slice(0, 4);
      
      selectedNotes.forEach((note, idx) => {
        newItems.push({
          id: `decoy-note-${Date.now()}-${idx}`,
          type: 'note',
          title: note.title,
          content: note.content,
        });
      });

      // Add random photos
      const photoTemplates = DECOY_TEMPLATES.photos;
      const selectedPhotos = photoTemplates
        .sort(() => Math.random() - 0.5)
        .slice(0, 6);
      
      selectedPhotos.forEach((photo, idx) => {
        newItems.push({
          id: `decoy-photo-${Date.now()}-${idx}`,
          type: 'photo',
          title: photo.title,
          preview: photo.preview,
        });
      });

      // Add random files
      const fileTemplates = DECOY_TEMPLATES.files;
      const selectedFiles = fileTemplates
        .sort(() => Math.random() - 0.5)
        .slice(0, 3);
      
      selectedFiles.forEach((file, idx) => {
        newItems.push({
          id: `decoy-file-${Date.now()}-${idx}`,
          type: 'file',
          title: file.title,
          preview: file.preview,
        });
      });

      saveItems(newItems);
      setIsGenerating(false);
      toast.success('Decoy-Inhalte generiert');
    }, 1500);
  };

  // Add custom decoy item
  const addCustomItem = (type: 'note' | 'photo' | 'file') => {
    const title = prompt(`${type === 'note' ? 'Notiz' : type === 'photo' ? 'Foto' : 'Datei'}-Titel:`);
    if (!title) return;

    const newItem: DecoyItem = {
      id: `decoy-${type}-${Date.now()}`,
      type,
      title,
      content: type === 'note' ? 'Beispielinhalt...' : undefined,
      preview: type === 'photo' ? '🖼️' : type === 'file' ? '📄' : undefined,
    };

    saveItems([...decoyItems, newItem]);
    toast.success('Decoy-Element hinzugefügt');
  };

  // Remove decoy item
  const removeItem = (id: string) => {
    saveItems(decoyItems.filter(item => item.id !== id));
    toast.success('Element entfernt');
  };

  // Clear all decoy data
  const clearAll = () => {
    if (confirm('Alle Decoy-Inhalte löschen?')) {
      saveItems([]);
      toast.success('Alle Decoy-Inhalte gelöscht');
    }
  };

  const filteredItems = decoyItems.filter(item => {
    if (selectedTab === 'notes') return item.type === 'note';
    if (selectedTab === 'photos') return item.type === 'photo';
    return item.type === 'file';
  });

  const getItemIcon = (type: string) => {
    switch (type) {
      case 'note': return <FileText className="w-5 h-5" />;
      case 'photo': return <Image className="w-5 h-5" />;
      case 'file': return <File className="w-5 h-5" />;
      default: return <Folder className="w-5 h-5" />;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center">
            <Shield className="w-5 h-5 text-orange-500" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Decoy-Vault</h2>
            <p className="text-sm text-muted-foreground">Fake-Inhalte für Notfall</p>
          </div>
        </div>
      </div>

      {/* Info Box */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-orange-500/10 border border-orange-500/20">
        <AlertTriangle className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-medium text-foreground mb-1">Was ist der Decoy-Vault?</p>
          <p className="text-muted-foreground">
            Wenn du mit dem Decoy-PIN einloggst, werden diese harmlosen Fake-Inhalte 
            angezeigt statt deiner echten Daten. Perfekt für Situationen, in denen 
            du dein Gerät entsperren musst.
          </p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={generateDecoyData}
          disabled={isGenerating}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {isGenerating ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4" />
          )}
          {isGenerating ? 'Generiere...' : 'Auto-Generieren'}
        </button>

        <button
          onClick={clearAll}
          disabled={decoyItems.length === 0}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors disabled:opacity-50"
        >
          <Trash2 className="w-4 h-4" />
          Alle löschen
        </button>
      </div>

      {/* Status */}
      <div className={cn(
        "flex items-center gap-2 px-4 py-3 rounded-xl",
        decoyItems.length > 0 
          ? "bg-green-500/10 text-green-500"
          : "bg-yellow-500/10 text-yellow-500"
      )}>
        {decoyItems.length > 0 ? (
          <>
            <CheckCircle className="w-5 h-5" />
            <span>{decoyItems.length} Decoy-Elemente konfiguriert</span>
          </>
        ) : (
          <>
            <AlertTriangle className="w-5 h-5" />
            <span>Keine Decoy-Inhalte - Vault erscheint leer</span>
          </>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-muted rounded-xl">
        {(['notes', 'photos', 'files'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setSelectedTab(tab)}
            className={cn(
              "flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors",
              selectedTab === tab
                ? "bg-background text-foreground shadow"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab === 'notes' ? 'Notizen' : tab === 'photos' ? 'Fotos' : 'Dateien'}
            <span className="ml-1 text-xs opacity-60">
              ({decoyItems.filter(i => i.type === (tab === 'notes' ? 'note' : tab === 'photos' ? 'photo' : 'file')).length})
            </span>
          </button>
        ))}
      </div>

      {/* Items List */}
      <div className="space-y-2 max-h-64 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>Keine {selectedTab === 'notes' ? 'Notizen' : selectedTab === 'photos' ? 'Fotos' : 'Dateien'}</p>
          </div>
        ) : (
          filteredItems.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors"
            >
              <div className="w-10 h-10 rounded-lg bg-background flex items-center justify-center text-muted-foreground">
                {item.preview ? (
                  <span className="text-xl">{item.preview}</span>
                ) : (
                  getItemIcon(item.type)
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="font-medium text-foreground truncate">{item.title}</div>
                {item.content && (
                  <div className="text-sm text-muted-foreground truncate">
                    {item.content.substring(0, 50)}...
                  </div>
                )}
              </div>

              <button
                onClick={() => removeItem(item.id)}
                className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))
        )}
      </div>

      {/* Add Custom */}
      <button
        onClick={() => addCustomItem(selectedTab === 'notes' ? 'note' : selectedTab === 'photos' ? 'photo' : 'file')}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-border hover:border-primary/50 text-muted-foreground hover:text-foreground transition-colors"
      >
        <Plus className="w-5 h-5" />
        Eigenes {selectedTab === 'notes' ? 'Notiz' : selectedTab === 'photos' ? 'Foto' : 'Datei'} hinzufügen
      </button>
    </motion.div>
  );
}
