import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { 
  Code, 
  Save, 
  RotateCcw, 
  Download, 
  Upload, 
  Eye, 
  EyeOff,
  AlertTriangle,
  CheckCircle,
  Copy
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface CustomCSSEditorProps {
  onClose?: () => void;
}

const DEFAULT_CSS = `/* PhantomLock Custom CSS */
/* Hier kannst du eigene Styles hinzufügen */

/* Beispiel: Primärfarbe ändern */
/*
:root {
  --primary: 280 83% 58%;
}
*/

/* Beispiel: Schriftart ändern */
/*
body {
  font-family: 'Comic Sans MS', cursive;
}
*/
`;

const CSS_SNIPPETS = [
  {
    name: 'Runde Avatare',
    code: `.avatar { border-radius: 50% !important; }`,
  },
  {
    name: 'Größere Schrift',
    code: `body { font-size: 18px !important; }`,
  },
  {
    name: 'Kompakte Sidebar',
    code: `.sidebar { width: 60px !important; }\n.sidebar span { display: none !important; }`,
  },
  {
    name: 'Neon Buttons',
    code: `button { box-shadow: 0 0 10px hsl(var(--primary)) !important; }`,
  },
  {
    name: 'Dunkler Hintergrund',
    code: `:root { --background: 240 10% 5%; }`,
  },
];

export function CustomCSSEditor({ onClose }: CustomCSSEditorProps) {
  const { userId } = useAuth();
  const [css, setCss] = useState(DEFAULT_CSS);
  const [isEnabled, setIsEnabled] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isValid, setIsValid] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [previewEnabled, setPreviewEnabled] = useState(false);

  // Load saved CSS
  useEffect(() => {
    if (!userId) return;
    
    const savedCSS = localStorage.getItem(`custom-css-${userId}`);
    const savedEnabled = localStorage.getItem(`custom-css-enabled-${userId}`);
    
    if (savedCSS) setCss(savedCSS);
    if (savedEnabled) setIsEnabled(savedEnabled === 'true');
  }, [userId]);

  // Apply CSS preview
  useEffect(() => {
    const styleId = 'custom-css-preview';
    let styleEl = document.getElementById(styleId) as HTMLStyleElement | null;

    if (previewEnabled && isValid) {
      if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = styleId;
        document.head.appendChild(styleEl);
      }
      styleEl.textContent = css;
    } else if (styleEl) {
      styleEl.remove();
    }

    return () => {
      const el = document.getElementById(styleId);
      if (el && !isEnabled) el.remove();
    };
  }, [css, previewEnabled, isValid, isEnabled]);

  // Validate CSS
  const validateCSS = useCallback((cssText: string) => {
    try {
      // Basic validation - try to parse
      const style = document.createElement('style');
      style.textContent = cssText;
      document.head.appendChild(style);
      
      // Check for parse errors
      const sheet = style.sheet;
      if (sheet && sheet.cssRules) {
        // Successfully parsed
        setIsValid(true);
        setErrorMessage(null);
      }
      
      document.head.removeChild(style);
      return true;
    } catch (error: any) {
      setIsValid(false);
      setErrorMessage(error.message || 'Ungültiges CSS');
      return false;
    }
  }, []);

  // Handle CSS change
  const handleCSSChange = (value: string) => {
    setCss(value);
    validateCSS(value);
  };

  // Save CSS
  const handleSave = async () => {
    if (!userId) return;
    
    if (!validateCSS(css)) {
      toast.error('CSS enthält Fehler');
      return;
    }

    setIsSaving(true);
    try {
      localStorage.setItem(`custom-css-${userId}`, css);
      localStorage.setItem(`custom-css-enabled-${userId}`, isEnabled.toString());
      
      // Apply or remove global CSS
      const styleId = 'custom-css-global';
      let styleEl = document.getElementById(styleId) as HTMLStyleElement | null;
      
      if (isEnabled) {
        if (!styleEl) {
          styleEl = document.createElement('style');
          styleEl.id = styleId;
          document.head.appendChild(styleEl);
        }
        styleEl.textContent = css;
      } else if (styleEl) {
        styleEl.remove();
      }
      
      toast.success('CSS gespeichert');
    } catch (error) {
      toast.error('Fehler beim Speichern');
    } finally {
      setIsSaving(false);
    }
  };

  // Reset to default
  const handleReset = () => {
    setCss(DEFAULT_CSS);
    setIsValid(true);
    setErrorMessage(null);
    toast.info('CSS zurückgesetzt');
  };

  // Export CSS
  const handleExport = () => {
    const blob = new Blob([css], { type: 'text/css' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'phantomlock-custom.css';
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSS exportiert');
  };

  // Import CSS
  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (validateCSS(content)) {
        setCss(content);
        toast.success('CSS importiert');
      } else {
        toast.error('Ungültige CSS-Datei');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Insert snippet
  const insertSnippet = (code: string) => {
    setCss(prev => `${prev}\n\n${code}`);
    validateCSS(css + '\n\n' + code);
    toast.success('Snippet eingefügt');
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
          <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
            <Code className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Custom CSS</h2>
            <p className="text-sm text-muted-foreground">Power-User Styles</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Enable toggle */}
          <button
            onClick={() => setIsEnabled(!isEnabled)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
              isEnabled
                ? "bg-green-500/20 text-green-500"
                : "bg-muted text-muted-foreground"
            )}
          >
            {isEnabled ? 'Aktiviert' : 'Deaktiviert'}
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          Speichern
        </button>

        <button
          onClick={() => setPreviewEnabled(!previewEnabled)}
          className={cn(
            "flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors",
            previewEnabled
              ? "bg-blue-500/20 text-blue-400"
              : "bg-muted hover:bg-muted/80 text-muted-foreground"
          )}
        >
          {previewEnabled ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          {previewEnabled ? 'Vorschau aus' : 'Vorschau'}
        </button>

        <button
          onClick={handleReset}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted hover:bg-muted/80 text-muted-foreground transition-colors text-sm"
        >
          <RotateCcw className="w-4 h-4" />
          Zurücksetzen
        </button>

        <button
          onClick={handleExport}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted hover:bg-muted/80 text-muted-foreground transition-colors text-sm"
        >
          <Download className="w-4 h-4" />
          Export
        </button>

        <label className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted hover:bg-muted/80 text-muted-foreground transition-colors text-sm cursor-pointer">
          <Upload className="w-4 h-4" />
          Import
          <input
            type="file"
            accept=".css"
            onChange={handleImport}
            className="hidden"
          />
        </label>
      </div>

      {/* Validation status */}
      <div className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-lg text-sm",
        isValid ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"
      )}>
        {isValid ? (
          <>
            <CheckCircle className="w-4 h-4" />
            CSS ist gültig
          </>
        ) : (
          <>
            <AlertTriangle className="w-4 h-4" />
            {errorMessage || 'CSS enthält Fehler'}
          </>
        )}
      </div>

      {/* CSS Editor */}
      <div className="relative">
        <textarea
          value={css}
          onChange={(e) => handleCSSChange(e.target.value)}
          className={cn(
            "w-full h-80 p-4 rounded-xl font-mono text-sm resize-none",
            "bg-slate-900 text-slate-100 border",
            isValid ? "border-border" : "border-red-500",
            "focus:outline-none focus:ring-2 focus:ring-primary/50"
          )}
          placeholder="/* Dein CSS hier */"
          spellCheck={false}
        />
        
        {/* Line numbers overlay (simplified) */}
        <div className="absolute top-4 left-0 w-8 text-right pr-2 pointer-events-none">
          {css.split('\n').slice(0, 20).map((_, i) => (
            <div key={i} className="text-xs text-slate-600 leading-5">
              {i + 1}
            </div>
          ))}
        </div>
      </div>

      {/* Snippets */}
      <div>
        <h3 className="text-sm font-medium text-foreground mb-3">Schnell-Snippets</h3>
        <div className="flex flex-wrap gap-2">
          {CSS_SNIPPETS.map((snippet) => (
            <button
              key={snippet.name}
              onClick={() => insertSnippet(snippet.code)}
              className="px-3 py-1.5 rounded-lg bg-muted hover:bg-muted/80 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {snippet.name}
            </button>
          ))}
        </div>
      </div>

      {/* Warning */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
        <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-medium text-foreground mb-1">Hinweis</p>
          <p className="text-muted-foreground">
            Custom CSS kann die App-Darstellung beeinträchtigen. 
            Bei Problemen deaktiviere die Funktion oder setze auf Standard zurück.
          </p>
        </div>
      </div>
    </motion.div>
  );
}
