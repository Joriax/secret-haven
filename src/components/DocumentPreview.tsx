import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  X, 
  ChevronLeft, 
  ChevronRight, 
  Download, 
  ExternalLink,
  Loader2,
  FileText,
  AlertTriangle,
  RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface DocumentPreviewProps {
  url: string;
  filename: string;
  mimeType: string;
  onClose: () => void;
  onPrevious?: () => void;
  onNext?: () => void;
  hasPrevious?: boolean;
  hasNext?: boolean;
  onDownload?: () => void;
}

// Office Online Viewer URL
const getOfficeViewerUrl = (fileUrl: string): string => {
  const encodedUrl = encodeURIComponent(fileUrl);
  return `https://view.officeapps.live.com/op/embed.aspx?src=${encodedUrl}`;
};

// Google Docs Viewer as fallback
const getGoogleDocsViewerUrl = (fileUrl: string): string => {
  const encodedUrl = encodeURIComponent(fileUrl);
  return `https://docs.google.com/gview?url=${encodedUrl}&embedded=true`;
};

// Check if file type is supported for Office preview
export const isOfficeDocument = (mimeType: string): boolean => {
  const officeTypes = [
    // Word
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    // Excel
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    // PowerPoint
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  ];
  return officeTypes.includes(mimeType);
};

// Check file extension as fallback
export const isOfficeDocumentByExtension = (filename: string): boolean => {
  const officeExtensions = ['.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx'];
  const lowerFilename = filename.toLowerCase();
  return officeExtensions.some(ext => lowerFilename.endsWith(ext));
};

// Check if file is a text/code file
export const isTextFile = (mimeType: string, filename: string): boolean => {
  const textMimeTypes = [
    'text/plain',
    'text/markdown',
    'text/x-markdown',
    'application/json',
    'text/html',
    'text/css',
    'text/javascript',
    'application/javascript',
    'text/typescript',
    'application/typescript',
    'text/xml',
    'application/xml',
    'text/yaml',
    'application/x-yaml',
    'text/csv',
  ];
  
  const textExtensions = [
    '.txt', '.md', '.markdown', '.json', '.js', '.jsx', '.ts', '.tsx',
    '.html', '.htm', '.css', '.scss', '.sass', '.less',
    '.xml', '.yaml', '.yml', '.csv', '.log', '.ini', '.cfg',
    '.py', '.rb', '.java', '.c', '.cpp', '.h', '.hpp', '.cs',
    '.go', '.rs', '.swift', '.kt', '.php', '.sql', '.sh', '.bash',
    '.env', '.gitignore', '.dockerfile', '.toml'
  ];
  
  const lowerFilename = filename.toLowerCase();
  return textMimeTypes.includes(mimeType) || 
         textExtensions.some(ext => lowerFilename.endsWith(ext));
};

// Get language for syntax highlighting
const getLanguage = (filename: string): string => {
  const lowerFilename = filename.toLowerCase();
  const extensionMap: Record<string, string> = {
    '.js': 'javascript',
    '.jsx': 'jsx',
    '.ts': 'typescript',
    '.tsx': 'tsx',
    '.json': 'json',
    '.html': 'html',
    '.htm': 'html',
    '.css': 'css',
    '.scss': 'scss',
    '.sass': 'sass',
    '.less': 'less',
    '.xml': 'xml',
    '.yaml': 'yaml',
    '.yml': 'yaml',
    '.py': 'python',
    '.rb': 'ruby',
    '.java': 'java',
    '.c': 'c',
    '.cpp': 'cpp',
    '.h': 'c',
    '.hpp': 'cpp',
    '.cs': 'csharp',
    '.go': 'go',
    '.rs': 'rust',
    '.swift': 'swift',
    '.kt': 'kotlin',
    '.php': 'php',
    '.sql': 'sql',
    '.sh': 'bash',
    '.bash': 'bash',
    '.md': 'markdown',
    '.markdown': 'markdown',
  };
  
  for (const [ext, lang] of Object.entries(extensionMap)) {
    if (lowerFilename.endsWith(ext)) return lang;
  }
  return 'text';
};

