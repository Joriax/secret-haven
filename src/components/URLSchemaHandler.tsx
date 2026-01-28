import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

/**
 * URL Schema Handler for PhantomVault
 * 
 * Supported schemas:
 * - phantomvault://new-note → Creates new note
 * - phantomvault://new-photo → Opens photo upload
 * - phantomvault://new-file → Opens file upload
 * - phantomvault://search?q=query → Opens search with query
 * - phantomvault://note/[id] → Opens specific note
 * - phantomvault://photo/[id] → Opens specific photo
 * - phantomvault://album/[id] → Opens specific album
 * - phantomvault://lock → Locks the vault immediately
 * 
 * Web fallback (for non-PWA):
 * - /action/new-note
 * - /action/search?q=query
 * etc.
 */

interface URLSchemaHandlerProps {
  onNewNote?: () => void;
  onNewPhoto?: () => void;
  onNewFile?: () => void;
  onLock?: () => void;
}

export function URLSchemaHandler({
  onNewNote,
  onNewPhoto,
  onNewFile,
  onLock,
}: URLSchemaHandlerProps) {
  const navigate = useNavigate();

  useEffect(() => {
    const handleURLSchema = () => {
      const url = window.location.href;
      const pathname = window.location.pathname;
      const searchParams = new URLSearchParams(window.location.search);

      // Check for action routes (web fallback)
      if (pathname.startsWith('/action/')) {
        const action = pathname.replace('/action/', '');
        
        switch (action) {
          case 'new-note':
            onNewNote?.();
            toast.success('Neue Notiz wird erstellt...');
            navigate('/notes', { replace: true });
            break;
            
          case 'new-photo':
            onNewPhoto?.();
            toast.success('Foto-Upload wird geöffnet...');
            navigate('/photos', { replace: true });
            break;
            
          case 'new-file':
            onNewFile?.();
            toast.success('Datei-Upload wird geöffnet...');
            navigate('/files', { replace: true });
            break;
            
          case 'search':
            const query = searchParams.get('q') || '';
            navigate(`/dashboard?search=${encodeURIComponent(query)}`, { replace: true });
            break;
            
          case 'lock':
            onLock?.();
            navigate('/login', { replace: true });
            break;
            
          default:
            // Check for item navigation: /action/note/[id], /action/photo/[id], etc.
            const parts = action.split('/');
            if (parts.length === 2) {
              const [type, id] = parts;
              switch (type) {
                case 'note':
                  navigate(`/notes?id=${id}`, { replace: true });
                  break;
                case 'photo':
                  navigate(`/photos?id=${id}`, { replace: true });
                  break;
                case 'album':
                  navigate(`/photos?album=${id}`, { replace: true });
                  break;
                case 'file':
                  navigate(`/files?id=${id}`, { replace: true });
                  break;
              }
            }
        }
      }

      // Register custom protocol handler (for PWA)
      if ('registerProtocolHandler' in navigator) {
        try {
          // This allows the app to handle phantomvault:// URLs
          (navigator as any).registerProtocolHandler(
            'web+phantomvault',
            `${window.location.origin}/action/%s`,
            'PhantomVault'
          );
        } catch (e) {
          // Protocol handler may not be supported or already registered
          console.debug('Protocol handler registration skipped:', e);
        }
      }
    };

    handleURLSchema();

    // Listen for popstate events (back/forward navigation)
    window.addEventListener('popstate', handleURLSchema);
    
    return () => {
      window.removeEventListener('popstate', handleURLSchema);
    };
  }, [navigate, onNewNote, onNewPhoto, onNewFile, onLock]);

  return null;
}

/**
 * Hook to generate URL schema links
 */
export function useURLSchema() {
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';

  const generateLink = (action: string, params?: Record<string, string>) => {
    const url = new URL(`${baseUrl}/action/${action}`);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.set(key, value);
      });
    }
    return url.toString();
  };

  return {
    newNote: generateLink('new-note'),
    newPhoto: generateLink('new-photo'),
    newFile: generateLink('new-file'),
    lock: generateLink('lock'),
    search: (query: string) => generateLink('search', { q: query }),
    openNote: (id: string) => generateLink(`note/${id}`),
    openPhoto: (id: string) => generateLink(`photo/${id}`),
    openAlbum: (id: string) => generateLink(`album/${id}`),
    openFile: (id: string) => generateLink(`file/${id}`),
    
    // Apple Shortcuts compatible
    shortcutActions: [
      {
        name: 'Neue Notiz erstellen',
        description: 'Erstellt eine neue leere Notiz',
        url: generateLink('new-note'),
      },
      {
        name: 'Foto hochladen',
        description: 'Öffnet den Foto-Upload Dialog',
        url: generateLink('new-photo'),
      },
      {
        name: 'Datei hochladen',
        description: 'Öffnet den Datei-Upload Dialog',
        url: generateLink('new-file'),
      },
      {
        name: 'Vault sperren',
        description: 'Sperrt den Vault sofort',
        url: generateLink('lock'),
      },
      {
        name: 'Suchen',
        description: 'Öffnet die Suche mit einem Begriff',
        url: generateLink('search', { q: '{query}' }),
      },
    ],
  };
}

export default URLSchemaHandler;
