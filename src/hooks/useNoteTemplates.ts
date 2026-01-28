import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

export interface NoteTemplate {
  id: string;
  name: string;
  content: string;
  icon: string;
  isSystem: boolean;
  isFavorite: boolean;
  createdAt?: string;
}

const SYSTEM_TEMPLATES: Omit<NoteTemplate, 'id' | 'createdAt'>[] = [
  {
    name: 'Meeting-Notiz',
    icon: 'Users',
    isSystem: true,
    isFavorite: false,
    content: `# Meeting: {{title}}

**Datum:** {{date}}
**Uhrzeit:** {{time}}
**Teilnehmer:** 

---

## Agenda

1. 
2. 
3. 

## Notizen



## Aktionspunkte

- [ ] 
- [ ] 
- [ ] 

## Nächste Schritte

`,
  },
  {
    name: 'To-Do Liste',
    icon: 'CheckSquare',
    isSystem: true,
    isFavorite: false,
    content: `# {{title}}

**Erstellt:** {{date}}

---

## Heute

- [ ] 
- [ ] 
- [ ] 

## Diese Woche

- [ ] 
- [ ] 

## Später

- [ ] 

---

*Prioritäten setzen, dann erledigen!*
`,
  },
  {
    name: 'Tagebuch',
    icon: 'BookOpen',
    isSystem: true,
    isFavorite: false,
    content: `# {{date}}

## Wie war mein Tag?



## Was habe ich heute gelernt?



## Wofür bin ich dankbar?

1. 
2. 
3. 

## Gedanken & Reflexionen



---

*"Jeder Tag ist eine neue Chance."*
`,
  },
  {
    name: 'Projekt-Plan',
    icon: 'Layers',
    isSystem: true,
    isFavorite: false,
    content: `# Projekt: {{title}}

**Start:** {{date}}
**Deadline:** 
**Status:** 🟡 In Bearbeitung

---

## Ziel

Was soll erreicht werden?

## Meilensteine

- [ ] Meilenstein 1
- [ ] Meilenstein 2
- [ ] Meilenstein 3

## Ressourcen

- 
- 

## Risiken

| Risiko | Wahrscheinlichkeit | Maßnahme |
|--------|-------------------|----------|
|        |                   |          |

## Notizen

`,
  },
  {
    name: 'Rezept',
    icon: 'ChefHat',
    isSystem: true,
    isFavorite: false,
    content: `# {{title}}

**Portionen:** 4
**Zubereitungszeit:** 30 Min.
**Schwierigkeit:** Mittel

---

## Zutaten

- 
- 
- 

## Zubereitung

1. 
2. 
3. 

## Tipps

- 

---

*Guten Appetit!* 🍽️
`,
  },
  {
    name: 'Workout-Log',
    icon: 'Dumbbell',
    isSystem: true,
    isFavorite: false,
    content: `# Workout {{date}}

**Trainingsart:** 
**Dauer:** Min.
**Intensität:** ⭐⭐⭐☆☆

---

## Übungen

| Übung | Sätze | Wiederholungen | Gewicht |
|-------|-------|----------------|---------|
|       |       |                |         |
|       |       |                |         |
|       |       |                |         |

## Cardio

- 

## Notizen



## Wie fühle ich mich?

😊 / 😐 / 😓

---

*Keep pushing!* 💪
`,
  },
  {
    name: 'Brainstorming',
    icon: 'Lightbulb',
    isSystem: true,
    isFavorite: false,
    content: `# Brainstorming: {{title}}

**Datum:** {{date}}
**Thema:** 

---

## Ideen

- 💡 
- 💡 
- 💡 

## Mindmap

\`\`\`
          [Hauptthema]
         /     |     \\
      [A]     [B]     [C]
      /|\\    /|\\     /|\\
\`\`\`

## Priorisierung

### Sofort umsetzen
1. 

### Später evaluieren
1. 

### Parken
1. 

---

*Keine Idee ist eine schlechte Idee!*
`,
  },
  {
    name: 'Leere Notiz',
    icon: 'FileText',
    isSystem: true,
    isFavorite: false,
    content: '',
  },
];

export function useNoteTemplates() {
  const { userId, supabaseClient: supabase } = useAuth();
  const [customTemplates, setCustomTemplates] = useState<NoteTemplate[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch custom templates
  const fetchTemplates = useCallback(async () => {
    if (!userId) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('note_templates')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setCustomTemplates((data || []).map(t => ({
        id: t.id,
        name: t.name,
        content: t.content,
        icon: t.icon || 'FileText',
        isSystem: false,
        isFavorite: t.is_favorite || false,
        createdAt: t.created_at,
      })));
    } catch (error) {
      console.error('Error fetching templates:', error);
    } finally {
      setLoading(false);
    }
  }, [userId, supabase]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  // Get all templates (system + custom)
  const allTemplates = [
    ...SYSTEM_TEMPLATES.map((t, i) => ({ ...t, id: `system-${i}` })),
    ...customTemplates,
  ];

  // Replace variables in template content
  const processTemplate = useCallback((content: string, title?: string) => {
    const now = new Date();
    return content
      .replace(/\{\{date\}\}/g, format(now, 'dd. MMMM yyyy', { locale: de }))
      .replace(/\{\{time\}\}/g, format(now, 'HH:mm'))
      .replace(/\{\{title\}\}/g, title || 'Unbenannt')
      .replace(/\{\{weekday\}\}/g, format(now, 'EEEE', { locale: de }));
  }, []);

  // Create custom template
  const createTemplate = useCallback(async (template: { name: string; content: string; icon: string }) => {
    if (!userId) return null;

    try {
      const { data, error } = await supabase
        .from('note_templates')
        .insert({
          user_id: userId,
          name: template.name,
          content: template.content,
          icon: template.icon,
        })
        .select()
        .single();

      if (error) throw error;
      
      await fetchTemplates();
      return data;
    } catch (error) {
      console.error('Error creating template:', error);
      return null;
    }
  }, [userId, supabase, fetchTemplates]);

  // Update template
  const updateTemplate = useCallback(async (id: string, updates: Partial<NoteTemplate>) => {
    if (!userId || id.startsWith('system-')) return false;

    try {
      const { error } = await supabase
        .from('note_templates')
        .update({
          name: updates.name,
          content: updates.content,
          icon: updates.icon,
          is_favorite: updates.isFavorite,
        })
        .eq('id', id)
        .eq('user_id', userId);

      if (error) throw error;
      
      await fetchTemplates();
      return true;
    } catch (error) {
      console.error('Error updating template:', error);
      return false;
    }
  }, [userId, supabase, fetchTemplates]);

  // Delete template
  const deleteTemplate = useCallback(async (id: string) => {
    if (!userId || id.startsWith('system-')) return false;

    try {
      const { error } = await supabase
        .from('note_templates')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);

      if (error) throw error;
      
      await fetchTemplates();
      return true;
    } catch (error) {
      console.error('Error deleting template:', error);
      return false;
    }
  }, [userId, supabase, fetchTemplates]);

  // Toggle favorite
  const toggleFavorite = useCallback(async (id: string) => {
    const template = allTemplates.find(t => t.id === id);
    if (!template || id.startsWith('system-')) return false;

    return updateTemplate(id, { isFavorite: !template.isFavorite });
  }, [allTemplates, updateTemplate]);

  return {
    templates: allTemplates,
    customTemplates,
    systemTemplates: SYSTEM_TEMPLATES.map((t, i) => ({ ...t, id: `system-${i}` })),
    loading,
    processTemplate,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    toggleFavorite,
    refresh: fetchTemplates,
  };
}
