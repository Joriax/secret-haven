import { useState, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface Note {
  id: string;
  title: string;
  content: string | null;
}

interface NoteLink {
  sourceId: string;
  targetId: string;
  targetTitle: string;
}

interface BackLink {
  noteId: string;
  noteTitle: string;
}

// Regex to match [[Note Title]] syntax
const WIKI_LINK_REGEX = /\[\[([^\]]+)\]\]/g;

export function useNoteLinks(notes: Note[]) {
  const { userId } = useAuth();

  // Parse all wiki-links from a note's content
  const parseWikiLinks = useCallback((content: string | null): string[] => {
    if (!content) return [];
    
    const matches: string[] = [];
    let match;
    
    while ((match = WIKI_LINK_REGEX.exec(content)) !== null) {
      matches.push(match[1].trim());
    }
    
    return [...new Set(matches)]; // Remove duplicates
  }, []);

  // Get all links from all notes
  const allLinks = useMemo(() => {
    const links: NoteLink[] = [];
    
    notes.forEach(note => {
      const linkedTitles = parseWikiLinks(note.content);
      
      linkedTitles.forEach(title => {
        // Find the target note by title (case-insensitive)
        const targetNote = notes.find(n => 
          n.title.toLowerCase() === title.toLowerCase() && n.id !== note.id
        );
        
        if (targetNote) {
          links.push({
            sourceId: note.id,
            targetId: targetNote.id,
            targetTitle: targetNote.title
          });
        }
      });
    });
    
    return links;
  }, [notes, parseWikiLinks]);

  // Get links FROM a specific note
  const getLinksFromNote = useCallback((noteId: string): NoteLink[] => {
    return allLinks.filter(link => link.sourceId === noteId);
  }, [allLinks]);

  // Get backlinks TO a specific note (notes that link to this one)
  const getBacklinksToNote = useCallback((noteId: string): BackLink[] => {
    const backlinks = allLinks.filter(link => link.targetId === noteId);
    
    return backlinks.map(link => {
      const sourceNote = notes.find(n => n.id === link.sourceId);
      return {
        noteId: link.sourceId,
        noteTitle: sourceNote?.title || 'Unbekannte Notiz'
      };
    });
  }, [allLinks, notes]);

  // Convert content with wiki-links to clickable links (for rendering)
  const renderWikiLinks = useCallback((content: string | null, onLinkClick: (noteId: string) => void): string => {
    if (!content) return '';
    
    return content.replace(WIKI_LINK_REGEX, (match, title) => {
      const targetNote = notes.find(n => 
        n.title.toLowerCase() === title.trim().toLowerCase()
      );
      
      if (targetNote) {
        return `<a href="#" class="wiki-link text-primary hover:underline" data-note-id="${targetNote.id}">[[${title}]]</a>`;
      }
      
      // Broken link (note doesn't exist)
      return `<span class="wiki-link-broken text-destructive">[[${title}]]</span>`;
    });
  }, [notes]);

  // Get suggestions for auto-complete when typing [[
  const getSuggestions = useCallback((query: string, excludeNoteId?: string): Note[] => {
    if (!query) return notes.filter(n => n.id !== excludeNoteId).slice(0, 10);
    
    const lowerQuery = query.toLowerCase();
    return notes
      .filter(n => 
        n.id !== excludeNoteId && 
        n.title.toLowerCase().includes(lowerQuery)
      )
      .slice(0, 10);
  }, [notes]);

  // Build graph data for visualization
  const graphData = useMemo(() => {
    const nodes = notes.map(note => ({
      id: note.id,
      name: note.title,
      val: 1 + getBacklinksToNote(note.id).length // Size based on backlinks
    }));
    
    const links = allLinks.map(link => ({
      source: link.sourceId,
      target: link.targetId
    }));
    
    return { nodes, links };
  }, [notes, allLinks, getBacklinksToNote]);

  // Insert wiki-link at cursor position
  const insertWikiLink = useCallback((
    content: string, 
    cursorPosition: number, 
    noteTitle: string
  ): { newContent: string; newCursorPosition: number } => {
    const before = content.slice(0, cursorPosition);
    const after = content.slice(cursorPosition);
    
    // Check if we're inside an incomplete wiki-link
    const incompleteMatch = before.match(/\[\[([^\]]*?)$/);
    
    if (incompleteMatch) {
      // Replace the incomplete part
      const beforeLink = before.slice(0, before.lastIndexOf('[['));
      const newContent = beforeLink + `[[${noteTitle}]]` + after;
      return {
        newContent,
        newCursorPosition: beforeLink.length + noteTitle.length + 4
      };
    }
    
    // Just insert new wiki-link
    const newContent = before + `[[${noteTitle}]]` + after;
    return {
      newContent,
      newCursorPosition: cursorPosition + noteTitle.length + 4
    };
  }, []);

  return {
    parseWikiLinks,
    getLinksFromNote,
    getBacklinksToNote,
    renderWikiLinks,
    getSuggestions,
    graphData,
    insertWikiLink,
    allLinks
  };
}
