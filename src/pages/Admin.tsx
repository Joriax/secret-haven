import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
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
  Trash2,
  RefreshCw,
  AlertTriangle,
  Lock,
  Database
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
        toast.success('Benutzer erstellt');
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
              Der Benutzer kann sich mit diesem PIN anmelden
            </p>
          </motion.div>
        )}

        {/* Users List */}
        <div className="space-y-3">
          {users.map((user) => {
            const role = getUserRole(user.id);
            const isCurrentUser = user.id === userId;
            
            return (
              <motion.div
                key={user.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className={cn(
                  "flex items-center justify-between p-4 rounded-xl border border-border",
                  isCurrentUser && "bg-primary/5 border-primary/30"
                )}
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
                    <p className="text-xs text-muted-foreground">
                      Erstellt: {new Date(user.created_at).toLocaleDateString('de-DE')}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {user.recovery_key && (
                    <span className="text-xs px-2 py-1 rounded bg-green-500/20 text-green-500">
                      Recovery-Key
                    </span>
                  )}
                  {!isCurrentUser && role !== 'admin' && (
                    <button
                      onClick={() => handleMakeAdmin(user.id)}
                      className="p-2 rounded-lg hover:bg-muted transition-colors"
                      title="Zum Admin machen"
                    >
                      <Crown className="w-4 h-4 text-muted-foreground hover:text-yellow-500" />
                    </button>
                  )}
                </div>
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
