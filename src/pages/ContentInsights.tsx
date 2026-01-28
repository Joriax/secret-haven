import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { 
  Lightbulb, 
  AlertCircle, 
  Clock, 
  FolderOpen, 
  FileText,
  Image,
  Link2,
  Trash2,
  Eye,
  CheckCircle2,
  RefreshCw,
  Loader2,
  ChevronRight,
  Sparkles
} from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { format, differenceInDays } from 'date-fns';
import { de } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';

interface InsightItem {
  id: string;
  type: 'note' | 'photo' | 'file' | 'link';
  title: string;
  issue: string;
  severity: 'low' | 'medium' | 'high';
  created_at: string;
  last_viewed?: string;
  recommendation: string;
}

interface InsightStats {
  orphanedFiles: number;
  staleItems: number;
  emptyFolders: number;
  untaggedItems: number;
  duplicateTitles: number;
}

export default function ContentInsights() {
  const [insights, setInsights] = useState<InsightItem[]>([]);
  const [stats, setStats] = useState<InsightStats>({
    orphanedFiles: 0,
    staleItems: 0,
    emptyFolders: 0,
    untaggedItems: 0,
    duplicateTitles: 0,
  });
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const { userId, supabaseClient: supabase } = useAuth();
  const navigate = useNavigate();

  const analyzeContent = useCallback(async () => {
    if (!userId) return;
    
    setAnalyzing(true);
    const newInsights: InsightItem[] = [];
    
    try {
      // Fetch all content
      const [notesRes, photosRes, filesRes, linksRes, viewHistoryRes] = await Promise.all([
        supabase.from('notes').select('id, title, content, folder_id, tags, created_at, updated_at').eq('user_id', userId).is('deleted_at', null),
        supabase.from('photos').select('id, filename, caption, album_id, tags, uploaded_at').eq('user_id', userId).is('deleted_at', null),
        supabase.from('files').select('id, filename, album_id, tags, uploaded_at').eq('user_id', userId).is('deleted_at', null),
        supabase.from('links').select('id, title, url, folder_id, tags, created_at').eq('user_id', userId).is('deleted_at', null),
        supabase.from('view_history').select('item_id, viewed_at').eq('user_id', userId),
      ]);

      const notes = notesRes.data || [];
      const photos = photosRes.data || [];
      const files = filesRes.data || [];
      const links = linksRes.data || [];
      const viewHistory = new Map((viewHistoryRes.data || []).map(v => [v.item_id, v.viewed_at]));

      const now = new Date();
      let orphanedCount = 0;
      let staleCount = 0;
      let untaggedCount = 0;
      const titleCounts = new Map<string, number>();

      // Analyze notes
      for (const note of notes) {
        const lastViewed = viewHistory.get(note.id);
        const daysSinceView = lastViewed ? differenceInDays(now, new Date(lastViewed)) : 999;
        const daysSinceUpdate = differenceInDays(now, new Date(note.updated_at || note.created_at));

        // Check for stale content (not viewed in 90+ days)
        if (daysSinceView > 90) {
          staleCount++;
          newInsights.push({
            id: note.id,
            type: 'note',
            title: note.title || 'Unbenannte Notiz',
            issue: 'Lange nicht angesehen',
            severity: daysSinceView > 180 ? 'high' : 'medium',
            created_at: note.created_at,
            last_viewed: lastViewed,
            recommendation: 'Überprüfen oder archivieren',
          });
        }

        // Check for empty notes
        if (!note.content || note.content.trim().length < 10) {
          newInsights.push({
            id: note.id,
            type: 'note',
            title: note.title || 'Unbenannte Notiz',
            issue: 'Leere oder sehr kurze Notiz',
            severity: 'low',
            created_at: note.created_at,
            recommendation: 'Inhalt hinzufügen oder löschen',
          });
        }

        // Check for untagged content
        if (!note.tags || note.tags.length === 0) {
          untaggedCount++;
        }

        // Track duplicate titles
        const titleLower = (note.title || '').toLowerCase().trim();
        if (titleLower) {
          titleCounts.set(titleLower, (titleCounts.get(titleLower) || 0) + 1);
        }
      }

      // Analyze photos
      for (const photo of photos) {
        const lastViewed = viewHistory.get(photo.id);
        const daysSinceView = lastViewed ? differenceInDays(now, new Date(lastViewed)) : 999;

        if (daysSinceView > 180) {
          staleCount++;
          newInsights.push({
            id: photo.id,
            type: 'photo',
            title: photo.caption || photo.filename,
            issue: 'Lange nicht angesehen',
            severity: 'medium',
            created_at: photo.uploaded_at,
            last_viewed: lastViewed,
            recommendation: 'In Erinnerungen aufnehmen oder löschen',
          });
        }

        if (!photo.tags || photo.tags.length === 0) {
          untaggedCount++;
        }
      }

      // Analyze files
      for (const file of files) {
        const lastViewed = viewHistory.get(file.id);
        const daysSinceView = lastViewed ? differenceInDays(now, new Date(lastViewed)) : 999;

        if (daysSinceView > 180) {
          staleCount++;
          newInsights.push({
            id: file.id,
            type: 'file',
            title: file.filename,
            issue: 'Lange nicht verwendet',
            severity: 'low',
            created_at: file.uploaded_at,
            last_viewed: lastViewed,
            recommendation: 'Überprüfen oder in Papierkorb verschieben',
          });
        }

        // Orphaned files (no album)
        if (!file.album_id) {
          orphanedCount++;
        }

        if (!file.tags || file.tags.length === 0) {
          untaggedCount++;
        }
      }

      // Analyze links
      for (const link of links) {
        if (!link.tags || link.tags.length === 0) {
          untaggedCount++;
        }

        const titleLower = (link.title || '').toLowerCase().trim();
        if (titleLower) {
          titleCounts.set(titleLower, (titleCounts.get(titleLower) || 0) + 1);
        }
      }

      // Find duplicate titles
      let duplicateCount = 0;
      titleCounts.forEach((count, title) => {
        if (count > 1) {
          duplicateCount += count;
          // Find items with this title
          const duplicateNotes = notes.filter(n => (n.title || '').toLowerCase().trim() === title);
          if (duplicateNotes.length > 1) {
            newInsights.push({
              id: duplicateNotes[0].id,
              type: 'note',
              title: duplicateNotes[0].title,
              issue: `${duplicateNotes.length} Notizen mit gleichem Titel`,
              severity: 'low',
              created_at: duplicateNotes[0].created_at,
              recommendation: 'Umbenennen oder zusammenführen',
            });
          }
        }
      });

      // Count empty folders
      const [noteFoldersRes, albumsRes, fileAlbumsRes] = await Promise.all([
        supabase.from('note_folders').select('id').eq('user_id', userId),
        supabase.from('albums').select('id').eq('user_id', userId),
        supabase.from('file_albums').select('id').eq('user_id', userId),
      ]);

      const noteFolders = noteFoldersRes.data || [];
      const albums = albumsRes.data || [];
      const fileAlbums = fileAlbumsRes.data || [];

      let emptyFolderCount = 0;

      for (const folder of noteFolders) {
        const hasNotes = notes.some(n => n.folder_id === folder.id);
        if (!hasNotes) emptyFolderCount++;
      }

      for (const album of albums) {
        const hasPhotos = photos.some(p => p.album_id === album.id);
        if (!hasPhotos) emptyFolderCount++;
      }

      for (const album of fileAlbums) {
        const hasFiles = files.some(f => f.album_id === album.id);
        if (!hasFiles) emptyFolderCount++;
      }

      // Update stats
      setStats({
        orphanedFiles: orphanedCount,
        staleItems: staleCount,
        emptyFolders: emptyFolderCount,
        untaggedItems: untaggedCount,
        duplicateTitles: duplicateCount,
      });

      // Sort insights by severity
      newInsights.sort((a, b) => {
        const severityOrder = { high: 0, medium: 1, low: 2 };
        return severityOrder[a.severity] - severityOrder[b.severity];
      });

      setInsights(newInsights.slice(0, 100));
    } catch (error) {
      console.error('Error analyzing content:', error);
    } finally {
      setAnalyzing(false);
      setLoading(false);
    }
  }, [userId, supabase]);

  useEffect(() => {
    analyzeContent();
  }, [analyzeContent]);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'note': return <FileText className="w-4 h-4" />;
      case 'photo': return <Image className="w-4 h-4" />;
      case 'file': return <FolderOpen className="w-4 h-4" />;
      case 'link': return <Link2 className="w-4 h-4" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'text-red-400 bg-red-500/20';
      case 'medium': return 'text-yellow-400 bg-yellow-500/20';
      case 'low': return 'text-blue-400 bg-blue-500/20';
      default: return 'text-muted-foreground bg-muted';
    }
  };

  const totalIssues = Object.values(stats).reduce((a, b) => a + b, 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <PageHeader
        title="Content Insights"
        subtitle="Optimierungsvorschläge für deine Inhalte"
        icon={<Lightbulb className="w-5 h-5 text-primary" />}
        backTo="/dashboard"
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="glass-card">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-foreground">{stats.staleItems}</div>
            <div className="text-xs text-muted-foreground">Nicht angesehen</div>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-foreground">{stats.orphanedFiles}</div>
            <div className="text-xs text-muted-foreground">Ohne Ordner</div>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-foreground">{stats.emptyFolders}</div>
            <div className="text-xs text-muted-foreground">Leere Ordner</div>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-foreground">{stats.untaggedItems}</div>
            <div className="text-xs text-muted-foreground">Ohne Tags</div>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-foreground">{stats.duplicateTitles}</div>
            <div className="text-xs text-muted-foreground">Duplikate</div>
          </CardContent>
        </Card>
      </div>

      {/* Health Score */}
      <Card className="glass-card">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={cn(
                "w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold",
                totalIssues === 0 ? "bg-green-500/20 text-green-400" :
                totalIssues < 10 ? "bg-yellow-500/20 text-yellow-400" :
                "bg-red-500/20 text-red-400"
              )}>
                {totalIssues === 0 ? <CheckCircle2 className="w-8 h-8" /> : totalIssues}
              </div>
              <div>
                <h3 className="text-lg font-semibold">
                  {totalIssues === 0 ? 'Alles in Ordnung!' : `${totalIssues} Optimierungsmöglichkeiten`}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {totalIssues === 0 
                    ? 'Deine Inhalte sind gut organisiert'
                    : 'Überprüfe die Vorschläge unten'}
                </p>
              </div>
            </div>
            <Button 
              variant="outline" 
              onClick={analyzeContent}
              disabled={analyzing}
            >
              {analyzing ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              Erneut analysieren
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Insights List */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Empfehlungen
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : insights.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-4" />
              <p className="text-muted-foreground">Keine Probleme gefunden!</p>
            </div>
          ) : (
            <Tabs defaultValue="all">
              <TabsList className="mb-4">
                <TabsTrigger value="all">Alle ({insights.length})</TabsTrigger>
                <TabsTrigger value="high">Wichtig ({insights.filter(i => i.severity === 'high').length})</TabsTrigger>
                <TabsTrigger value="stale">Veraltet ({insights.filter(i => i.issue.includes('angesehen')).length})</TabsTrigger>
              </TabsList>

              <TabsContent value="all">
                <ScrollArea className="h-[400px]">
                  <div className="space-y-2">
                    {insights.map((insight) => (
                      <motion.div
                        key={insight.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer group"
                        onClick={() => {
                          if (insight.type === 'note') navigate('/notes');
                          else if (insight.type === 'photo') navigate('/photos');
                          else if (insight.type === 'file') navigate('/files');
                          else if (insight.type === 'link') navigate('/links');
                        }}
                      >
                        <div className={cn(
                          "w-8 h-8 rounded-lg flex items-center justify-center",
                          getSeverityColor(insight.severity)
                        )}>
                          {getTypeIcon(insight.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{insight.title}</p>
                          <p className="text-xs text-muted-foreground">{insight.issue}</p>
                        </div>
                        <Badge variant="outline" className="text-[10px]">
                          {insight.recommendation}
                        </Badge>
                        <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </motion.div>
                    ))}
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="high">
                <ScrollArea className="h-[400px]">
                  <div className="space-y-2">
                    {insights.filter(i => i.severity === 'high').map((insight) => (
                      <motion.div
                        key={insight.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                      >
                        <div className={cn(
                          "w-8 h-8 rounded-lg flex items-center justify-center",
                          getSeverityColor(insight.severity)
                        )}>
                          <AlertCircle className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{insight.title}</p>
                          <p className="text-xs text-muted-foreground">{insight.issue}</p>
                        </div>
                        <Badge variant="destructive" className="text-[10px]">
                          Wichtig
                        </Badge>
                      </motion.div>
                    ))}
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="stale">
                <ScrollArea className="h-[400px]">
                  <div className="space-y-2">
                    {insights.filter(i => i.issue.includes('angesehen')).map((insight) => (
                      <motion.div
                        key={insight.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                      >
                        <div className={cn(
                          "w-8 h-8 rounded-lg flex items-center justify-center",
                          getSeverityColor(insight.severity)
                        )}>
                          <Clock className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{insight.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {insight.last_viewed 
                              ? `Zuletzt: ${format(new Date(insight.last_viewed), 'dd.MM.yyyy', { locale: de })}`
                              : 'Nie angesehen'}
                          </p>
                        </div>
                        <Button variant="ghost" size="sm">
                          <Eye className="w-4 h-4 mr-1" />
                          Ansehen
                        </Button>
                      </motion.div>
                    ))}
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