// Get document type label
const getDocumentTypeLabel = (mimeType: string, filename: string): string => {
  const lowerFilename = filename.toLowerCase();
  
  if (mimeType.includes('word') || lowerFilename.endsWith('.doc') || lowerFilename.endsWith('.docx')) {
    return 'Word-Dokument';
  }
  if (mimeType.includes('excel') || mimeType.includes('spreadsheet') || lowerFilename.endsWith('.xls') || lowerFilename.endsWith('.xlsx')) {
    return 'Excel-Tabelle';
  }
  if (mimeType.includes('powerpoint') || mimeType.includes('presentation') || lowerFilename.endsWith('.ppt') || lowerFilename.endsWith('.pptx')) {
    return 'PowerPoint-Präsentation';
  }
  if (lowerFilename.endsWith('.md') || lowerFilename.endsWith('.markdown')) {
    return 'Markdown';
  }
  if (lowerFilename.endsWith('.json')) {
    return 'JSON';
  }
  if (lowerFilename.endsWith('.txt')) {
    return 'Textdatei';
  }
  if (isTextFile(mimeType, filename)) {
    return 'Code-Datei';
  }
  return 'Dokument';
};

export function DocumentPreview({
  url,
  filename,
  mimeType,
  onClose,
  onPrevious,
  onNext,
  hasPrevious = false,
  hasNext = false,
  onDownload,
}: DocumentPreviewProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [viewerError, setViewerError] = useState(false);
  const [useGoogleViewer, setUseGoogleViewer] = useState(false);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);

  const displayName = filename.replace(/^\d+-/, '');
  const documentType = getDocumentTypeLabel(mimeType, filename);
  const isText = isTextFile(mimeType, filename);
  const isMarkdown = filename.toLowerCase().endsWith('.md') || filename.toLowerCase().endsWith('.markdown');
  const language = getLanguage(filename);

  // Fetch text content for text files
  useEffect(() => {
    if (isText && url) {
      setIsLoading(true);
      fetch(url)
        .then(res => res.text())
        .then(text => {
          setTextContent(text);
          setIsLoading(false);
        })
        .catch(err => {
          console.error('Error fetching text file:', err);
          setViewerError(true);
          setIsLoading(false);
        });
    }
  }, [isText, url]);

  // For Office Online Viewer to work, the URL must be publicly accessible
  const viewerUrl = useGoogleViewer 
    ? getGoogleDocsViewerUrl(url) 
    : getOfficeViewerUrl(url);

  const handleIframeLoad = () => {
    setIsLoading(false);
  };

  const handleIframeError = () => {
    setIsLoading(false);
    if (!useGoogleViewer) {
      // Try Google Docs viewer as fallback
      setUseGoogleViewer(true);
      setIsLoading(true);
      setLoadAttempt(prev => prev + 1);
    } else {
      setViewerError(true);
    }
  };

  // Auto-fallback after timeout (some iframes don't trigger onerror)
  useEffect(() => {
    if (isText || viewerError) return;
    
    const timeout = setTimeout(() => {
      if (isLoading && !useGoogleViewer) {
        // If still loading after 8 seconds, try Google Docs viewer
        setUseGoogleViewer(true);
        setLoadAttempt(prev => prev + 1);
      } else if (isLoading && useGoogleViewer) {
        // If still loading after another 8 seconds with Google, show error
        setViewerError(true);
        setIsLoading(false);
      }
    }, 8000);

    return () => clearTimeout(timeout);
  }, [isLoading, useGoogleViewer, isText, viewerError, loadAttempt]);

  const handleRetry = () => {
    setViewerError(false);
    setUseGoogleViewer(false);
    setIsLoading(true);
    setLoadAttempt(prev => prev + 1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'ArrowLeft' && hasPrevious && onPrevious) {
      onPrevious();
    } else if (e.key === 'ArrowRight' && hasNext && onNext) {
      onNext();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black flex flex-col"
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-black/80 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-white hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </Button>
          <div>
            <p className="text-white font-medium truncate max-w-[200px] sm:max-w-[400px]">
              {displayName}
            </p>
            <p className="text-white/60 text-sm">{documentType}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {onDownload && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onDownload}
              className="text-white hover:bg-white/10"
              title="Herunterladen"
            >
              <Download className="w-5 h-5" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => window.open(url, '_blank')}
            className="text-white hover:bg-white/10"
            title="In neuem Tab öffnen"
          >
            <ExternalLink className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Navigation arrows */}
      {hasPrevious && onPrevious && (
        <button
          onClick={onPrevious}
          className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/40 text-white hover:bg-black/60 transition-colors z-10"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
      )}
      {hasNext && onNext && (
        <button
          onClick={onNext}
          className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/40 text-white hover:bg-black/60 transition-colors z-10"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      )}

      {/* Document viewer */}
      <div className="flex-1 flex items-center justify-center p-4 relative overflow-auto">
        {isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/95 z-10">
            <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
            <p className="text-foreground font-medium">Dokument wird geladen...</p>
            <p className="text-muted-foreground text-sm mt-1">
              {isText ? 'Lade Textinhalt...' : useGoogleViewer ? 'Verwende Google Docs Viewer' : 'Verwende Microsoft Office Viewer'}
            </p>
          </div>
        )}

        {viewerError ? (
          <div className="flex flex-col items-center justify-center text-center p-8">
            <div className="w-20 h-20 rounded-full bg-yellow-500/10 flex items-center justify-center mb-4">
              <AlertTriangle className="w-10 h-10 text-yellow-500" />
            </div>
            <h3 className="text-white text-lg font-semibold mb-2">
              Vorschau nicht verfügbar
            </h3>
            <p className="text-white/60 mb-6 max-w-md">
              Dieses Dokument kann nicht direkt im Browser angezeigt werden. 
              Du kannst es herunterladen, um es lokal zu öffnen.
            </p>
            <div className="flex gap-3">
              <Button onClick={handleRetry} variant="outline" className="text-white border-white/20 hover:bg-white/10">
                <RefreshCw className="w-4 h-4 mr-2" />
                Erneut versuchen
              </Button>
              {onDownload && (
                <Button onClick={onDownload} variant="default">
                  <Download className="w-4 h-4 mr-2" />
                  Herunterladen
                </Button>
              )}
              <Button 
                variant="outline" 
                onClick={() => window.open(url, '_blank')}
                className="text-white border-white/20 hover:bg-white/10"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Direkt öffnen
              </Button>
            </div>
          </div>
        ) : isText && textContent !== null ? (
          <div className="w-full max-w-[95vw] max-h-[85vh] overflow-auto bg-[#1e1e1e] rounded-lg">
            {isMarkdown ? (
              <div className="prose prose-invert prose-sm max-w-none p-6">
                <ReactMarkdown
                  components={{
                    code({ node, className, children, ...props }) {
                      const match = /language-(\w+)/.exec(className || '');
                      const isInline = !match && !className;
                      return isInline ? (
                        <code className="bg-white/10 px-1 py-0.5 rounded text-sm" {...props}>
                          {children}
                        </code>
                      ) : (
                        <SyntaxHighlighter
                          style={oneDark}
                          language={match ? match[1] : 'text'}
                          PreTag="div"
                        >
                          {String(children).replace(/\n$/, '')}
                        </SyntaxHighlighter>
                      );
                    }
                  }}
                >
                  {textContent}
                </ReactMarkdown>
              </div>
            ) : (
              <SyntaxHighlighter
                language={language}
                style={oneDark}
                showLineNumbers
                wrapLines
                customStyle={{
                  margin: 0,
                  padding: '1.5rem',
                  background: 'transparent',
                  fontSize: '0.875rem',
                }}
              >
                {textContent}
              </SyntaxHighlighter>
            )}
          </div>
        ) : !isText ? (
          <iframe
            key={`${useGoogleViewer}-${loadAttempt}`}
            src={viewerUrl}
            className="w-full h-full max-w-[95vw] max-h-[85vh] rounded-lg bg-white"
            onLoad={handleIframeLoad}
            onError={handleIframeError}
            title={displayName}
            sandbox="allow-scripts allow-same-origin allow-popups"
          />
        ) : null}
      </div>

      {/* Footer */}
      <div className="p-4 bg-black/80 backdrop-blur-sm flex items-center justify-center">
        <p className="text-white/60 text-sm">
          {isText ? 'Textvorschau' : useGoogleViewer ? 'Google Docs Viewer' : 'Microsoft Office Online'}
        </p>
      </div>
    </motion.div>
  );
}

export default DocumentPreview;
