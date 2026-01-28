import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useHaptics } from './useHaptics';

interface VoiceCommand {
  phrases: string[];
  action: () => void;
  description: string;
}

interface UseVoiceCommandsOptions {
  enabled?: boolean;
  language?: string;
  continuous?: boolean;
  onResult?: (transcript: string) => void;
  onCommand?: (command: string) => void;
}

interface UseVoiceCommandsReturn {
  isSupported: boolean;
  isListening: boolean;
  transcript: string;
  startListening: () => void;
  stopListening: () => void;
  toggleListening: () => void;
  availableCommands: VoiceCommand[];
}

export function useVoiceCommands(options: UseVoiceCommandsOptions = {}): UseVoiceCommandsReturn {
  const {
    enabled = true,
    language = 'de-DE',
    continuous = false,
    onResult,
    onCommand,
  } = options;

  const [isSupported, setIsSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  
  const recognitionRef = useRef<any>(null);
  const navigate = useNavigate();
  const { vibrateSuccess, vibrateWarning } = useHaptics();
  const initRef = useRef(false);

  // Memoized commands to prevent recreation
  const commands: VoiceCommand[] = useMemo(() => [
    {
      phrases: ['neue notiz', 'notiz erstellen', 'erstelle notiz', 'new note'],
      action: () => navigate('/notes', { state: { createNew: true } }),
      description: 'Neue Notiz erstellen',
    },
    {
      phrases: ['öffne notizen', 'notizen', 'zeige notizen', 'notes'],
      action: () => navigate('/notes'),
      description: 'Notizen öffnen',
    },
    {
      phrases: ['öffne fotos', 'fotos', 'zeige fotos', 'galerie', 'photos'],
      action: () => navigate('/photos'),
      description: 'Fotos öffnen',
    },
    {
      phrases: ['öffne dateien', 'dateien', 'zeige dateien', 'files'],
      action: () => navigate('/files'),
      description: 'Dateien öffnen',
    },
    {
      phrases: ['öffne links', 'links', 'zeige links', 'bookmarks'],
      action: () => navigate('/links'),
      description: 'Links öffnen',
    },
    {
      phrases: ['dashboard', 'startseite', 'home', 'übersicht'],
      action: () => navigate('/dashboard'),
      description: 'Dashboard öffnen',
    },
    {
      phrases: ['suche', 'suchen', 'finde', 'search'],
      action: () => {
        const event = new CustomEvent('openGlobalSearch');
        window.dispatchEvent(event);
      },
      description: 'Suche öffnen',
    },
    {
      phrases: ['einstellungen', 'settings', 'optionen'],
      action: () => navigate('/settings'),
      description: 'Einstellungen öffnen',
    },
    {
      phrases: ['favoriten', 'favorites', 'zeige favoriten'],
      action: () => navigate('/favorites'),
      description: 'Favoriten öffnen',
    },
    {
      phrases: ['papierkorb', 'trash', 'gelöschte'],
      action: () => navigate('/trash'),
      description: 'Papierkorb öffnen',
    },
    {
      phrases: ['sperren', 'lock', 'abmelden', 'logout'],
      action: () => navigate('/action/lock'),
      description: 'App sperren',
    },
    {
      phrases: ['zurück', 'back', 'go back'],
      action: () => window.history.back(),
      description: 'Zurück navigieren',
    },
    {
      phrases: ['erinnerungen', 'reminders', 'zeige erinnerungen'],
      action: () => navigate('/calendar'),
      description: 'Kalender/Erinnerungen',
    },
    {
      phrases: ['tiktok', 'videos', 'zeige videos'],
      action: () => navigate('/tiktok'),
      description: 'TikTok Videos',
    },
    {
      phrases: ['statistiken', 'stats', 'usage'],
      action: () => navigate('/usage-stats'),
      description: 'Nutzungsstatistiken',
    },
  ], [navigate]);

  // Initialize speech recognition once
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (SpeechRecognition) {
      setIsSupported(true);
    } else {
      setIsSupported(false);
    }
  }, []);

  // Create recognition instance when needed
  const createRecognition = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return null;

    const recognition = new SpeechRecognition();
    recognition.continuous = continuous;
    recognition.interimResults = true;
    recognition.lang = language;
    recognition.maxAlternatives = 3;
    
    recognition.onstart = () => {
      setIsListening(true);
      vibrateSuccess();
    };
    
    recognition.onend = () => {
      setIsListening(false);
    };
    
    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
      
      if (event.error === 'not-allowed') {
        toast.error('Mikrofon-Zugriff verweigert');
      } else if (event.error !== 'aborted') {
        vibrateWarning();
      }
    };
    
    recognition.onresult = (event: any) => {
      const results = event.results;
      const lastResult = results[results.length - 1];
      
      if (lastResult.isFinal) {
        const finalTranscript = lastResult[0].transcript.toLowerCase().trim();
        setTranscript(finalTranscript);
        onResult?.(finalTranscript);
        
        // Check for command matches
        let commandFound = false;
        for (const command of commands) {
          for (const phrase of command.phrases) {
            if (finalTranscript.includes(phrase.toLowerCase())) {
              command.action();
              onCommand?.(phrase);
              vibrateSuccess();
              toast.success(`Befehl: ${command.description}`);
              commandFound = true;
              break;
            }
          }
          if (commandFound) break;
        }
        
        if (!commandFound && finalTranscript.length > 3) {
          toast.info(`"${finalTranscript}" - Befehl nicht erkannt`);
        }
      } else {
        setTranscript(lastResult[0].transcript);
      }
    };
    
    return recognition;
  }, [language, continuous, vibrateSuccess, vibrateWarning, onResult, onCommand, commands]);

  const startListening = useCallback(() => {
    if (!isSupported || !enabled) return;
    
    // Create new recognition for each session
    const recognition = createRecognition();
    if (!recognition) return;
    
    recognitionRef.current = recognition;
    
    try {
      recognition.start();
    } catch (e: any) {
      if (!e.message?.includes('already started')) {
        console.error('Failed to start speech recognition:', e);
      }
    }
  }, [isSupported, enabled, createRecognition]);

  const stopListening = useCallback(() => {
    if (!recognitionRef.current) return;
    
    try {
      recognitionRef.current.stop();
    } catch (e) {
      // Not listening
    }
    
    setIsListening(false);
    recognitionRef.current = null;
  }, []);

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
        recognitionRef.current = null;
      }
    };
  }, []);

  return {
    isSupported,
    isListening,
    transcript,
    startListening,
    stopListening,
    toggleListening,
    availableCommands: commands,
  };
}

export default useVoiceCommands;
