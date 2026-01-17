import React, { memo, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import DOMPurify from 'dompurify';

interface MarkdownRendererProps {
  content: string;
  title?: string;
  showTitle?: boolean;
}

/**
 * Sanitize content to prevent XSS attacks
 * DOMPurify removes dangerous HTML/JS while preserving safe Markdown
 */
const sanitizeContent = (content: string): string => {
  // Configure DOMPurify to allow safe Markdown elements
  return DOMPurify.sanitize(content, {
    ALLOWED_TAGS: [
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'p', 'br', 'hr',
      'ul', 'ol', 'li',
      'blockquote', 'pre', 'code',
      'strong', 'em', 'b', 'i', 'u', 's', 'del',
      'a', 'img',
      'table', 'thead', 'tbody', 'tr', 'th', 'td',
      'span', 'div',
    ],
    ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class', 'id', 'target', 'rel'],
    ALLOW_DATA_ATTR: false,
    // Force all links to open in new tab with noopener
    ADD_ATTR: ['target', 'rel'],
  });
};

export const MarkdownRenderer = memo(function MarkdownRenderer({
  content,
  title,
  showTitle = true,
}: MarkdownRendererProps) {
  // Sanitize content to prevent XSS
  const sanitizedContent = useMemo(() => {
    return sanitizeContent(content || '');
  }, [content]);

  return (
    <div className="prose prose-neutral dark:prose-invert max-w-none">
      {showTitle && title && (
        <h1 className="text-2xl font-bold text-foreground mb-6">{DOMPurify.sanitize(title)}</h1>
      )}
      <ReactMarkdown
        components={{
          code: ({ className, children, ...props }) => {
            const match = /language-(\w+)/.exec(className || '');
            const isInline = !match && String(children).split('\n').length === 1;
            
            if (isInline) {
              return (
                <code className="bg-muted rounded px-1.5 py-0.5 text-primary font-mono text-sm">
                  {children}
                </code>
              );
            }
            
            return match ? (
              <SyntaxHighlighter
                style={oneDark}
                language={match[1]}
                PreTag="div"
                className="rounded-xl !bg-[#1e1e2e] !mt-0 !mb-4"
                customStyle={{ 
                  fontSize: '0.875rem',
                  borderRadius: '0.75rem',
                  padding: '1rem',
                  margin: 0,
                }}
              >
                {String(children).replace(/\n$/, '')}
              </SyntaxHighlighter>
            ) : (
              <code className="bg-muted rounded px-1.5 py-0.5 text-primary font-mono text-sm block p-4 overflow-x-auto">
                {children}
              </code>
            );
          },
          pre: ({ children }) => <>{children}</>,
          h1: ({ children }) => <h1 className="text-2xl font-bold text-foreground mt-6 mb-4">{children}</h1>,
          h2: ({ children }) => <h2 className="text-xl font-bold text-foreground mt-5 mb-3">{children}</h2>,
          h3: ({ children }) => <h3 className="text-lg font-bold text-foreground mt-4 mb-2">{children}</h3>,
          p: ({ children }) => <p className="text-foreground mb-4 leading-relaxed">{children}</p>,
          ul: ({ children }) => <ul className="list-disc list-inside text-foreground mb-4 space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal list-inside text-foreground mb-4 space-y-1">{children}</ol>,
          li: ({ children }) => {
            const text = String(children);
            if (text.startsWith('[ ] ')) {
              return (
                <li className="flex items-center gap-2">
                  <span className="w-4 h-4 border border-muted-foreground rounded" aria-label="Nicht erledigt" />
                  {text.slice(4)}
                </li>
              );
            }
            if (text.startsWith('[x] ')) {
              return (
                <li className="flex items-center gap-2">
                  <span className="w-4 h-4 bg-primary rounded flex items-center justify-center text-xs text-primary-foreground" aria-label="Erledigt">✓</span>
                  {text.slice(4)}
                </li>
              );
            }
            return <li>{children}</li>;
          },
          a: ({ href, children }) => (
            <a 
              href={href} 
              className="text-primary hover:underline" 
              target="_blank" 
              rel="noopener noreferrer"
              aria-label={`Link zu ${href}`}
            >
              {children}
            </a>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-primary pl-4 italic text-muted-foreground my-4">
              {children}
            </blockquote>
          ),
        }}
      >
        {sanitizedContent || '*Keine Inhalte*'}
      </ReactMarkdown>
    </div>
  );
});

export default MarkdownRenderer;
