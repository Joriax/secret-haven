import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Shield, 
  Users, 
  FileText, 
  Image, 
  FolderOpen, 
  Link2, 
  Play,
  UserPlus,
  Crown,
  RefreshCw,
  AlertTriangle,
  Lock,
  Database,
  Key,
  ChevronDown,
  ChevronUp,
  Eye
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRoles } from '@/hooks/useUserRoles';
import { PageHeader } from '@/components/PageHeader';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Navigate } from 'react-router-dom';

interface VaultUser {
  id: string;
  created_at: string;
  recovery_key: string | null;
  admin_notes: string | null;
}

interface UserStats {
  notes: number;
  photos: number;
  files: number;
  links: number;
  tiktokVideos: number;
  secretTexts: number;
}

interface DataCounts {
  users: number;
  notes: number;
  photos: number;
  files: number;
  links: number;
  tiktokVideos: number;
  secretTexts: number;
  albums: number;
  fileAlbums: number;
}

export default function Admin() {
  const [users, setUsers] = useState<VaultUser[]>([]);
  const [userStats, setUserStats] = useState<Record<string, UserStats>>({});
  const [dataCounts, setDataCounts] = useState<DataCounts>({
    users: 0,
    notes: 0,
    photos: 0,
    files: 0,
    links: 0,
    tiktokVideos: 0,
    secretTexts: 0,
    albums: 0,
    fileAlbums: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUserPin, setNewUserPin] = useState('');
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [resetPinUser, setResetPinUser] = useState<string | null>(null);
  const [newPinValue, setNewPinValue] = useState('');
  const [showRecoveryKey, setShowRecoveryKey] = useState<string | null>(null);
  const { userId } = useAuth();
  const { isAdmin, isLoading: rolesLoading, assignRole, roles } = useUserRoles();

  const fetchData = useCallback(async () => {
    if (!userId) return;

    try {
      setIsLoading(true);

      // Fetch all users
      const { data: usersData } = await supabase
        .from('vault_users')
        .select('id, created_at, recovery_key, admin_notes')
        .order('created_at', { ascending: false });

      setUsers(usersData as VaultUser[] || []);

      // Fetch counts
      const [
        { count: notesCount },
        { count: photosCount },
        { count: filesCount },
        { count: linksCount },
        { count: tiktokCount },
        { count: secretCount },
        { count: albumsCount },
        { count: fileAlbumsCount },
      ] = await Promise.all([
        supabase.from('notes').select('*', { count: 'exact', head: true }),
        supabase.from('photos').select('*', { count: 'exact', head: true }),
        supabase.from('files').select('*', { count: 'exact', head: true }),
        supabase.from('links').select('*', { count: 'exact', head: true }),
        supabase.from('tiktok_videos').select('*', { count: 'exact', head: true }),
        supabase.from('secret_texts').select('*', { count: 'exact', head: true }),
        supabase.from('albums').select('*', { count: 'exact', head: true }),
        supabase.from('file_albums').select('*', { count: 'exact', head: true }),
      ]);

      setDataCounts({
        users: usersData?.length || 0,
        notes: notesCount || 0,
        photos: photosCount || 0,
        files: filesCount || 0,
        links: linksCount || 0,
        tiktokVideos: tiktokCount || 0,
        secretTexts: secretCount || 0,
        albums: albumsCount || 0,
        fileAlbums: fileAlbumsCount || 0,
      });

      // Fetch per-user stats
      if (usersData && usersData.length > 0) {
        const statsPromises = usersData.map(async (user) => {
          const [
            { count: userNotes },
            { count: userPhotos },
            { count: userFiles },
            { count: userLinks },
            { count: userTiktok },
            { count: userSecret },
          ] = await Promise.all([
            supabase.from('notes').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
            supabase.from('photos').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
            supabase.from('files').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
            supabase.from('links').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
            supabase.from('tiktok_videos').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
            supabase.from('secret_texts').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
          ]);

          return {
            id: user.id,
            stats: {
              notes: userNotes || 0,
              photos: userPhotos || 0,
              files: userFiles || 0,
              links: userLinks || 0,
              tiktokVideos: userTiktok || 0,
              secretTexts: userSecret || 0,
            }
          };
        });

        const allStats = await Promise.all(statsPromises);
        const statsMap: Record<string, UserStats> = {};
        allStats.forEach(({ id, stats }) => {
          statsMap[id] = stats;
        });
        setUserStats(statsMap);
      }

    } catch (error) {
      console.error('Error fetching admin data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (isAdmin) {
      fetchData();
    }
  }, [isAdmin, fetchData]);

  const handleCreateUser = async () => {
    if (!newUserPin || newUserPin.length !== 6) {
      toast.error('PIN muss 6 Ziffern haben');
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('verify-pin', {
        body: { action: 'create-user', pin: newUserPin }
      });

      if (error) throw error;

      if (data?.success) {
        toast.success(`Benutzer erstellt! Recovery-Key: ${data.recoveryKey}`);
        setNewUserPin('');
        setShowAddUser(false);
        fetchData();
      } else {
        throw new Error(data?.error || 'Fehler beim Erstellen');
      }
    } catch (error: any) {
      console.error('Error creating user:', error);
      toast.error(error.message || 'Fehler beim Erstellen');
    }
  };

  const handleResetPin = async (targetUserId: string) => {
    if (!newPinValue || newPinValue.length !== 6) {
      toast.error('PIN muss 6 Ziffern haben');
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('verify-pin', {
        body: { 
          action: 'admin-reset-pin', 
          targetUserId,
          adminUserId: userId,
          newPin: newPinValue
        }
      });

      if (error) throw error;

      if (data?.success) {
        toast.success('PIN wurde zurückgesetzt');
        setResetPinUser(null);
        setNewPinValue('');
      } else {
        throw new Error(data?.error || 'Fehler beim Zurücksetzen');
      }
    } catch (error: any) {
      console.error('Error resetting PIN:', error);
      toast.error(error.message || 'Fehler beim Zurücksetzen');
    }
  };

  const handleMakeAdmin = async (targetUserId: string) => {
    const success = await assignRole(targetUserId, 'admin');
    if (success) {
      toast.success('Admin-Rolle zugewiesen');
    } else {
      toast.error('Fehler beim Zuweisen der Rolle');
    }
  };

  const getUserRole = (targetUserId: string) => {
    const userRole = roles.find(r => r.user_id === targetUserId);
    return userRole?.role || 'user';
  };

  const getTotalItems = (stats: UserStats | undefined) => {
    if (!stats) return 0;
    return stats.notes + stats.photos + stats.files + stats.links + stats.tiktokVideos + stats.secretTexts;
  };

  if (rolesLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <RefreshCw className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  const statCards = [
    { label: 'Benutzer', value: dataCounts.users, icon: Users, color: 'text-blue-500' },
    { label: 'Notizen', value: dataCounts.notes, icon: FileText, color: 'text-yellow-500' },
    { label: 'Fotos', value: dataCounts.photos, icon: Image, color: 'text-green-500' },
    { label: 'Dateien', value: dataCounts.files, icon: FolderOpen, color: 'text-purple-500' },
    { label: 'Links', value: dataCounts.links, icon: Link2, color: 'text-cyan-500' },
    { label: 'TikToks', value: dataCounts.tiktokVideos, icon: Play, color: 'text-pink-500' },
    { label: 'Geheime Texte', value: dataCounts.secretTexts, icon: Lock, color: 'text-red-500' },
    { label: 'Alben', value: dataCounts.albums + dataCounts.fileAlbums, icon: Database, color: 'text-orange-500' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admin-Bereich"
        subtitle="System-Übersicht und Benutzerverwaltung"
        icon={<Shield className="w-5 h-5 text-primary" />}
        showBack
        backTo="/dashboard"
        actions={
          <button
            onClick={() => fetchData()}
            className="p-2 rounded-xl hover:bg-muted transition-colors"
            title="Aktualisieren"
          >
            <RefreshCw className={cn("w-5 h-5 text-muted-foreground", isLoading && "animate-spin")} />
          </button>
        }
      />

      {/* Stats Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card p-4"
          >
            <div className="flex items-center gap-3">
              <div className={cn("p-2 rounded-lg bg-muted", stat.color)}>
                <stat.icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Users Section */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Benutzerverwaltung
          </h2>
          <button
            onClick={() => setShowAddUser(!showAddUser)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            Benutzer hinzufügen
          </button>
        </div>

        {/* Add User Form */}
        <AnimatePresence>
          {showAddUser && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-6 p-4 rounded-xl bg-muted/50 border border-border"
            >
              <h3 className="font-medium text-foreground mb-3">Neuen Benutzer erstellen</h3>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={newUserPin}
                  onChange={(e) => setNewUserPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="6-stelliger PIN"
                  className="flex-1 px-4 py-2 rounded-xl bg-background border border-border text-foreground"
                  maxLength={6}
                />
                <button
                  onClick={handleCreateUser}
                  disabled={newUserPin.length !== 6}
                  className="px-4 py-2 rounded-xl bg-primary text-primary-foreground disabled:opacity-50"
                >
                  Erstellen
                </button>
                <button
                  onClick={() => {
                    setShowAddUser(false);
                    setNewUserPin('');
                  }}
                  className="px-4 py-2 rounded-xl border border-border hover:bg-muted"
                >
                  Abbrechen
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Der Benutzer kann sich mit diesem PIN anmelden. Ein Recovery-Key wird automatisch generiert.
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Users List */}
        <div className="space-y-3">
          {users.map((user) => {
            const role = getUserRole(user.id);
            const isCurrentUser = user.id === userId;
            const isExpanded = expandedUser === user.id;
            const stats = userStats[user.id];
            const totalItems = getTotalItems(stats);
            
            return (
              <motion.div
                key={user.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className={cn(
                  "rounded-xl border border-border overflow-hidden",
                  isCurrentUser && "bg-primary/5 border-primary/30"
                )}
              >
                {/* User Header */}
                <div 
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => setExpandedUser(isExpanded ? null : user.id)}
                >
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center",
                      role === 'admin' ? "bg-yellow-500/20" : "bg-muted"
                    )}>
                      {role === 'admin' ? (
                        <Crown className="w-5 h-5 text-yellow-500" />
                      ) : (
                        <Users className="w-5 h-5 text-muted-foreground" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-foreground font-mono text-sm">
                          {user.id.slice(0, 8)}...
                        </p>
                        {isCurrentUser && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary">
                            Du
                          </span>
                        )}
                        {role === 'admin' && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-500">
                            Admin
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>Erstellt: {new Date(user.created_at).toLocaleDateString('de-DE')}</span>
                        <span className="text-primary">{totalItems} Elemente</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {user.recovery_key && (
                      <span className="text-xs px-2 py-1 rounded bg-green-500/20 text-green-500">
                        Recovery
                      </span>
                    )}
                    {isExpanded ? (
                      <ChevronUp className="w-5 h-5 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-muted-foreground" />
                    )}
                  </div>
                </div>

                {/* Expanded User Details */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="border-t border-border"
                    >
                      <div className="p-4 space-y-4">
                        {/* User Statistics */}
                        <div>
                          <h4 className="text-sm font-medium text-foreground mb-3">Benutzer-Statistiken</h4>
                          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                            <div className="text-center p-2 rounded-lg bg-muted/50">
                              <FileText className="w-4 h-4 mx-auto text-yellow-500 mb-1" />
                              <p className="text-lg font-bold text-foreground">{stats?.notes || 0}</p>
                              <p className="text-xs text-muted-foreground">Notizen</p>
                            </div>
                            <div className="text-center p-2 rounded-lg bg-muted/50">
                              <Image className="w-4 h-4 mx-auto text-green-500 mb-1" />
                              <p className="text-lg font-bold text-foreground">{stats?.photos || 0}</p>
                              <p className="text-xs text-muted-foreground">Fotos</p>
                            </div>
                            <div className="text-center p-2 rounded-lg bg-muted/50">
                              <FolderOpen className="w-4 h-4 mx-auto text-purple-500 mb-1" />
                              <p className="text-lg font-bold text-foreground">{stats?.files || 0}</p>
                              <p className="text-xs text-muted-foreground">Dateien</p>
                            </div>
                            <div className="text-center p-2 rounded-lg bg-muted/50">
                              <Link2 className="w-4 h-4 mx-auto text-cyan-500 mb-1" />
                              <p className="text-lg font-bold text-foreground">{stats?.links || 0}</p>
                              <p className="text-xs text-muted-foreground">Links</p>
                            </div>
                            <div className="text-center p-2 rounded-lg bg-muted/50">
                              <Play className="w-4 h-4 mx-auto text-pink-500 mb-1" />
                              <p className="text-lg font-bold text-foreground">{stats?.tiktokVideos || 0}</p>
                              <p className="text-xs text-muted-foreground">TikToks</p>
                            </div>
                            <div className="text-center p-2 rounded-lg bg-muted/50">
                              <Lock className="w-4 h-4 mx-auto text-red-500 mb-1" />
                              <p className="text-lg font-bold text-foreground">{stats?.secretTexts || 0}</p>
                              <p className="text-xs text-muted-foreground">Geheime</p>
                            </div>
                          </div>
                        </div>

                        {/* User Actions */}
                        <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
                          {/* PIN Reset */}
                          {resetPinUser === user.id ? (
                            <div className="flex items-center gap-2 flex-1">
                              <input
                                type="text"
                                value={newPinValue}
                                onChange={(e) => setNewPinValue(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                placeholder="Neuer 6-stelliger PIN"
                                className="flex-1 px-3 py-1.5 rounded-lg bg-background border border-border text-foreground text-sm"
                                maxLength={6}
                                onClick={(e) => e.stopPropagation()}
                              />
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleResetPin(user.id);
                                }}
                                disabled={newPinValue.length !== 6}
                                className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm disabled:opacity-50"
                              >
                                Speichern
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setResetPinUser(null);
                                  setNewPinValue('');
                                }}
                                className="px-3 py-1.5 rounded-lg border border-border text-sm hover:bg-muted"
                              >
                                Abbrechen
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setResetPinUser(user.id);
                              }}
                              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted hover:bg-muted/80 text-sm transition-colors"
                            >
                              <Key className="w-4 h-4" />
                              PIN zurücksetzen
                            </button>
                          )}

                          {/* Show Recovery Key */}
                          {user.recovery_key && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowRecoveryKey(showRecoveryKey === user.id ? null : user.id);
                              }}
                              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted hover:bg-muted/80 text-sm transition-colors"
                            >
                              <Eye className="w-4 h-4" />
                              Recovery-Key
                            </button>
                          )}

                          {/* Make Admin */}
                          {!isCurrentUser && role !== 'admin' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMakeAdmin(user.id);
                              }}
                              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-500 text-sm transition-colors"
                            >
                              <Crown className="w-4 h-4" />
                              Zum Admin machen
                            </button>
                          )}
                        </div>

                        {/* Recovery Key Display */}
                        {showRecoveryKey === user.id && user.recovery_key && (
                          <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30">
                            <p className="text-xs text-muted-foreground mb-1">Recovery-Key:</p>
                            <p className="font-mono text-sm text-green-500 select-all">{user.recovery_key}</p>
                          </div>
                        )}

                        {/* Full User ID */}
                        <div className="text-xs text-muted-foreground">
                          <span className="font-medium">Vollständige ID:</span>{' '}
                          <span className="font-mono select-all">{user.id}</span>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}

          {users.length === 0 && !isLoading && (
            <div className="text-center py-8 text-muted-foreground">
              Keine Benutzer gefunden
            </div>
          )}
        </div>
      </div>

      {/* Security Notice */}
      <div className="glass-card p-4 border-yellow-500/30 bg-yellow-500/5">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-foreground">Sicherheitshinweis</p>
            <p className="text-sm text-muted-foreground">
              Als Admin hast du Zugriff auf alle Systemdaten. Gehe verantwortungsvoll mit diesen Berechtigungen um.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
