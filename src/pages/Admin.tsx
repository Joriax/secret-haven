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
  Eye,
  Trash2,
  Loader2,
  Copy,
  Check,
  UserX,
  Settings,
  Calendar,
  Hash
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRoles } from '@/hooks/useUserRoles';
import { PageHeader } from '@/components/PageHeader';
import { DeleteConfirmDialog } from '@/components/DeleteConfirmDialog';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Navigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

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
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [resetPinUser, setResetPinUser] = useState<string | null>(null);
  const [newPinValue, setNewPinValue] = useState('');
  const [isResettingPin, setIsResettingPin] = useState(false);
  const [showRecoveryKey, setShowRecoveryKey] = useState<string | null>(null);
  const [copiedRecoveryKey, setCopiedRecoveryKey] = useState<string | null>(null);
  const [deleteUserTarget, setDeleteUserTarget] = useState<VaultUser | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const { userId } = useAuth();
  const { isAdmin, isLoading: rolesLoading, assignRole, removeRole, roles, fetchRoles } = useUserRoles();

  const fetchData = useCallback(async () => {
    if (!userId) return;

    try {
      setIsLoading(true);

      // Fetch all users
      const { data: usersData, error: usersError } = await supabase
        .from('vault_users')
        .select('id, created_at, recovery_key, admin_notes')
        .order('created_at', { ascending: false });

      if (usersError) throw usersError;
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
      toast.error('Fehler beim Laden der Daten');
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

    setIsCreatingUser(true);
    try {
      const { data, error } = await supabase.functions.invoke('verify-pin', {
        body: { action: 'create-user', pin: newUserPin }
      });

      if (error) throw error;

      if (data?.success) {
        toast.success(
          <div>
            <p className="font-medium">Benutzer erstellt!</p>
            <p className="text-xs mt-1 font-mono">Recovery-Key: {data.recoveryKey}</p>
          </div>,
          { duration: 10000 }
        );
        setNewUserPin('');
        setShowAddUser(false);
        fetchData();
      } else {
        throw new Error(data?.error || 'Fehler beim Erstellen');
      }
    } catch (error: any) {
      console.error('Error creating user:', error);
      toast.error(error.message || 'Fehler beim Erstellen');
    } finally {
      setIsCreatingUser(false);
    }
  };

  const handleResetPin = async (targetUserId: string) => {
    if (!newPinValue || newPinValue.length !== 6) {
      toast.error('PIN muss 6 Ziffern haben');
      return;
    }

    setIsResettingPin(true);
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
    } finally {
      setIsResettingPin(false);
    }
  };

  const handleMakeAdmin = async (targetUserId: string) => {
    if (!userId) return;

    try {
      const { data, error } = await supabase.functions.invoke('verify-pin', {
        body: {
          action: 'admin-assign-role',
          targetUserId,
          adminUserId: userId,
          role: 'admin',
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Fehler beim Zuweisen der Rolle');

      toast.success('Admin-Rolle zugewiesen');
      await fetchRoles();
      fetchData();
    } catch (err: any) {
      console.error('Error assigning role:', err);
      toast.error(err?.message || 'Fehler beim Zuweisen der Rolle');
    }
  };

  const handleRemoveAdmin = async (targetUserId: string) => {
    if (!userId) return;

    try {
      const { data, error } = await supabase.functions.invoke('verify-pin', {
        body: {
          action: 'admin-remove-role',
          targetUserId,
          adminUserId: userId,
          role: 'admin',
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Fehler beim Entfernen der Rolle');

      toast.success('Admin-Rolle entfernt');
      await fetchRoles();
      fetchData();
    } catch (err: any) {
      console.error('Error removing role:', err);
      toast.error(err?.message || 'Fehler beim Entfernen der Rolle');
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

  const handleDeleteUser = async () => {
    if (!deleteUserTarget || !userId) return;

    setIsDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke('verify-pin', {
        body: { 
          action: 'admin-delete-user', 
          targetUserId: deleteUserTarget.id,
          adminUserId: userId
        }
      });

      if (error) throw error;

      if (data?.success) {
        toast.success('Benutzer und alle Daten wurden gelöscht');
        setDeleteUserTarget(null);
        fetchData();
      } else {
        throw new Error(data?.error || 'Fehler beim Löschen');
      }
    } catch (error: any) {
      console.error('Error deleting user:', error);
      toast.error(error.message || 'Fehler beim Löschen');
    } finally {
      setIsDeleting(false);
    }
  };

  const copyRecoveryKey = (key: string, id: string) => {
    navigator.clipboard.writeText(key);
    setCopiedRecoveryKey(id);
    toast.success('Recovery-Key kopiert');
    setTimeout(() => setCopiedRecoveryKey(null), 2000);
  };

  if (rolesLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  const statCards = [
    { label: 'Benutzer', value: dataCounts.users, icon: Users, color: 'text-blue-500', bgColor: 'bg-blue-500/10' },
    { label: 'Notizen', value: dataCounts.notes, icon: FileText, color: 'text-yellow-500', bgColor: 'bg-yellow-500/10' },
    { label: 'Fotos', value: dataCounts.photos, icon: Image, color: 'text-green-500', bgColor: 'bg-green-500/10' },
    { label: 'Dateien', value: dataCounts.files, icon: FolderOpen, color: 'text-purple-500', bgColor: 'bg-purple-500/10' },
    { label: 'Links', value: dataCounts.links, icon: Link2, color: 'text-cyan-500', bgColor: 'bg-cyan-500/10' },
    { label: 'TikToks', value: dataCounts.tiktokVideos, icon: Play, color: 'text-pink-500', bgColor: 'bg-pink-500/10' },
    { label: 'Geheime Texte', value: dataCounts.secretTexts, icon: Lock, color: 'text-red-500', bgColor: 'bg-red-500/10' },
    { label: 'Alben', value: dataCounts.albums + dataCounts.fileAlbums, icon: Database, color: 'text-orange-500', bgColor: 'bg-orange-500/10' },
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
            disabled={isLoading}
          >
            <RefreshCw className={cn("w-5 h-5 text-muted-foreground", isLoading && "animate-spin")} />
          </button>
        }
      />

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <Database className="w-4 h-4" />
            Übersicht
          </TabsTrigger>
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Benutzer ({dataCounts.users})
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Stats Overview */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {statCards.map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="glass-card p-4 hover:border-primary/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={cn("p-2.5 rounded-xl", stat.bgColor)}>
                    <stat.icon className={cn("w-5 h-5", stat.color)} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Quick Stats Summary */}
          <div className="glass-card p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <Hash className="w-5 h-5 text-primary" />
              Zusammenfassung
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-muted/50">
                <p className="text-3xl font-bold text-foreground">
                  {dataCounts.notes + dataCounts.photos + dataCounts.files + dataCounts.links + dataCounts.tiktokVideos + dataCounts.secretTexts}
                </p>
                <p className="text-sm text-muted-foreground">Gesamt Elemente</p>
              </div>
              <div className="p-4 rounded-xl bg-muted/50">
                <p className="text-3xl font-bold text-foreground">{dataCounts.albums + dataCounts.fileAlbums}</p>
                <p className="text-sm text-muted-foreground">Ordner/Alben</p>
              </div>
              <div className="p-4 rounded-xl bg-muted/50">
                <p className="text-3xl font-bold text-foreground">
                  {dataCounts.users > 0 ? Math.round((dataCounts.notes + dataCounts.photos + dataCounts.files + dataCounts.links + dataCounts.tiktokVideos + dataCounts.secretTexts) / dataCounts.users) : 0}
                </p>
                <p className="text-sm text-muted-foreground">Ø pro Benutzer</p>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Users Tab */}
        <TabsContent value="users" className="space-y-6">
          {/* Add User Section */}
          <div className="glass-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-primary" />
                Neuen Benutzer erstellen
              </h3>
              <button
                onClick={() => setShowAddUser(!showAddUser)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-xl transition-colors",
                  showAddUser 
                    ? "bg-muted text-foreground" 
                    : "bg-primary text-primary-foreground hover:bg-primary/90"
                )}
              >
                {showAddUser ? (
                  <>Abbrechen</>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" />
                    Hinzufügen
                  </>
                )}
              </button>
            </div>

            <AnimatePresence>
              {showAddUser && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-4"
                >
                  <div className="p-4 rounded-xl bg-muted/50 border border-border">
                    <label className="block text-sm font-medium text-foreground mb-2">
                      6-stelliger PIN für den neuen Benutzer
                    </label>
                    <div className="flex gap-3">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={newUserPin}
                        onChange={(e) => setNewUserPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="000000"
                        className="flex-1 px-4 py-3 rounded-xl bg-background border border-border text-foreground text-center text-xl tracking-[0.5em] font-mono"
                        maxLength={6}
                      />
                      <button
                        onClick={handleCreateUser}
                        disabled={newUserPin.length !== 6 || isCreatingUser}
                        className="px-6 py-3 rounded-xl bg-primary text-primary-foreground disabled:opacity-50 flex items-center gap-2"
                      >
                        {isCreatingUser ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <UserPlus className="w-4 h-4" />
                        )}
                        Erstellen
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-3">
                      ⚠️ Der PIN darf nicht bereits von einem anderen Benutzer oder als Fake-Vault PIN verwendet werden.
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Users List */}
          <div className="glass-card p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              Alle Benutzer ({users.length})
            </h3>

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
                      "rounded-xl border overflow-hidden transition-colors",
                      isCurrentUser 
                        ? "border-primary/50 bg-primary/5" 
                        : "border-border hover:border-border/80"
                    )}
                  >
                    {/* User Header */}
                    <div 
                      className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/30 transition-colors"
                      onClick={() => setExpandedUser(isExpanded ? null : user.id)}
                    >
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "w-12 h-12 rounded-xl flex items-center justify-center",
                          role === 'admin' ? "bg-yellow-500/20" : "bg-muted"
                        )}>
                          {role === 'admin' ? (
                            <Crown className="w-6 h-6 text-yellow-500" />
                          ) : (
                            <Users className="w-6 h-6 text-muted-foreground" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium text-foreground font-mono">
                              {user.id.slice(0, 8)}...
                            </p>
                            {isCurrentUser && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-primary text-primary-foreground font-medium">
                                Du
                              </span>
                            )}
                            {role === 'admin' && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-500 font-medium">
                                Admin
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {new Date(user.created_at).toLocaleDateString('de-DE')}
                            </span>
                            <span className="flex items-center gap-1 text-primary">
                              <Database className="w-3 h-3" />
                              {totalItems} Elemente
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {user.recovery_key && (
                          <span className="text-xs px-2 py-1 rounded-full bg-green-500/10 text-green-500 border border-green-500/20">
                            <Key className="w-3 h-3 inline mr-1" />
                            Recovery
                          </span>
                        )}
                        <div className={cn(
                          "p-2 rounded-lg transition-colors",
                          isExpanded ? "bg-primary/10" : "bg-transparent"
                        )}>
                          {isExpanded ? (
                            <ChevronUp className="w-5 h-5 text-primary" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-muted-foreground" />
                          )}
                        </div>
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
                          <div className="p-4 space-y-5">
                            {/* User Statistics */}
                            <div>
                              <h4 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
                                <Database className="w-4 h-4 text-primary" />
                                Statistiken
                              </h4>
                              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                                {[
                                  { icon: FileText, value: stats?.notes || 0, label: 'Notizen', color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
                                  { icon: Image, value: stats?.photos || 0, label: 'Fotos', color: 'text-green-500', bg: 'bg-green-500/10' },
                                  { icon: FolderOpen, value: stats?.files || 0, label: 'Dateien', color: 'text-purple-500', bg: 'bg-purple-500/10' },
                                  { icon: Link2, value: stats?.links || 0, label: 'Links', color: 'text-cyan-500', bg: 'bg-cyan-500/10' },
                                  { icon: Play, value: stats?.tiktokVideos || 0, label: 'TikToks', color: 'text-pink-500', bg: 'bg-pink-500/10' },
                                  { icon: Lock, value: stats?.secretTexts || 0, label: 'Geheime', color: 'text-red-500', bg: 'bg-red-500/10' },
                                ].map((item) => (
                                  <div key={item.label} className={cn("text-center p-3 rounded-xl", item.bg)}>
                                    <item.icon className={cn("w-4 h-4 mx-auto mb-1", item.color)} />
                                    <p className="text-lg font-bold text-foreground">{item.value}</p>
                                    <p className="text-xs text-muted-foreground">{item.label}</p>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Actions Section */}
                            <div>
                              <h4 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
                                <Settings className="w-4 h-4 text-primary" />
                                Aktionen
                              </h4>
                              
                              <div className="space-y-3">
                                {/* PIN Reset */}
                                <div className="p-3 rounded-xl bg-muted/30 border border-border">
                                  <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm font-medium text-foreground flex items-center gap-2">
                                      <Key className="w-4 h-4" />
                                      PIN zurücksetzen
                                    </span>
                                  </div>
                                  
                                  {resetPinUser === user.id ? (
                                    <div className="flex items-center gap-2">
                                      <input
                                        type="text"
                                        inputMode="numeric"
                                        value={newPinValue}
                                        onChange={(e) => setNewPinValue(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                        placeholder="Neuer PIN"
                                        className="flex-1 px-3 py-2 rounded-lg bg-background border border-border text-foreground text-center font-mono tracking-wider"
                                        maxLength={6}
                                        onClick={(e) => e.stopPropagation()}
                                      />
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleResetPin(user.id);
                                        }}
                                        disabled={newPinValue.length !== 6 || isResettingPin}
                                        className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm disabled:opacity-50 flex items-center gap-1"
                                      >
                                        {isResettingPin ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setResetPinUser(null);
                                          setNewPinValue('');
                                        }}
                                        className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted"
                                      >
                                        ✕
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setResetPinUser(user.id);
                                      }}
                                      className="w-full px-4 py-2 rounded-lg bg-muted hover:bg-muted/80 text-sm transition-colors text-left"
                                    >
                                      Neuen PIN vergeben...
                                    </button>
                                  )}
                                </div>

                                {/* Recovery Key */}
                                {user.recovery_key && (
                                  <div className="p-3 rounded-xl bg-green-500/5 border border-green-500/20">
                                    <div className="flex items-center justify-between mb-2">
                                      <span className="text-sm font-medium text-foreground flex items-center gap-2">
                                        <Key className="w-4 h-4 text-green-500" />
                                        Recovery-Key
                                      </span>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setShowRecoveryKey(showRecoveryKey === user.id ? null : user.id);
                                        }}
                                        className="text-xs px-2 py-1 rounded bg-green-500/10 text-green-500 hover:bg-green-500/20 transition-colors"
                                      >
                                        {showRecoveryKey === user.id ? 'Verbergen' : 'Anzeigen'}
                                      </button>
                                    </div>
                                    
                                    {showRecoveryKey === user.id && (
                                      <div className="flex items-center gap-2 mt-2">
                                        <code className="flex-1 px-3 py-2 rounded-lg bg-background border border-green-500/30 text-green-500 font-mono text-sm select-all">
                                          {user.recovery_key}
                                        </code>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            copyRecoveryKey(user.recovery_key!, user.id);
                                          }}
                                          className="p-2 rounded-lg bg-green-500/10 text-green-500 hover:bg-green-500/20 transition-colors"
                                        >
                                          {copiedRecoveryKey === user.id ? (
                                            <Check className="w-4 h-4" />
                                          ) : (
                                            <Copy className="w-4 h-4" />
                                          )}
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                )}

                                {/* Role Management */}
                                {!isCurrentUser && (
                                  <div className="p-3 rounded-xl bg-yellow-500/5 border border-yellow-500/20">
                                    <div className="flex items-center justify-between">
                                      <span className="text-sm font-medium text-foreground flex items-center gap-2">
                                        <Crown className="w-4 h-4 text-yellow-500" />
                                        Admin-Rolle
                                      </span>
                                      {role === 'admin' ? (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleRemoveAdmin(user.id);
                                          }}
                                          className="text-xs px-3 py-1.5 rounded-lg bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20 transition-colors"
                                        >
                                          Admin-Rolle entfernen
                                        </button>
                                      ) : (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleMakeAdmin(user.id);
                                          }}
                                          className="text-xs px-3 py-1.5 rounded-lg bg-yellow-500 text-yellow-950 hover:bg-yellow-400 transition-colors"
                                        >
                                          Zum Admin machen
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                )}

                                {/* Delete User */}
                                {!isCurrentUser && (
                                  <div className="p-3 rounded-xl bg-destructive/5 border border-destructive/20">
                                    <div className="flex items-center justify-between">
                                      <div>
                                        <span className="text-sm font-medium text-foreground flex items-center gap-2">
                                          <UserX className="w-4 h-4 text-destructive" />
                                          Benutzer löschen
                                        </span>
                                        <p className="text-xs text-muted-foreground mt-1">
                                          Löscht den Benutzer und alle zugehörigen Daten unwiderruflich.
                                        </p>
                                      </div>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setDeleteUserTarget(user);
                                        }}
                                        className="text-xs px-3 py-1.5 rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors flex items-center gap-1"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                        Löschen
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Full User ID */}
                            <div className="pt-3 border-t border-border">
                              <p className="text-xs text-muted-foreground">
                                <span className="font-medium">Vollständige ID:</span>{' '}
                                <code className="font-mono select-all bg-muted px-2 py-0.5 rounded">{user.id}</code>
                              </p>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}

              {users.length === 0 && !isLoading && (
                <div className="text-center py-12 text-muted-foreground">
                  <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>Keine Benutzer gefunden</p>
                </div>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Security Notice */}
      <div className="glass-card p-4 border-yellow-500/30 bg-yellow-500/5">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-foreground">Sicherheitshinweis</p>
            <p className="text-sm text-muted-foreground">
              Als Admin hast du Zugriff auf alle Systemdaten. Gehe verantwortungsvoll mit diesen Berechtigungen um.
              Alle Admin-Aktionen werden protokolliert.
            </p>
          </div>
        </div>
      </div>

      {/* Delete User Confirmation Dialog */}
      {deleteUserTarget && (
        <DeleteConfirmDialog
          isOpen={!!deleteUserTarget}
          onClose={() => setDeleteUserTarget(null)}
          onConfirm={handleDeleteUser}
          title="Benutzer löschen"
          description={`Bist du sicher, dass du den Benutzer ${deleteUserTarget.id.slice(0, 8)}... und ALLE zugehörigen Daten (Notizen, Fotos, Dateien, Links, TikToks, Geheime Texte, Ordner, Alben, Tags) endgültig löschen möchtest? Diese Aktion kann nicht rückgängig gemacht werden!`}
          isPermanent
        />
      )}
    </div>
  );
}
