import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Tag, Cloud, Loader2, RefreshCw, Search } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { useTags } from '@/hooks/useTags';
import { cn } from '@/lib/utils';

interface TagUsage {
  id: string;
  name: string;
  color: string;
  count: number;
}

export default function TagCloud() {
  const [tagUsage, setTagUsage] = useState<TagUsage[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const { userId, supabaseClient: supabase } = useAuth();
  const { tags } = useTags();

  const fetchTagUsage = useCallback(async () => {
    if (!userId) return;
    setLoading(true);

    try {
      // Fetch items with tags from all tables
      const [notesRes, photosRes, filesRes, linksRes] = await Promise.all([
        supabase.from('notes').select('tags').eq('user_id', userId).is('deleted_at', null),
        supabase.from('photos').select('tags').eq('user_id', userId).is('deleted_at', null),
        supabase.from('files').select('tags').eq('user_id', userId).is('deleted_at', null),
        supabase.from('links').select('tags').eq('user_id', userId).is('deleted_at', null),
      ]);

      // Count tag occurrences
      const tagCounts: Record<string, number> = {};
      
      const allItems = [
        ...(notesRes.data || []),
        ...(photosRes.data || []),
        ...(filesRes.data || []),
        ...(linksRes.data || []),
      ];

      allItems.forEach(item => {
        if (item.tags && Array.isArray(item.tags)) {
          item.tags.forEach((tagName: string) => {
            tagCounts[tagName] = (tagCounts[tagName] || 0) + 1;
          });
        }
      });

      // Map to tag usage with colors
      const usage: TagUsage[] = tags.map(tag => ({
        id: tag.id,
        name: tag.name,
        color: tag.color,
        count: tagCounts[tag.name] || 0
      })).sort((a, b) => b.count - a.count);

      setTagUsage(usage);
    } catch (error) {
      console.error('Error fetching tag usage:', error);
    } finally {
      setLoading(false);
    }
  }, [userId, supabase, tags]);

  useEffect(() => {
    if (tags.length > 0) {
      fetchTagUsage();
    }
  }, [fetchTagUsage, tags.length]);

  const filteredTags = tagUsage.filter(tag => 
    tag.name.toLowerCase().includes(search.toLowerCase())
  );

  const maxCount = Math.max(...tagUsage.map(t => t.count), 1);
  const minSize = 0.8;
  const maxSize = 2.5;

  const getTagSize = (count: number) => {
    if (count === 0) return minSize;
    const ratio = count / maxCount;
    return minSize + (ratio * (maxSize - minSize));
  };

  const totalUsage = tagUsage.reduce((sum, t) => sum + t.count, 0);
  const usedTags = tagUsage.filter(t => t.count > 0).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <PageHeader
        title="Tag-Cloud"
        subtitle="Visualisierung deiner Tags"
        icon={<Cloud className="w-5 h-5 text-primary" />}
        backTo="/tags"
      />

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="glass-card p-4 text-center">
          <p className="text-2xl font-bold text-foreground">{tags.length}</p>
          <p className="text-sm text-muted-foreground">Tags gesamt</p>
        </div>
        <div className="glass-card p-4 text-center">
          <p className="text-2xl font-bold text-primary">{usedTags}</p>
          <p className="text-sm text-muted-foreground">In Verwendung</p>
        </div>
        <div className="glass-card p-4 text-center">
          <p className="text-2xl font-bold text-foreground">{totalUsage}</p>
          <p className="text-sm text-muted-foreground">Zuweisungen</p>
        </div>
      </div>

      {/* Search and Refresh */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tags durchsuchen..."
            className="pl-10"
          />
        </div>
        <Button variant="outline" size="icon" onClick={fetchTagUsage} disabled={loading}>
          <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
        </Button>
      </div>

      {/* Tag Cloud */}
      <div className="glass-card p-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : filteredTags.length === 0 ? (
          <div className="text-center py-12">
            <Tag className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              {search ? 'Keine Tags gefunden' : 'Noch keine Tags vorhanden'}
            </p>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-center gap-3 min-h-[300px]">
            {filteredTags.map((tag, index) => (
              <motion.div
                key={tag.id}
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.02, type: 'spring' }}
                whileHover={{ scale: 1.1 }}
                className="cursor-default"
                title={`${tag.name}: ${tag.count} Verwendungen`}
              >
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all",
                    "hover:ring-2 hover:ring-offset-2 hover:ring-offset-background",
                    tag.count === 0 && "opacity-40"
                  )}
                  style={{
                    fontSize: `${getTagSize(tag.count)}rem`,
                    backgroundColor: `${tag.color}20`,
                    color: tag.color,
                    borderColor: tag.color,
                    border: '1px solid',
                  }}
                >
                  <Tag className="w-[0.8em] h-[0.8em]" />
                  {tag.name}
                  {tag.count > 0 && (
                    <span 
                      className="text-[0.6em] px-1.5 py-0.5 rounded-full ml-1"
                      style={{ backgroundColor: tag.color, color: 'white' }}
                    >
                      {tag.count}
                    </span>
                  )}
                </span>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Top Tags List */}
      {usedTags > 0 && (
        <div className="glass-card p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Top 10 Tags</h3>
          <div className="space-y-3">
            {tagUsage.slice(0, 10).filter(t => t.count > 0).map((tag, index) => (
              <div key={tag.id} className="flex items-center gap-3">
                <span className="w-6 text-center text-sm text-muted-foreground">
                  {index + 1}.
                </span>
                <div 
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: `${tag.color}20` }}
                >
                  <Tag className="w-4 h-4" style={{ color: tag.color }} />
                </div>
                <span className="flex-1 text-foreground">{tag.name}</span>
                <span 
                  className="px-2 py-0.5 rounded text-sm"
                  style={{ backgroundColor: `${tag.color}20`, color: tag.color }}
                >
                  {tag.count}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}
