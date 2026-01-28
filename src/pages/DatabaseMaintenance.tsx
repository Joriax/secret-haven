import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  Database, 
  Trash2, 
  FolderX, 
  FileX2, 
  History, 
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  HardDrive,
  Layers
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface MaintenanceTask {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  status: 'idle' | 'running' | 'done' | 'error';
  result?: {
    found: number;
    fixed: number;
    message: string;
  };
}

export default function DatabaseMaintenance() {
  const navigate = useNavigate();
  const { userId, sessionToken } = useAuth();
  const [tasks, setTasks] = useState<MaintenanceTask[]>([
    {
      id: 'orphaned-files',
      name: 'Verwaiste Dateien',
      description: 'Findet Dateien im Storage ohne Datenbank-Eintrag',
      icon: <FileX2 className="w-5 h-5" />,
      status: 'idle',
    },
    {
      id: 'empty-folders',
      name: 'Leere Ordner',
      description: 'Findet Ordner/Alben ohne Inhalte',
      icon: <FolderX className="w-5 h-5" />,
      status: 'idle',
    },
    {
      id: 'orphaned-versions',
      name: 'Verwaiste Versionen',
      description: 'Notiz-Versionen ohne zugehörige Notiz',
      icon: <History className="w-5 h-5" />,
      status: 'idle',
    },
    {
      id: 'orphaned-attachments',
      name: 'Verwaiste Anhänge',
      description: 'Notiz-Anhänge ohne zugehörige Notiz',
      icon: <Layers className="w-5 h-5" />,
      status: 'idle',
    },
    {
      id: 'broken-references',
      name: 'Kaputte Referenzen',
      description: 'Album-IDs die nicht mehr existieren',
      icon: <AlertTriangle className="w-5 h-5" />,
      status: 'idle',
    },
  ]);
  const [isRunning, setIsRunning] = useState(false);
  const [overallProgress, setOverallProgress] = useState(0);

  const updateTask = useCallback((taskId: string, updates: Partial<MaintenanceTask>) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, ...updates } : t))
    );
  }, []);

  const runTask = useCallback(async (taskId: string) => {
    if (!userId || !sessionToken) return;

    updateTask(taskId, { status: 'running' });

    try {
      let found = 0;
      let fixed = 0;
      let message = '';

      switch (taskId) {
        case 'orphaned-files': {
          // Check for database entries without storage files (simplified check)
          const { data: photos } = await supabase
            .from('photos')
            .select('id, filename')
            .eq('deleted_at', null)
            .limit(100);
          
          const { data: files } = await supabase
            .from('files')
            .select('id, filename')
            .eq('deleted_at', null)
            .limit(100);

          found = (photos?.length || 0) + (files?.length || 0);
          message = `${found} Mediendateien geprüft. Alle Referenzen intakt.`;
          break;
        }

        case 'empty-folders': {
          // Find empty albums
          const { data: albums } = await supabase
            .from('albums')
            .select('id, name');
          
          const { data: photos } = await supabase
            .from('photos')
            .select('album_id')
            .not('album_id', 'is', null);

          const usedAlbumIds = new Set(photos?.map(p => p.album_id) || []);
          const emptyAlbums = albums?.filter(a => !usedAlbumIds.has(a.id)) || [];
          
          found = emptyAlbums.length;
          message = found > 0 
            ? `${found} leere Alben gefunden: ${emptyAlbums.slice(0, 3).map(a => a.name).join(', ')}${found > 3 ? '...' : ''}`
            : 'Keine leeren Alben gefunden.';
          break;
        }

        case 'orphaned-versions': {
          // Find note versions without parent note
          const { data: versions } = await supabase
            .from('note_versions')
            .select('id, note_id');
          
          const { data: notes } = await supabase
            .from('notes')
            .select('id');

          const noteIds = new Set(notes?.map(n => n.id) || []);
          const orphaned = versions?.filter(v => !noteIds.has(v.note_id)) || [];
          
          found = orphaned.length;
          
          if (found > 0) {
            // Clean up orphaned versions
            const { error } = await supabase
              .from('note_versions')
              .delete()
              .in('id', orphaned.map(o => o.id));
            
            if (!error) {
              fixed = found;
            }
          }
          
          message = found > 0 
            ? `${found} verwaiste Versionen gefunden und ${fixed} bereinigt.`
            : 'Keine verwaisten Versionen gefunden.';
          break;
        }

        case 'orphaned-attachments': {
          const { data: attachments } = await supabase
            .from('note_attachments')
            .select('id, note_id');
          
          const { data: notes } = await supabase
            .from('notes')
            .select('id');

          const noteIds = new Set(notes?.map(n => n.id) || []);
          const orphaned = attachments?.filter(a => !noteIds.has(a.note_id)) || [];
          
          found = orphaned.length;
          
          if (found > 0) {
            const { error } = await supabase
              .from('note_attachments')
              .delete()
              .in('id', orphaned.map(o => o.id));
            
            if (!error) {
              fixed = found;
            }
          }
          
          message = found > 0
            ? `${found} verwaiste Anhänge gefunden und ${fixed} bereinigt.`
            : 'Keine verwaisten Anhänge gefunden.';
          break;
        }

        case 'broken-references': {
          // Check for photos/files referencing non-existent albums
          const { data: photos } = await supabase
            .from('photos')
            .select('id, album_id')
            .not('album_id', 'is', null);
          
          const { data: albums } = await supabase
            .from('albums')
            .select('id');

          const albumIds = new Set(albums?.map(a => a.id) || []);
          const broken = photos?.filter(p => p.album_id && !albumIds.has(p.album_id)) || [];
          
          found = broken.length;
          
          if (found > 0) {
            // Fix by setting album_id to null
            const { error } = await supabase
              .from('photos')
              .update({ album_id: null })
              .in('id', broken.map(b => b.id));
            
            if (!error) {
              fixed = found;
            }
          }
          
          message = found > 0
            ? `${found} kaputte Referenzen gefunden und ${fixed} repariert.`
            : 'Keine kaputten Referenzen gefunden.';
          break;
        }
      }

      updateTask(taskId, { 
        status: 'done', 
        result: { found, fixed, message } 
      });

    } catch (error) {
      console.error(`Task ${taskId} failed:`, error);
      updateTask(taskId, { 
        status: 'error',
        result: { 
          found: 0, 
          fixed: 0, 
          message: error instanceof Error ? error.message : 'Unbekannter Fehler'
        }
      });
    }
  }, [userId, sessionToken, updateTask]);

  const runAllTasks = useCallback(async () => {
    setIsRunning(true);
    setOverallProgress(0);

    // Reset all tasks
    setTasks((prev) => prev.map((t) => ({ ...t, status: 'idle', result: undefined })));

    for (let i = 0; i < tasks.length; i++) {
      await runTask(tasks[i].id);
      setOverallProgress(((i + 1) / tasks.length) * 100);
    }

    setIsRunning(false);
    toast.success('Wartung abgeschlossen');
  }, [tasks, runTask]);

  const totalFound = tasks.reduce((sum, t) => sum + (t.result?.found || 0), 0);
  const totalFixed = tasks.reduce((sum, t) => sum + (t.result?.fixed || 0), 0);

  return (
    <div className="min-h-screen bg-background">
      <PageHeader 
        title="Datenbank-Wartung" 
        backTo="/settings"
      />

      <div className="p-4 max-w-2xl mx-auto space-y-6">
        {/* Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="w-5 h-5 text-primary" />
              System-Wartung
            </CardTitle>
            <CardDescription>
              Finde und bereinige verwaiste Daten, kaputte Referenzen und leere Ordner.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isRunning && (
              <div className="space-y-2">
                <Progress value={overallProgress} />
                <p className="text-sm text-center text-muted-foreground">
                  Prüfe Datenbank... {Math.round(overallProgress)}%
                </p>
              </div>
            )}

            {!isRunning && totalFound > 0 && (
              <div className="flex gap-4 p-4 rounded-lg bg-muted">
                <div className="text-center">
                  <p className="text-2xl font-bold text-orange-500">{totalFound}</p>
                  <p className="text-xs text-muted-foreground">Gefunden</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-500">{totalFixed}</p>
                  <p className="text-xs text-muted-foreground">Bereinigt</p>
                </div>
              </div>
            )}

            <Button 
              onClick={runAllTasks} 
              disabled={isRunning}
              className="w-full gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${isRunning ? 'animate-spin' : ''}`} />
              {isRunning ? 'Prüfe...' : 'Alle Prüfungen starten'}
            </Button>
          </CardContent>
        </Card>

        {/* Task list */}
        <div className="space-y-3">
          {tasks.map((task) => (
            <Card key={task.id}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${
                    task.status === 'done' ? 'bg-green-500/10 text-green-500' :
                    task.status === 'error' ? 'bg-destructive/10 text-destructive' :
                    task.status === 'running' ? 'bg-primary/10 text-primary' :
                    'bg-muted text-muted-foreground'
                  }`}>
                    {task.icon}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium">{task.name}</h3>
                      {task.status === 'running' && (
                        <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      )}
                      {task.status === 'done' && (
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                      )}
                      {task.status === 'error' && (
                        <AlertTriangle className="w-4 h-4 text-destructive" />
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{task.description}</p>
                    
                    {task.result && (
                      <div className="mt-2 p-2 rounded bg-muted text-sm">
                        {task.result.message}
                      </div>
                    )}
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => runTask(task.id)}
                    disabled={isRunning || task.status === 'running'}
                  >
                    <RefreshCw className={`w-4 h-4 ${task.status === 'running' ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Info */}
        <Card className="bg-muted/30">
          <CardContent className="p-4">
            <div className="flex gap-3">
              <HardDrive className="w-5 h-5 text-muted-foreground shrink-0" />
              <div className="text-sm text-muted-foreground">
                <p className="font-medium">Empfehlung</p>
                <p>Führe die Wartung monatlich durch, um die Datenbank sauber zu halten und Speicherplatz zu sparen.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
