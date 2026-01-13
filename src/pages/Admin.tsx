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
  Hash,
  Activity,
  Server,
  HardDrive,
  Cpu,
  Download,
  Upload,
  Zap,
  Clock,
  Globe,
  Smartphone,
  Monitor,
  XCircle,
  LogOut,
  User
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
  username: string | null;
  created_at: string;
  recovery_key: string | null;
  admin_notes: string | null;
  last_login_at: string | null;
  login_count: number | null;
  last_login_ip: string | null;
}

interface SessionHistoryItem {
  id: string;
  user_id: string;
  ip_address: string | null;
  browser: string | null;
  os: string | null;
  device_type: string | null;
  login_at: string | null;
  logout_at: string | null;
  is_active: boolean | null;
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
  activeSessions: number;
  securityLogs: number;
}

interface SystemStatus {
  databaseSize: string;
  storageUsed: string;
  activeUsers: number;
  todayLogins: number;
  failedLogins: number;
  lastBackup: string | null;
}

export default function Admin() {
  const [users, setUsers] = useState<VaultUser[]>([]);
  const [sessions, setSessions] = useState<SessionHistoryItem[]>([]);
  const [userStats, setUserStats] = useState<Record<string, UserStats>>({});
  const [dataCounts, setDataCounts] = useState<DataCounts>({
    users: 0, notes: 0, photos: 0, files: 0, links: 0,
    tiktokVideos: 0, secretTexts: 0, albums: 0, fileAlbums: 0,
    activeSessions: 0, securityLogs: 0,
  });
  const [systemStatus, setSystemStatus] = useState<SystemStatus>({
    databaseSize: '-', storageUsed: '-', activeUsers: 0,
    todayLogins: 0, failedLogins: 0, lastBackup: null,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUserPin, setNewUserPin] = useState('');
  const [newUserUsername, setNewUserUsername] = useState('');
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [resetPinUser, setResetPinUser] = useState<string | null>(null);
  const [newPinValue, setNewPinValue] = useState('');
  const [isResettingPin, setIsResettingPin] = useState(false);
  const [showRecoveryKey, setShowRecoveryKey] = useState<string | null>(null);
  const [copiedRecoveryKey, setCopiedRecoveryKey] = useState<string | null>(null);
  const [deleteUserTarget, setDeleteUserTarget] = useState<VaultUser | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [terminatingSession, setTerminatingSession] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [editingUsername, setEditingUsername] = useState<string | null>(null);
  const [newUsernameValue, setNewUsernameValue] = useState('');
  const [isUpdatingUsername, setIsUpdatingUsername] = useState(false);
  const { userId, sessionToken } = useAuth();
  const { isAdmin, isLoading: rolesLoading, roles, fetchRoles } = useUserRoles();

  const fetchData = useCallback(async () => {
    if (!userId || !sessionToken) return;

    try {
      setIsLoading(true);

      // Use edge function for all admin data - validates admin role server-side
      const { data: response, error } = await supabase.functions.invoke('vault-data', {
        body: { action: 'get-admin-stats', sessionToken }
      });

      if (error) throw error;
      if (!response?.success) throw new Error(response?.error || 'Fehler beim Laden');

      const { users, sessions, roles: fetchedRoles, userStats: stats, dataCounts: counts, systemStatus: status } = response.data;

      setUsers(users || []);
      setSessions(sessions || []);
      setUserStats(stats || {});
      setDataCounts(counts || {
        users: 0, notes: 0, photos: 0, files: 0, links: 0,
        tiktokVideos: 0, secretTexts: 0, albums: 0, fileAlbums: 0,
        activeSessions: 0, securityLogs: 0,
      });
      setSystemStatus({
        databaseSize: `${((counts?.notes || 0) + (counts?.photos || 0) + (counts?.files || 0) + (counts?.links || 0) + (counts?.tiktokVideos || 0)) * 0.5} KB`,
        storageUsed: 'Berechnung...',
        activeUsers: status?.activeUsers || 0,
        todayLogins: status?.todayLogins || 0,
        failedLogins: status?.failedLogins || 0,
        lastBackup: null,
      });

      // Update roles in the context by fetching them
      if (fetchedRoles) {
        await fetchRoles();
      }

    } catch (error: any) {
      console.error('Error fetching admin data:', error);
      toast.error(error?.message || 'Fehler beim Laden der Daten');
    } finally {
      setIsLoading(false);
    }
  }, [userId, sessionToken, fetchRoles]);

  useEffect(() => {
    if (isAdmin) { fetchData(); }
  }, [isAdmin, fetchData]);

  const handleCreateUser = async () => {
    if (!newUserUsername.trim()) {
      toast.error('Benutzername erforderlich');
      return;
    }
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(newUserUsername.trim())) {
      toast.error('Benutzername muss 3-20 Zeichen haben (nur Buchstaben, Zahlen, Unterstriche)');
      return;
    }
    if (!newUserPin || newUserPin.length !== 6) {
      toast.error('PIN muss 6 Ziffern haben');
      return;
    }

    setIsCreatingUser(true);
    try {
      const { data, error } = await supabase.functions.invoke('verify-pin', {
        body: { action: 'create-user', username: newUserUsername.trim(), pin: newUserPin, sessionToken }
      });

      if (error) throw error;
      if (data?.success) {
        toast.success(
          <div>
            <p className="font-medium">Benutzer "{data.username}" erstellt!</p>
            <p className="text-xs mt-1 font-mono">Recovery-Key: {data.recoveryKey}</p>
          </div>,
          { duration: 10000 }
        );
        setNewUserPin('');
        setNewUserUsername('');
        setShowAddUser(false);
        fetchData();
      } else {
        throw new Error(data?.error || 'Fehler beim Erstellen');
      }
    } catch (error: any) {
      toast.error(error.message || 'Fehler beim Erstellen');
    } finally {
      setIsCreatingUser(false);
    }
  };

  const handleUpdateUsername = async (targetUserId: string) => {
    if (!newUsernameValue.trim()) {
      toast.error('Benutzername erforderlich');
      return;
    }
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(newUsernameValue.trim())) {
      toast.error('Benutzername muss 3-20 Zeichen haben (nur Buchstaben, Zahlen, Unterstriche)');
      return;
    }

    setIsUpdatingUsername(true);
    try {
      const { data, error } = await supabase.functions.invoke('verify-pin', {
        body: { action: 'admin-update-username', targetUserId, newUsername: newUsernameValue.trim(), sessionToken }
      });

      if (error) throw error;
      if (data?.success) {
        toast.success(`Benutzername geändert zu "${data.username}"`);
        setEditingUsername(null);
        setNewUsernameValue('');
        fetchData();
      } else {
        throw new Error(data?.error || 'Fehler beim Ändern');
      }
    } catch (error: any) {
      toast.error(error.message || 'Fehler beim Ändern');
    } finally {
      setIsUpdatingUsername(false);
    }
  };

  const handleResetPin = async (targetUserId: string) => {
    if (!newPinValue || newPinValue.length !== 6) {
      toast.error('PIN muss 6 Ziffern haben');
      return;
    }

    setIsResettingPin(true);
    try {
      const response = await supabase.functions.invoke('verify-pin', {
        body: { action: 'admin-reset-pin', targetUserId, newPin: newPinValue, sessionToken }
      });

      const data = response.data;
      const invokeError = response.error;

      if (invokeError) {
        const errMsg = (invokeError as any)?.context?.body
          ? JSON.parse((invokeError as any).context.body)?.error
          : null;
        throw new Error(errMsg || 'Verbindungsfehler');
      }

      if (data?.success) {
        toast.success('PIN wurde zurückgesetzt');
        setResetPinUser(null);
        setNewPinValue('');
      } else {
        throw new Error(data?.error || 'Fehler beim Zurücksetzen');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Fehler beim Zurücksetzen');
    } finally {
      setIsResettingPin(false);
    }
  };

  const handleTerminateSessions = async (targetUserId: string) => {
    setTerminatingSession(targetUserId);
    try {
      const { data, error } = await supabase.functions.invoke('verify-pin', {
        body: { action: 'admin-terminate-sessions', targetUserId, sessionToken }
      });

      if (error) throw error;
      if (data?.success) {
        toast.success('Sessions wurden beendet');
        fetchData();
      } else {
        throw new Error(data?.error || 'Fehler');
      }
    } catch (error: any) {
      toast.error(error.message || 'Fehler beim Beenden');
    } finally {
      setTerminatingSession(null);
    }
  };

  const handleMakeAdmin = async (targetUserId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('verify-pin', {
        body: { action: 'admin-assign-role', targetUserId, role: 'admin', sessionToken }
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error);

      toast.success('Admin-Rolle zugewiesen');
      await fetchRoles();
      fetchData();
    } catch (err: any) {
      toast.error(err?.message || 'Fehler beim Zuweisen der Rolle');
    }
  };

  const handleRemoveAdmin = async (targetUserId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('verify-pin', {
        body: { action: 'admin-remove-role', targetUserId, role: 'admin', sessionToken }
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error);

      toast.success('Admin-Rolle entfernt');
      await fetchRoles();
      fetchData();
    } catch (err: any) {
      toast.error(err?.message || 'Fehler beim Entfernen der Rolle');
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteUserTarget) return;

    setIsDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke('verify-pin', {
        body: { action: 'admin-delete-user', targetUserId: deleteUserTarget.id, sessionToken }
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
      toast.error(error.message || 'Fehler beim Löschen');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleExportData = async () => {
    setIsExporting(true);
    try {
      // Use edge function for export - validates admin role server-side
      const { data: response, error } = await supabase.functions.invoke('vault-data', {
        body: { action: 'admin-export-data', sessionToken }
      });

      if (error) throw error;
      if (!response?.success) throw new Error(response?.error || 'Fehler beim Export');

      const exportData = response.data;

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vault-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);

      toast.success('Backup erstellt und heruntergeladen');
    } catch (error: any) {
      toast.error(error?.message || 'Fehler beim Erstellen des Backups');
    } finally {
      setIsExporting(false);
    }
  };

  const copyRecoveryKey = (key: string, id: string) => {
    navigator.clipboard.writeText(key);
    setCopiedRecoveryKey(id);
    toast.success('Recovery-Key kopiert');
    setTimeout(() => setCopiedRecoveryKey(null), 2000);
  };

  const getUserRole = (targetUserId: string) => {
    const userRole = roles.find(r => r.user_id === targetUserId);
    return userRole?.role || 'user';
  };

  const getTotalItems = (stats: UserStats | undefined) => {
    if (!stats) return 0;
    return stats.notes + stats.photos + stats.files + stats.links + stats.tiktokVideos + stats.secretTexts;
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('de-DE', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  const getDeviceIcon = (deviceType: string | null) => {
    switch (deviceType?.toLowerCase()) {
      case 'mobile': return Smartphone;
      case 'tablet': return Monitor;
      default: return Monitor;
    }
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
    { label: 'Aktive Sessions', value: dataCounts.activeSessions, icon: Activity, color: 'text-green-500', bgColor: 'bg-green-500/10' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admin-Bereich"
        subtitle="System-Übersicht, Benutzerverwaltung & Sicherheit"
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
        <TabsList className="grid w-full grid-cols-4 mb-6">
          <TabsTrigger value="overview" className="flex items-center gap-2 text-xs sm:text-sm">
            <Database className="w-4 h-4" />
            <span className="hidden sm:inline">Übersicht</span>
          </TabsTrigger>
          <TabsTrigger value="users" className="flex items-center gap-2 text-xs sm:text-sm">
            <Users className="w-4 h-4" />
            <span className="hidden sm:inline">Benutzer</span>
          </TabsTrigger>
          <TabsTrigger value="sessions" className="flex items-center gap-2 text-xs sm:text-sm">
            <Activity className="w-4 h-4" />
            <span className="hidden sm:inline">Sessions</span>
          </TabsTrigger>
          <TabsTrigger value="system" className="flex items-center gap-2 text-xs sm:text-sm">
            <Server className="w-4 h-4" />
            <span className="hidden sm:inline">System</span>
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
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

          {/* Quick Summary */}
          <div className="glass-card p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <Hash className="w-5 h-5 text-primary" />
              Zusammenfassung
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
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
                <p className="text-3xl font-bold text-foreground">{systemStatus.todayLogins}</p>
                <p className="text-sm text-muted-foreground">Logins heute</p>
              </div>
              <div className="p-4 rounded-xl bg-muted/50">
                <p className="text-3xl font-bold text-red-400">{systemStatus.failedLogins}</p>
                <p className="text-sm text-muted-foreground">Fehlversuche heute</p>
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
                  showAddUser ? "bg-muted text-foreground" : "bg-primary text-primary-foreground hover:bg-primary/90"
                )}
              >
                {showAddUser ? 'Abbrechen' : <><UserPlus className="w-4 h-4" />Hinzufügen</>}
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
                  <div className="p-4 rounded-xl bg-muted/50 border border-border space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Benutzername (einzigartig, 3-20 Zeichen)
                      </label>
                      <input
                        type="text"
                        value={newUserUsername}
                        onChange={(e) => setNewUserUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 20))}
                        placeholder="benutzername"
                        className="w-full px-4 py-3 rounded-xl bg-background border border-border text-foreground"
                        maxLength={20}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        6-stelliger PIN
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={newUserPin}
                        onChange={(e) => setNewUserPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="000000"
                        className="w-full px-4 py-3 rounded-xl bg-background border border-border text-foreground text-center text-xl tracking-[0.5em] font-mono"
                        maxLength={6}
                      />
                    </div>
                    <button
                      onClick={handleCreateUser}
                      disabled={newUserUsername.length < 3 || newUserPin.length !== 6 || isCreatingUser}
                      className="w-full px-6 py-3 rounded-xl bg-primary text-primary-foreground disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {isCreatingUser ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                      Benutzer erstellen
                    </button>
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
                const userSessions = sessions.filter(s => s.user_id === user.id && s.is_active);
                
                return (
                  <motion.div
                    key={user.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className={cn(
                      "rounded-xl border overflow-hidden transition-colors",
                      isCurrentUser ? "border-primary/50 bg-primary/5" : "border-border hover:border-border/80"
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
                          {role === 'admin' ? <Crown className="w-6 h-6 text-yellow-500" /> : <Users className="w-6 h-6 text-muted-foreground" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium text-foreground">
                              {user.username ? (
                                <span className="text-primary">@{user.username}</span>
                              ) : (
                                <span className="text-muted-foreground italic">Kein Benutzername</span>
                              )}
                            </p>
                            {isCurrentUser && <span className="text-xs px-2 py-0.5 rounded-full bg-primary text-primary-foreground font-medium">Du</span>}
                            {role === 'admin' && <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-500 font-medium">Admin</span>}
                            {userSessions.length > 0 && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 font-medium flex items-center gap-1">
                                <Activity className="w-3 h-3" /> {userSessions.length} aktiv
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                            <span className="font-mono">{user.id.slice(0, 8)}...</span>
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {new Date(user.created_at).toLocaleDateString('de-DE')}
                            </span>
                            <span className="flex items-center gap-1 text-primary">
                              <Database className="w-3 h-3" />
                              {totalItems} Elemente
                            </span>
                            {user.login_count && (
                              <span className="flex items-center gap-1">
                                <LogOut className="w-3 h-3" />
                                {user.login_count} Logins
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {isExpanded ? <ChevronUp className="w-5 h-5 text-primary" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
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

                            {/* Username Management */}
                            <div className="p-3 rounded-xl bg-blue-500/5 border border-blue-500/20">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium text-foreground flex items-center gap-2">
                                  <User className="w-4 h-4 text-blue-500" />
                                  Benutzername
                                </span>
                              </div>
                              
                              {editingUsername === user.id ? (
                                <div className="flex items-center gap-2">
                                  <input
                                    type="text"
                                    value={newUsernameValue}
                                    onChange={(e) => setNewUsernameValue(e.target.value.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 20))}
                                    placeholder="neuer_username"
                                    className="flex-1 px-3 py-2 rounded-lg bg-background border border-border text-foreground font-mono"
                                    maxLength={20}
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleUpdateUsername(user.id); }}
                                    disabled={newUsernameValue.length < 3 || isUpdatingUsername}
                                    className="px-4 py-2 rounded-lg bg-blue-500 text-white text-sm disabled:opacity-50"
                                  >
                                    {isUpdatingUsername ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                  </button>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setEditingUsername(null); setNewUsernameValue(''); }}
                                    className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted"
                                  >✕</button>
                                </div>
                              ) : (
                                <button
                                  onClick={(e) => { e.stopPropagation(); setEditingUsername(user.id); setNewUsernameValue(user.username || ''); }}
                                  className="w-full px-4 py-2 rounded-lg bg-muted hover:bg-muted/80 text-sm transition-colors text-left"
                                >
                                  {user.username ? `@${user.username} ändern...` : 'Benutzername vergeben...'}
                                </button>
                              )}
                            </div>

                            {/* Session Info */}
                            {user.last_login_at && (
                              <div className="p-3 rounded-xl bg-muted/30 border border-border">
                                <h4 className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                                  <Clock className="w-4 h-4 text-primary" />
                                  Letzter Login
                                </h4>
                                <div className="grid grid-cols-2 gap-3 text-sm">
                                  <div>
                                    <span className="text-muted-foreground">Zeit:</span>
                                    <span className="text-foreground ml-2">{formatDate(user.last_login_at)}</span>
                                  </div>
                                  {user.last_login_ip && (
                                    <div>
                                      <span className="text-muted-foreground">IP:</span>
                                      <span className="text-foreground ml-2 font-mono">{user.last_login_ip}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Actions */}
                            <div className="space-y-3">
                              {/* Terminate Sessions */}
                              {userSessions.length > 0 && (
                                <div className="p-3 rounded-xl bg-orange-500/5 border border-orange-500/20">
                                  <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium text-foreground flex items-center gap-2">
                                      <XCircle className="w-4 h-4 text-orange-500" />
                                      Aktive Sessions beenden ({userSessions.length})
                                    </span>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleTerminateSessions(user.id); }}
                                      disabled={terminatingSession === user.id}
                                      className="text-xs px-3 py-1.5 rounded-lg bg-orange-500/20 text-orange-500 hover:bg-orange-500/30 transition-colors disabled:opacity-50"
                                    >
                                      {terminatingSession === user.id ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Beenden'}
                                    </button>
                                  </div>
                                </div>
                              )}

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
                                      onClick={(e) => { e.stopPropagation(); handleResetPin(user.id); }}
                                      disabled={newPinValue.length !== 6 || isResettingPin}
                                      className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm disabled:opacity-50"
                                    >
                                      {isResettingPin ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                    </button>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); setResetPinUser(null); setNewPinValue(''); }}
                                      className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted"
                                    >✕</button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setResetPinUser(user.id); }}
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
                                      onClick={(e) => { e.stopPropagation(); setShowRecoveryKey(showRecoveryKey === user.id ? null : user.id); }}
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
                                        onClick={(e) => { e.stopPropagation(); copyRecoveryKey(user.recovery_key!, user.id); }}
                                        className="p-2 rounded-lg bg-green-500/10 text-green-500 hover:bg-green-500/20 transition-colors"
                                      >
                                        {copiedRecoveryKey === user.id ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
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
                                        onClick={(e) => { e.stopPropagation(); handleRemoveAdmin(user.id); }}
                                        className="text-xs px-3 py-1.5 rounded-lg bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20 transition-colors"
                                      >
                                        Admin-Rolle entfernen
                                      </button>
                                    ) : (
                                      <button
                                        onClick={(e) => { e.stopPropagation(); handleMakeAdmin(user.id); }}
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
                                      <p className="text-xs text-muted-foreground mt-1">Löscht alle Daten unwiderruflich.</p>
                                    </div>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); setDeleteUserTarget(user); }}
                                      className="text-xs px-3 py-1.5 rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors flex items-center gap-1"
                                    >
                                      <Trash2 className="w-3 h-3" /> Löschen
                                    </button>
                                  </div>
                                </div>
                              )}
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

        {/* Sessions Tab */}
        <TabsContent value="sessions" className="space-y-6">
          <div className="glass-card p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary" />
              Aktive Sessions ({sessions.filter(s => s.is_active).length})
            </h3>

            <div className="space-y-3">
              {sessions.filter(s => s.is_active).map((session) => {
                const DeviceIcon = getDeviceIcon(session.device_type);
                const user = users.find(u => u.id === session.user_id);
                
                return (
                  <div key={session.id} className="p-4 rounded-xl bg-muted/30 border border-green-500/20">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                          <DeviceIcon className="w-5 h-5 text-green-400" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">
                            {session.browser || 'Unbekannt'} • {session.os || 'Unbekannt'}
                          </p>
                          <p className="text-xs text-muted-foreground font-mono">
                            Benutzer: {session.user_id.slice(0, 8)}...
                          </p>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                            <span>IP: {session.ip_address || '-'}</span>
                            <span>Seit: {formatDate(session.login_at)}</span>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleTerminateSessions(session.user_id)}
                        disabled={terminatingSession === session.user_id}
                        className="px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 text-xs transition-colors disabled:opacity-50"
                      >
                        {terminatingSession === session.user_id ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Beenden'}
                      </button>
                    </div>
                  </div>
                );
              })}

              {sessions.filter(s => s.is_active).length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Activity className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>Keine aktiven Sessions</p>
                </div>
              )}
            </div>
          </div>

          {/* Recent Sessions */}
          <div className="glass-card p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              Session-Verlauf
            </h3>

            <div className="space-y-2">
              {sessions.slice(0, 20).map((session) => {
                const DeviceIcon = getDeviceIcon(session.device_type);
                
                return (
                  <div key={session.id} className={cn(
                    "p-3 rounded-lg flex items-center justify-between",
                    session.is_active ? "bg-green-500/10" : "bg-muted/30"
                  )}>
                    <div className="flex items-center gap-3">
                      <DeviceIcon className={cn("w-4 h-4", session.is_active ? "text-green-400" : "text-muted-foreground")} />
                      <div>
                        <p className="text-sm text-foreground">{session.browser} • {session.os}</p>
                        <p className="text-xs text-muted-foreground">{session.ip_address}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-foreground">{formatDate(session.login_at)}</p>
                      {session.is_active ? (
                        <span className="text-xs text-green-400">Aktiv</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Beendet</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </TabsContent>

        {/* System Tab */}
        <TabsContent value="system" className="space-y-6">
          {/* System Status */}
          <div className="glass-card p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <Server className="w-5 h-5 text-primary" />
              System-Status
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="w-5 h-5 text-green-500" />
                  <span className="text-sm font-medium text-foreground">Status</span>
                </div>
                <p className="text-2xl font-bold text-green-400">Online</p>
              </div>
              <div className="p-4 rounded-xl bg-muted/50">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="w-5 h-5 text-blue-500" />
                  <span className="text-sm font-medium text-foreground">Aktive Nutzer</span>
                </div>
                <p className="text-2xl font-bold text-foreground">{systemStatus.activeUsers}</p>
              </div>
              <div className="p-4 rounded-xl bg-muted/50">
                <div className="flex items-center gap-2 mb-2">
                  <Activity className="w-5 h-5 text-purple-500" />
                  <span className="text-sm font-medium text-foreground">Logins heute</span>
                </div>
                <p className="text-2xl font-bold text-foreground">{systemStatus.todayLogins}</p>
              </div>
              <div className="p-4 rounded-xl bg-muted/50">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-5 h-5 text-red-500" />
                  <span className="text-sm font-medium text-foreground">Fehlversuche</span>
                </div>
                <p className="text-2xl font-bold text-red-400">{systemStatus.failedLogins}</p>
              </div>
              <div className="p-4 rounded-xl bg-muted/50">
                <div className="flex items-center gap-2 mb-2">
                  <Database className="w-5 h-5 text-cyan-500" />
                  <span className="text-sm font-medium text-foreground">Protokolle</span>
                </div>
                <p className="text-2xl font-bold text-foreground">{dataCounts.securityLogs}</p>
              </div>
              <div className="p-4 rounded-xl bg-muted/50">
                <div className="flex items-center gap-2 mb-2">
                  <HardDrive className="w-5 h-5 text-orange-500" />
                  <span className="text-sm font-medium text-foreground">Sessions</span>
                </div>
                <p className="text-2xl font-bold text-foreground">{dataCounts.activeSessions}</p>
              </div>
            </div>
          </div>

          {/* Backup & Export */}
          <div className="glass-card p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <Download className="w-5 h-5 text-primary" />
              Backup & Export
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-muted/30 border border-border">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 rounded-lg bg-blue-500/20">
                    <Download className="w-5 h-5 text-blue-500" />
                  </div>
                  <div>
                    <h4 className="font-medium text-foreground">Daten exportieren</h4>
                    <p className="text-xs text-muted-foreground">Alle Metadaten als JSON-Datei</p>
                  </div>
                </div>
                <button
                  onClick={handleExportData}
                  disabled={isExporting}
                  className="w-full px-4 py-2 rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  {isExporting ? 'Exportiere...' : 'Backup erstellen'}
                </button>
              </div>

              <div className="p-4 rounded-xl bg-muted/30 border border-border">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 rounded-lg bg-green-500/20">
                    <HardDrive className="w-5 h-5 text-green-500" />
                  </div>
                  <div>
                    <h4 className="font-medium text-foreground">Letztes Backup</h4>
                    <p className="text-xs text-muted-foreground">
                      {systemStatus.lastBackup ? formatDate(systemStatus.lastBackup) : 'Noch kein Backup erstellt'}
                    </p>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground p-2 rounded-lg bg-muted/50">
                  Backups enthalten nur Metadaten. Dateien und Fotos müssen separat gesichert werden.
                </div>
              </div>
            </div>
          </div>

          {/* Security Notice */}
          <div className="glass-card p-4 border-yellow-500/30 bg-yellow-500/5">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-foreground">Sicherheitshinweis</p>
                <p className="text-sm text-muted-foreground">
                  Als Admin hast du Zugriff auf alle Systemdaten. Alle Aktionen werden protokolliert.
                </p>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Delete User Confirmation Dialog */}
      {deleteUserTarget && (
        <DeleteConfirmDialog
          isOpen={!!deleteUserTarget}
          onClose={() => setDeleteUserTarget(null)}
          onConfirm={handleDeleteUser}
          title="Benutzer löschen"
          description={`Bist du sicher, dass du den Benutzer ${deleteUserTarget.id.slice(0, 8)}... und ALLE zugehörigen Daten endgültig löschen möchtest?`}
          isPermanent
        />
      )}
    </div>
  );
}
