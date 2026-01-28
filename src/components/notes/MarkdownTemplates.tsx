import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  FileText, Users, CheckSquare, BookOpen, Layers, 
  ChefHat, Dumbbell, Lightbulb, Plus, Star, StarOff, Trash2, Edit2
} from 'lucide-react';
import { useNoteTemplates, NoteTemplate } from '@/hooks/useNoteTemplates';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  FileText,
  Users,
  CheckSquare,
  BookOpen,
  Layers,
  ChefHat,
  Dumbbell,
  Lightbulb,
};

interface MarkdownTemplatesProps {
  open: boolean;
  onClose: () => void;
  onSelect: (content: string) => void;
}

export function MarkdownTemplates({ open, onClose, onSelect }: MarkdownTemplatesProps) {
  const { templates, processTemplate, createTemplate, deleteTemplate, toggleFavorite, loading } = useNoteTemplates();
  const [activeTab, setActiveTab] = useState<'all' | 'favorites' | 'create'>('all');
  const [newTemplate, setNewTemplate] = useState({ name: '', content: '', icon: 'FileText' });
  const [isCreating, setIsCreating] = useState(false);

  const handleSelect = (template: NoteTemplate) => {
    const processed = processTemplate(template.content);
    onSelect(processed);
    onClose();
  };

  const handleCreateTemplate = async () => {
    if (!newTemplate.name.trim()) return;
    
    setIsCreating(true);
    await createTemplate(newTemplate);
    setNewTemplate({ name: '', content: '', icon: 'FileText' });
    setActiveTab('all');
    setIsCreating(false);
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await deleteTemplate(id);
  };

  const handleToggleFavorite = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await toggleFavorite(id);
  };

  const favoriteTemplates = templates.filter(t => t.isFavorite);

  const TemplateCard = ({ template }: { template: NoteTemplate }) => {
    const Icon = ICONS[template.icon] || FileText;
    
    return (
      <motion.div
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => handleSelect(template)}
        className={cn(
          "relative p-4 rounded-xl border cursor-pointer transition-all",
          "bg-card hover:bg-muted/50 border-border hover:border-primary/30",
          "group"
        )}
      >
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Icon className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-foreground truncate">{template.name}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {template.isSystem ? 'System' : 'Eigene'}
            </p>
          </div>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {!template.isSystem && (
              <>
                <button
                  onClick={(e) => handleToggleFavorite(e, template.id)}
                  className="p-1.5 rounded-lg hover:bg-muted"
                >
                  {template.isFavorite ? (
                    <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                  ) : (
                    <StarOff className="w-4 h-4 text-muted-foreground" />
                  )}
                </button>
                <button
                  onClick={(e) => handleDelete(e, template.id)}
                  className="p-1.5 rounded-lg hover:bg-destructive/10"
                >
                  <Trash2 className="w-4 h-4 text-destructive" />
                </button>
              </>
            )}
          </div>
        </div>
        {template.content && (
          <p className="text-xs text-muted-foreground mt-3 line-clamp-2">
            {template.content.slice(0, 100)}...
          </p>
        )}
      </motion.div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Vorlage auswählen</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid grid-cols-3">
            <TabsTrigger value="all">Alle</TabsTrigger>
            <TabsTrigger value="favorites">
              Favoriten ({favoriteTemplates.length})
            </TabsTrigger>
            <TabsTrigger value="create">
              <Plus className="w-4 h-4 mr-1" />
              Erstellen
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="flex-1 overflow-y-auto mt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {templates.map(template => (
                <TemplateCard key={template.id} template={template} />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="favorites" className="flex-1 overflow-y-auto mt-4">
            {favoriteTemplates.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Star className="w-12 h-12 mx-auto mb-4 opacity-30" />
                <p>Keine Favoriten vorhanden</p>
                <p className="text-sm mt-1">Markiere Vorlagen als Favorit für schnellen Zugriff</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {favoriteTemplates.map(template => (
                  <TemplateCard key={template.id} template={template} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="create" className="flex-1 overflow-y-auto mt-4 space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                Name
              </label>
              <Input
                value={newTemplate.name}
                onChange={(e) => setNewTemplate(prev => ({ ...prev, name: e.target.value }))}
                placeholder="z.B. Wöchentlicher Review"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                Icon
              </label>
              <div className="flex flex-wrap gap-2">
                {Object.entries(ICONS).map(([name, Icon]) => (
                  <button
                    key={name}
                    onClick={() => setNewTemplate(prev => ({ ...prev, icon: name }))}
                    className={cn(
                      "p-2 rounded-lg border transition-all",
                      newTemplate.icon === name
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/50"
                    )}
                  >
                    <Icon className="w-5 h-5" />
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1">
              <label className="text-sm font-medium text-foreground mb-2 block">
                Inhalt (Markdown)
              </label>
              <p className="text-xs text-muted-foreground mb-2">
                Variablen: {'{{date}}'}, {'{{time}}'}, {'{{title}}'}, {'{{weekday}}'}
              </p>
              <Textarea
                value={newTemplate.content}
                onChange={(e) => setNewTemplate(prev => ({ ...prev, content: e.target.value }))}
                placeholder="# {{title}}&#10;&#10;Erstellt am {{date}}..."
                className="min-h-[200px] font-mono text-sm"
              />
            </div>

            <Button
              onClick={handleCreateTemplate}
              disabled={!newTemplate.name.trim() || isCreating}
              className="w-full"
            >
              {isCreating ? 'Erstelle...' : 'Vorlage erstellen'}
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
