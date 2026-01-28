import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import ForceGraph2D from 'react-force-graph-2d';
import { motion } from 'framer-motion';
import { 
  ArrowLeft, 
  ZoomIn, 
  ZoomOut, 
  Maximize2, 
  RefreshCw,
  FileText,
  Link2
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useNoteLinks } from '@/hooks/useNoteLinks';
import { cn } from '@/lib/utils';

interface Note {
  id: string;
  title: string;
  content: string | null;
}

interface GraphNode {
  id: string;
  name: string;
  val: number;
  x?: number;
  y?: number;
}

interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
}

export default function NoteGraph() {
  const navigate = useNavigate();
  const { userId, supabaseClient: supabase } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const graphRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  const { graphData, getBacklinksToNote, getLinksFromNote } = useNoteLinks(notes);

  // Fetch notes
  useEffect(() => {
    const fetchNotes = async () => {
      if (!userId) return;

      const { data, error } = await supabase
        .from('notes')
        .select('id, title, content')
        .eq('user_id', userId)
        .is('deleted_at', null);

      if (!error && data) {
        setNotes(data);
      }
      setIsLoading(false);
    };

    fetchNotes();
  }, [userId, supabase]);

  // Update dimensions on resize
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight
        });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  const handleNodeClick = useCallback((node: GraphNode) => {
    setSelectedNode(node);
    
    // Center on node
    if (graphRef.current) {
      graphRef.current.centerAt(node.x, node.y, 500);
      graphRef.current.zoom(2, 500);
    }
  }, []);

  const handleNodeDoubleClick = useCallback((node: GraphNode) => {
    navigate('/notes', { state: { selectedNoteId: node.id } });
  }, [navigate]);

  const handleZoomIn = () => {
    if (graphRef.current) {
      const currentZoom = graphRef.current.zoom();
      graphRef.current.zoom(currentZoom * 1.5, 300);
    }
  };

  const handleZoomOut = () => {
    if (graphRef.current) {
      const currentZoom = graphRef.current.zoom();
      graphRef.current.zoom(currentZoom / 1.5, 300);
    }
  };

  const handleFitView = () => {
    if (graphRef.current) {
      graphRef.current.zoomToFit(400, 50);
    }
  };

  const handleReset = () => {
    if (graphRef.current) {
      graphRef.current.zoomToFit(400, 50);
    }
    setSelectedNode(null);
  };

  // Node info panel
  const nodeInfo = useMemo(() => {
    if (!selectedNode) return null;
    
    const backlinks = getBacklinksToNote(selectedNode.id);
    const outlinks = getLinksFromNote(selectedNode.id);
    
    return { backlinks, outlinks };
  }, [selectedNode, getBacklinksToNote, getLinksFromNote]);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/notes')}
            className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-foreground">Notizen-Graph</h1>
            <p className="text-sm text-muted-foreground">
              {notes.length} Notizen • {graphData.links.length} Verbindungen
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleZoomIn}
            className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title="Vergrößern"
          >
            <ZoomIn className="w-5 h-5" />
          </button>
          <button
            onClick={handleZoomOut}
            className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title="Verkleinern"
          >
            <ZoomOut className="w-5 h-5" />
          </button>
          <button
            onClick={handleFitView}
            className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title="Alles anzeigen"
          >
            <Maximize2 className="w-5 h-5" />
          </button>
          <button
            onClick={handleReset}
            className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title="Zurücksetzen"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Graph Container */}
      <div className="flex-1 flex relative overflow-hidden">
        <div ref={containerRef} className="flex-1">
          {graphData.nodes.length === 0 ? (
            <div className="flex-1 flex items-center justify-center h-full">
              <div className="text-center">
                <Link2 className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
                <h2 className="text-xl font-bold text-foreground mb-2">Keine Verbindungen</h2>
                <p className="text-muted-foreground max-w-md">
                  Verlinke Notizen mit [[Notiz-Titel]] Syntax, um Verbindungen zu sehen.
                </p>
              </div>
            </div>
          ) : (
            <ForceGraph2D
              ref={graphRef}
              width={dimensions.width}
              height={dimensions.height}
              graphData={graphData}
              nodeLabel="name"
              nodeColor={(node: any) => 
                selectedNode?.id === node.id 
                  ? 'hsl(var(--primary))' 
                  : 'hsl(var(--muted-foreground))'
              }
              nodeRelSize={6}
              nodeVal={(node: any) => node.val}
              linkColor={() => 'hsla(var(--border), 0.5)'}
              linkWidth={1}
              linkDirectionalArrowLength={3}
              linkDirectionalArrowRelPos={1}
              onNodeClick={(node: any, event: MouseEvent) => {
                // Double-click detection
                if (event.detail === 2) {
                  handleNodeDoubleClick(node);
                } else {
                  handleNodeClick(node);
                }
              }}
              cooldownTicks={100}
              onEngineStop={() => graphRef.current?.zoomToFit(400, 50)}
              nodeCanvasObject={(node: any, ctx, globalScale) => {
                const label = node.name;
                const fontSize = 12 / globalScale;
                ctx.font = `${fontSize}px Sans-Serif`;
                const textWidth = ctx.measureText(label).width;
                const bgPadding = 2;

                // Draw node circle
                ctx.beginPath();
                ctx.arc(node.x, node.y, 5, 0, 2 * Math.PI);
                ctx.fillStyle = selectedNode?.id === node.id 
                  ? 'hsl(280, 80%, 60%)' 
                  : 'hsl(280, 30%, 50%)';
                ctx.fill();

                // Draw label
                if (globalScale > 0.5) {
                  ctx.textAlign = 'center';
                  ctx.textBaseline = 'middle';
                  ctx.fillStyle = 'hsl(0, 0%, 90%)';
                  ctx.fillText(label, node.x, node.y + 10);
                }
              }}
              backgroundColor="transparent"
            />
          )}
        </div>

        {/* Info Panel */}
        {selectedNode && nodeInfo && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="absolute right-4 top-4 w-72 bg-card border border-border rounded-xl p-4 shadow-lg"
          >
            <div className="flex items-start gap-3 mb-4">
              <FileText className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
              <div className="min-w-0">
                <h3 className="font-semibold text-foreground truncate">{selectedNode.name}</h3>
                <p className="text-sm text-muted-foreground">
                  {nodeInfo.backlinks.length} Backlinks • {nodeInfo.outlinks.length} Links
                </p>
              </div>
            </div>

            {nodeInfo.backlinks.length > 0 && (
              <div className="mb-3">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">
                  Verlinkt von
                </h4>
                <div className="space-y-1">
                  {nodeInfo.backlinks.slice(0, 5).map(bl => (
                    <button
                      key={bl.noteId}
                      onClick={() => setSelectedNode({ 
                        id: bl.noteId, 
                        name: bl.noteTitle, 
                        val: 1 
                      })}
                      className="w-full text-left px-2 py-1 rounded text-sm text-foreground hover:bg-muted transition-colors truncate"
                    >
                      {bl.noteTitle}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {nodeInfo.outlinks.length > 0 && (
              <div className="mb-3">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">
                  Verlinkt zu
                </h4>
                <div className="space-y-1">
                  {nodeInfo.outlinks.slice(0, 5).map(link => (
                    <button
                      key={link.targetId}
                      onClick={() => setSelectedNode({ 
                        id: link.targetId, 
                        name: link.targetTitle, 
                        val: 1 
                      })}
                      className="w-full text-left px-2 py-1 rounded text-sm text-foreground hover:bg-muted transition-colors truncate"
                    >
                      {link.targetTitle}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={() => navigate('/notes', { state: { selectedNoteId: selectedNode.id } })}
              className="w-full mt-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium"
            >
              Notiz öffnen
            </button>
          </motion.div>
        )}
      </div>

      {/* Legend */}
      <div className="px-6 py-3 border-t border-border flex items-center gap-6 text-sm text-muted-foreground">
        <span>Doppelklick = Notiz öffnen</span>
        <span>Ziehen = Knoten verschieben</span>
        <span>Scrollen = Zoom</span>
      </div>
    </div>
  );
}
