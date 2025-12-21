import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, 
  Search, 
  File, 
  FileText, 
  FileImage, 
  FileVideo, 
  FileAudio,
  Download, 
  Trash2, 
  Loader2,
  Upload,
  X
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

interface FileItem {
  id: string;
  filename: string;
  mime_type: string;
  size: number;
  uploaded_at: string;
}

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

const getFileIcon = (mimeType: string) => {
  if (mimeType.startsWith('image/')) return FileImage;
  if (mimeType.startsWith('video/')) return FileVideo;
  if (mimeType.startsWith('audio/')) return FileAudio;
  if (mimeType.includes('text') || mimeType.includes('document') || mimeType.includes('pdf')) return FileText;
  return File;
};

const formatFileSize = (bytes: number) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export default function Files() {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const { userId } = useAuth();

  useEffect(() => {
    fetchFiles();
  }, [userId]);

  const fetchFiles = async () => {
    if (!userId) return;

    try {
      const { data, error } = await supabase
        .from('files')
        .select('*')
        .eq('user_id', userId)
        .order('uploaded_at', { ascending: false });

      if (error) throw error;
      setFiles(data || []);
    } catch (error) {
      console.error('Error fetching files:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpload = async (fileList: FileList | null) => {
    if (!fileList || !userId) return;

    const filesToUpload = Array.from(fileList).filter(f => f.size <= MAX_FILE_SIZE);
    if (filesToUpload.length === 0) return;

    setIsUploading(true);
    setUploadProgress(0);

    try {
      for (let i = 0; i < filesToUpload.length; i++) {
        const file = filesToUpload[i];
        const filename = `${Date.now()}-${file.name}`;

        // Upload to storage
        const { error: uploadError } = await supabase.storage
          .from('files')
          .upload(`${userId}/${filename}`, file);

        if (uploadError) throw uploadError;

        // Create database record
        const { data, error: dbError } = await supabase
          .from('files')
          .insert({
            user_id: userId,
            filename,
            mime_type: file.type || 'application/octet-stream',
            size: file.size,
          })
          .select()
          .single();

        if (dbError) throw dbError;

        setFiles(prev => [data, ...prev]);
        setUploadProgress(((i + 1) / filesToUpload.length) * 100);
      }
    } catch (error) {
      console.error('Error uploading files:', error);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const downloadFile = async (file: FileItem) => {
    if (!userId) return;

    try {
      const { data, error } = await supabase.storage
        .from('files')
        .download(`${userId}/${file.filename}`);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.filename.replace(/^\d+-/, ''); // Remove timestamp prefix
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading file:', error);
    }
  };

  const deleteFile = async (file: FileItem) => {
    if (!userId) return;

    try {
      // Delete from storage
      await supabase.storage
        .from('files')
        .remove([`${userId}/${file.filename}`]);

      // Delete from database
      const { error } = await supabase
        .from('files')
        .delete()
        .eq('id', file.id);

      if (error) throw error;

      setFiles(files.filter(f => f.id !== file.id));
    } catch (error) {
      console.error('Error deleting file:', error);
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleUpload(e.dataTransfer.files);
  }, [userId]);

  const filteredFiles = files.filter(file =>
    file.filename.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-center justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white">Dateien</h1>
          <p className="text-white/60 text-sm">
            {files.length} Dateien • {formatFileSize(files.reduce((acc, f) => acc + f.size, 0))} gesamt
          </p>
        </div>

        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-primary hover:shadow-glow transition-all"
        >
          <Plus className="w-4 h-4 text-white" />
          <span className="text-white text-sm">Hochladen</span>
        </button>
      </motion.div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => handleUpload(e.target.files)}
      />

      {/* Search */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="relative"
      >
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
        <input
          type="text"
          placeholder="Dateien suchen..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-12 pr-4 py-3 rounded-xl vault-input text-white placeholder:text-white/40"
        />
      </motion.div>

      {/* Drop Zone */}
      <motion.div
        ref={dropZoneRef}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "glass-card p-8 border-2 border-dashed transition-all",
          isDragging
            ? "border-purple-500 bg-purple-500/10"
            : "border-white/10 hover:border-white/20"
        )}
      >
        <div className="flex flex-col items-center justify-center text-center">
          <Upload className={cn(
            "w-12 h-12 mb-4 transition-colors",
            isDragging ? "text-purple-400" : "text-white/30"
          )} />
          <p className="text-white/70 mb-2">
            Dateien hierher ziehen
          </p>
          <p className="text-white/40 text-sm">
            oder klicke zum Auswählen (max. 100MB)
          </p>
        </div>
      </motion.div>

      {/* Upload Progress */}
      <AnimatePresence>
        {isUploading && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="glass-card p-4"
          >
            <div className="flex items-center gap-3 mb-2">
              <Loader2 className="w-5 h-5 text-purple-400 animate-spin" />
              <span className="text-white">Dateien werden hochgeladen...</span>
            </div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-primary"
                initial={{ width: 0 }}
                animate={{ width: `${uploadProgress}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Files List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
        </div>
      ) : filteredFiles.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="glass-card p-12 text-center"
        >
          <File className="w-16 h-16 mx-auto mb-4 text-white/30" />
          <h3 className="text-lg font-medium text-white mb-2">Keine Dateien</h3>
          <p className="text-white/50">
            Lade deine ersten Dateien hoch
          </p>
        </motion.div>
      ) : (
        <div className="space-y-2">
          {filteredFiles.map((file, index) => {
            const FileIcon = getFileIcon(file.mime_type);
            return (
              <motion.div
                key={file.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
                className="glass-card-hover p-4 flex items-center gap-4 group"
              >
                <div className="w-12 h-12 rounded-xl bg-gradient-primary/20 flex items-center justify-center">
                  <FileIcon className="w-6 h-6 text-purple-400" />
                </div>

                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-white truncate">
                    {file.filename.replace(/^\d+-/, '')}
                  </h3>
                  <p className="text-sm text-white/50">
                    {formatFileSize(file.size)} • {formatDate(file.uploaded_at)}
                  </p>
                </div>

                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => downloadFile(file)}
                    className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                  >
                    <Download className="w-5 h-5 text-white/70 hover:text-white" />
                  </button>
                  <button
                    onClick={() => deleteFile(file)}
                    className="p-2 hover:bg-red-500/20 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-5 h-5 text-red-400" />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
