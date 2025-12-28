import React from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LayoutDashboard, 
  FileText, 
  Image, 
  FolderOpen, 
  LogOut,
  Shield,
  Menu,
  X,
  Settings,
  Lock,
  Trash2,
  Search,
  Tag,
  Link2,
  Play,
  Star,
  Clock,
  Crown,
  Share2
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRoles } from '@/hooks/useUserRoles';
import { cn } from '@/lib/utils';

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  onSearchOpen?: () => void;
}

const mainNavItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
  { icon: FileText, label: 'Notizen', path: '/notes' },
  { icon: Image, label: 'Fotos', path: '/photos' },
  { icon: FolderOpen, label: 'Dateien', path: '/files' },
  { icon: Link2, label: 'Links', path: '/links' },
  { icon: Play, label: 'TikTok', path: '/tiktok' },
];

const secondaryNavItems = [
  { icon: Star, label: 'Favoriten', path: '/favorites' },
  { icon: Clock, label: 'Verlauf', path: '/recently-viewed' },
  { icon: Tag, label: 'Tags', path: '/tags' },
  { icon: Share2, label: 'Geteilte Alben', path: '/shared-albums' },
];

const securityNavItems = [
  { icon: Lock, label: 'Geheimer Safe', path: '/secret-texts' },
  { icon: Shield, label: 'Sicherheit', path: '/security-logs' },
  { icon: Trash2, label: 'Papierkorb', path: '/trash' },
];

const adminNavItems = [
  { icon: Crown, label: 'Admin', path: '/admin' },
];

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onToggle, onSearchOpen }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, isDecoyMode } = useAuth();
  const { isAdmin } = useUserRoles();

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const NavItem = ({ item, isActive }: { item: typeof mainNavItems[0], isActive: boolean }) => (
    <NavLink
      to={item.path}
      onClick={() => window.innerWidth < 1024 && onToggle()}
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group relative",
        isActive
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
      )}
    >
      {isActive && (
        <motion.div
          layoutId="nav-indicator"
          className="absolute left-0 inset-y-0 my-auto w-0.5 h-5 bg-primary rounded-full"
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        />
      )}
      <item.icon className={cn(
        "w-[18px] h-[18px] transition-colors",
        isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
      )} />
      <span className="text-sm font-medium">{item.label}</span>
    </NavLink>
  );

  const visibleSecurityItems = isDecoyMode 
    ? securityNavItems.filter(item => !['Geheimer Safe', 'Sicherheit'].includes(item.label))
    : securityNavItems;

  return (
    <>
      {/* Mobile overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 lg:hidden"
            onClick={onToggle}
          />
        )}
      </AnimatePresence>

      {/* Mobile menu button */}
      <button
        onClick={onToggle}
        className="fixed top-4 left-4 z-50 lg:hidden p-2.5 rounded-xl bg-card border border-border"
      >
        {isOpen ? (
          <X className="w-5 h-5 text-foreground" />
        ) : (
          <Menu className="w-5 h-5 text-foreground" />
        )}
      </button>

      {/* Sidebar */}
      <motion.aside
        initial={{ x: -260 }}
        animate={{ x: isOpen ? 0 : -260 }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className={cn(
          "fixed left-0 top-0 h-full w-[260px] z-50",
          "bg-sidebar border-r border-border flex flex-col",
          "lg:translate-x-0 lg:static"
        )}
      >
        {/* Logo */}
        <div className="p-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-9 h-9 rounded-xl flex items-center justify-center",
              isDecoyMode ? "bg-muted" : "bg-primary/10"
            )}>
              <Shield className={cn(
                "w-5 h-5",
                isDecoyMode ? "text-muted-foreground" : "text-primary"
              )} />
            </div>
            <div>
              <h1 className="text-base font-display font-semibold text-foreground">
                {isDecoyMode ? 'Vault' : 'Private Vault'}
              </h1>
            </div>
          </div>
        </div>

        {/* Search Button */}
        {onSearchOpen && (
          <div className="px-4 pt-4">
            <button
              onClick={onSearchOpen}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            >
              <Search className="w-4 h-4" />
              <span className="text-sm">Suchen...</span>
              <kbd className="ml-auto text-[10px] bg-background px-1.5 py-0.5 rounded border border-border font-mono">⌘K</kbd>
            </button>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-6 overflow-y-auto">
          {/* Main */}
          <div className="space-y-1">
            {mainNavItems.map((item) => (
              <NavItem 
                key={item.path} 
                item={item} 
                isActive={location.pathname === item.path} 
              />
            ))}
          </div>

          {/* Secondary */}
          <div className="space-y-1">
            <p className="px-3 text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
              Sammlungen
            </p>
            {secondaryNavItems.map((item) => (
              <NavItem 
                key={item.path} 
                item={item} 
                isActive={location.pathname === item.path} 
              />
            ))}
          </div>

          {/* Security */}
          <div className="space-y-1">
            <p className="px-3 text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
              System
            </p>
            {visibleSecurityItems.map((item) => (
              <NavItem 
                key={item.path} 
                item={item} 
                isActive={location.pathname === item.path} 
              />
            ))}
          </div>

          {/* Admin (nur für Admins sichtbar) */}
          {isAdmin && !isDecoyMode && (
            <div className="space-y-1">
              <p className="px-3 text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
                Administration
              </p>
              {adminNavItems.map((item) => (
                <NavItem 
                  key={item.path} 
                  item={item} 
                  isActive={location.pathname === item.path} 
                />
              ))}
            </div>
          )}
        </nav>

        {/* Decoy Mode Indicator */}
        {isDecoyMode && (
          <div className="mx-4 mb-2 p-2.5 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
            <p className="text-yellow-500 text-xs text-center font-medium">Eingeschränkt</p>
          </div>
        )}

        {/* Footer */}
        <div className="p-4 border-t border-border space-y-1">
          <NavLink
            to="/settings"
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200",
              location.pathname === '/settings'
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
          >
            <Settings className="w-[18px] h-[18px]" />
            <span className="text-sm font-medium">Einstellungen</span>
          </NavLink>
          
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 w-full rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all duration-200"
          >
            <LogOut className="w-[18px] h-[18px]" />
            <span className="text-sm font-medium">Abmelden</span>
          </button>
        </div>
      </motion.aside>
    </>
  );
};