import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Archive, 
  FileText, 
  Folder, 
  Download, 
  Upload,
  X,
  Loader2,
  File,
  Image,
  Video,
  Music,
  FileCode,
  ChevronRight,
  ChevronDown,
  Package,
  FolderOpen
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import * as fflate from 'fflate';

interface ArchiveEntry {
  name: string;
  path: string;
  size: number;
  isDirectory: boolean;
  children?: ArchiveEntry[];
  data?: Uint8Array;
}

interface ArchiveViewerProps {
  file?: File;
  onClose: () => void;
  onExtract?: (files: { name: string; data: Uint8Array }[]) => void;
}

const getFileIcon = (filename: string) => {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext)) {
    return <Image className="w-4 h-4 text-green-400" />;
  }
  if (['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext)) {
    return <Video className="w-4 h-4 text-purple-400" />;
  }
  if (['mp3', 'wav', 'ogg', 'm4a', 'flac'].includes(ext)) {
    return <Music className="w-4 h-4 text-pink-400" />;
  }
  if (['js', 'ts', 'tsx', 'jsx', 'py', 'html', 'css', 'json', 'xml'].includes(ext)) {
    return <FileCode className="w-4 h-4 text-yellow-400" />;
  }
  if (['pdf', 'doc', 'docx', 'txt', 'md'].includes(ext)) {
    return <FileText className="w-4 h-4 text-blue-400" />;
  }
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
    return <Package className="w-4 h-4 text-orange-400" />;
  }
  return <File className="w-4 h-4 text-muted-foreground" />;
};

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function TreeNode({ 
  entry, 
  level = 0,
  selectedFiles,
  onToggleSelect
}: { 
  entry: ArchiveEntry;
  level?: number;
  selectedFiles: Set<string>;
  onToggleSelect: (path: string) => void;
}) {
  const [expanded, setExpanded] = useState(level < 2);
  const isSelected = selectedFiles.has(entry.path);

  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-2 py-1.5 px-2 rounded-lg cursor-pointer transition-colors",
          isSelected ? "bg-primary/10" : "hover:bg-muted/50"
        )}
        style={{ paddingLeft: `${8 + level * 16}px` }}
        onClick={() => {
          if (entry.isDirectory) {
            setExpanded(!expanded);
          } else {
            onToggleSelect(entry.path);
          }
        }}
      >
        {entry.isDirectory ? (
          <>
            {expanded ? (
              <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
            ) : (
              <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
            )}
            {expanded ? (
              <FolderOpen className="w-4 h-4 text-amber-400 shrink-0" />
            ) : (
              <Folder className="w-4 h-4 text-amber-400 shrink-0" />
            )}
          </>
        ) : (
          <>
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => onToggleSelect(entry.path)}
              className="w-4 h-4 rounded border-border shrink-0"
              onClick={(e) => e.stopPropagation()}
            />
            {getFileIcon(entry.name)}
          </>
        )}
        <span className="text-sm truncate flex-1">{entry.name}</span>
        {!entry.isDirectory && (
          <span className="text-xs text-muted-foreground shrink-0">
            {formatBytes(entry.size)}
          </span>
        )}
      </div>

      <AnimatePresence>
        {entry.isDirectory && expanded && entry.children && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {entry.children.map((child) => (
              <TreeNode
                key={child.path}
                entry={child}
                level={level + 1}
                selectedFiles={selectedFiles}
                onToggleSelect={onToggleSelect}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function ArchiveViewer({ file, onClose, onExtract }: ArchiveViewerProps) {
  const [entries, setEntries] = useState<ArchiveEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [extractProgress, setExtractProgress] = useState(0);
  const [isExtracting, setIsExtracting] = useState(false);
  const [archiveData, setArchiveData] = useState<fflate.Unzipped | null>(null);

  const parseArchive = useCallback(async (archiveFile: File) => {
    setIsLoading(true);
    setError(null);

    try {
      const buffer = await archiveFile.arrayBuffer();
      const data = new Uint8Array(buffer);
      
      const unzipped = fflate.unzipSync(data);
      setArchiveData(unzipped);

      // Build tree structure
      const tree: Record<string, ArchiveEntry> = {};
      const rootEntries: ArchiveEntry[] = [];

      Object.entries(unzipped).forEach(([path, fileData]) => {
        const parts = path.split('/').filter(Boolean);
        const isDirectory = path.endsWith('/');
        
        let currentPath = '';
        parts.forEach((part, index) => {
          const parentPath = currentPath;
          currentPath = currentPath ? `${currentPath}/${part}` : part;
          
          if (!tree[currentPath]) {
            const entry: ArchiveEntry = {
              name: part,
              path: currentPath,
              size: index === parts.length - 1 && !isDirectory ? fileData.length : 0,
              isDirectory: index < parts.length - 1 || isDirectory,
              children: [],
              data: index === parts.length - 1 && !isDirectory ? fileData : undefined,
            };
            
            tree[currentPath] = entry;
            
            if (parentPath && tree[parentPath]) {
              tree[parentPath].children!.push(entry);
            } else if (!parentPath) {
              rootEntries.push(entry);
            }
          }
        });
      });

      setEntries(rootEntries);
    } catch (err) {
      console.error('Error parsing archive:', err);
      setError('Fehler beim Lesen des Archivs. Ist die Datei beschädigt?');
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (file) {
      parseArchive(file);
    }
  }, [file, parseArchive]);

  const toggleSelect = (path: string) => {
    setSelectedFiles(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const selectAll = () => {
    if (!archiveData) return;
    
    const allPaths = Object.keys(archiveData).filter(p => !p.endsWith('/'));
    setSelectedFiles(new Set(allPaths));
  };

  const deselectAll = () => {
    setSelectedFiles(new Set());
  };

  const handleExtract = async () => {
    if (!archiveData || selectedFiles.size === 0) return;
    
    setIsExtracting(true);
    setExtractProgress(0);

    const filesToExtract: { name: string; data: Uint8Array }[] = [];
    const paths = Array.from(selectedFiles);
    
    for (let i = 0; i < paths.length; i++) {
      const path = paths[i];
      const data = archiveData[path];
      
      if (data) {
        filesToExtract.push({ name: path.split('/').pop() || path, data });
      }
      
      setExtractProgress(((i + 1) / paths.length) * 100);
      // Yield to main thread
      await new Promise(resolve => setTimeout(resolve, 0));
    }

    if (onExtract) {
      onExtract(filesToExtract);
    } else {
      // Download files
      for (const file of filesToExtract) {
        const blob = new Blob([file.data.slice().buffer]);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        a.click();
        URL.revokeObjectURL(url);
      }
    }

    setIsExtracting(false);
    setExtractProgress(0);
  };

  const totalSize = archiveData 
    ? Object.values(archiveData).reduce((acc, data) => acc + data.length, 0)
    : 0;

  const selectedSize = Array.from(selectedFiles).reduce((acc, path) => {
    const data = archiveData?.[path];
    return acc + (data?.length || 0);
  }, 0);

  return (
    <Dialog open={!!file} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Archive className="w-5 h-5 text-primary" />
            {file?.name || 'Archiv'}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <Package className="w-12 h-12 text-destructive mx-auto mb-3" />
            <p className="text-destructive">{error}</p>
          </div>
        ) : (
          <>
            {/* Stats */}
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span>{Object.keys(archiveData || {}).length} Dateien</span>
              <span>•</span>
              <span>{formatBytes(totalSize)} gesamt</span>
              {selectedFiles.size > 0 && (
                <>
                  <span>•</span>
                  <Badge variant="secondary">
                    {selectedFiles.size} ausgewählt ({formatBytes(selectedSize)})
                  </Badge>
                </>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={selectAll}>
                Alle auswählen
              </Button>
              <Button variant="outline" size="sm" onClick={deselectAll}>
                Auswahl aufheben
              </Button>
              <div className="flex-1" />
              <Button 
                size="sm" 
                disabled={selectedFiles.size === 0 || isExtracting}
                onClick={handleExtract}
              >
                {isExtracting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Download className="w-4 h-4 mr-2" />
                )}
                Extrahieren ({selectedFiles.size})
              </Button>
            </div>

            {isExtracting && (
              <Progress value={extractProgress} className="h-1" />
            )}

            {/* Tree */}
            <ScrollArea className="h-[400px] border rounded-lg">
              <div className="p-2">
                {entries.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Leeres Archiv
                  </div>
                ) : (
                  entries.map((entry) => (
                    <TreeNode
                      key={entry.path}
                      entry={entry}
                      selectedFiles={selectedFiles}
                      onToggleSelect={toggleSelect}
                    />
                  ))
                )}
              </div>
            </ScrollArea>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Create Archive Component
export function CreateArchive({ 
  files, 
  onComplete, 
  defaultName = 'archive.zip' 
}: { 
  files: { name: string; data: Uint8Array }[];
  onComplete: (blob: Blob, filename: string) => void;
  defaultName?: string;
}) {
  const [isCreating, setIsCreating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [filename, setFilename] = useState(defaultName);

  const createArchive = async () => {
    setIsCreating(true);
    setProgress(0);

    try {
      const zipData: fflate.Zippable = {};
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        zipData[file.name] = file.data;
        setProgress(((i + 1) / files.length) * 50);
        await new Promise(resolve => setTimeout(resolve, 0));
      }

      const zipped = fflate.zipSync(zipData, { level: 6 });
      setProgress(90);

      const blob = new Blob([zipped.slice().buffer], { type: 'application/zip' });
      setProgress(100);

      onComplete(blob, filename);
    } catch (err) {
      console.error('Error creating archive:', err);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={filename}
          onChange={(e) => setFilename(e.target.value)}
          className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-sm"
          placeholder="Archivname..."
        />
        <Button onClick={createArchive} disabled={isCreating || files.length === 0}>
          {isCreating ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Upload className="w-4 h-4 mr-2" />
          )}
          Erstellen
        </Button>
      </div>

      {isCreating && <Progress value={progress} className="h-1" />}

      <div className="text-sm text-muted-foreground">
        {files.length} Dateien werden archiviert
      </div>
    </div>
  );
}

export default ArchiveViewer;
