import React from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
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
  Link2
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  onSearchOpen?: () => void;
}

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
  { icon: FileText, label: 'Notizen', path: '/notes' },
  { icon: Image, label: 'Fotos', path: '/photos' },
  { icon: FolderOpen, label: 'Dateien', path: '/files' },
  { icon: Link2, label: 'Links', path: '/links' },
  { icon: Tag, label: 'Tags', path: '/tags' },
  { icon: Lock, label: 'Geheimer Safe', path: '/secret-texts' },
  { icon: Shield, label: 'Sicherheit', path: '/security-logs' },
  { icon: Trash2, label: 'Papierkorb', path: '/trash' },
  { icon: Settings, label: 'Einstellungen', path: '/settings' },
];

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onToggle, onSearchOpen }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, isDecoyMode } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  // In decoy mode, hide sensitive items
  const visibleItems = isDecoyMode 
    ? navItems.filter(item => !['Geheimer Safe', 'Sicherheit'].includes(item.label))
    : navItems;

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={onToggle}
        />
      )}

      {/* Mobile menu button */}
      <button
        onClick={onToggle}
        className="fixed top-4 left-4 z-50 lg:hidden p-3 glass-card rounded-xl"
      >
        {isOpen ? (
          <X className="w-5 h-5 text-white" />
        ) : (
          <Menu className="w-5 h-5 text-white" />
        )}
      </button>

      {/* Sidebar */}
      <motion.aside
        initial={{ x: -280 }}
        animate={{ x: isOpen ? 0 : -280 }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className={cn(
          "fixed left-0 top-0 h-full w-[280px] z-50",
          "vault-sidebar flex flex-col",
          "lg:translate-x-0 lg:static"
        )}
      >
        {/* Logo */}
        <div className="p-6 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center neon-glow-sm",
              isDecoyMode ? "bg-gray-600" : "bg-gradient-primary"
            )}>
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">
                {isDecoyMode ? 'Vault' : 'Private Vault'}
              </h1>
              <p className="text-xs text-white/50">
                {isDecoyMode ? 'Sicher' : 'Sicher & Verschlüsselt'}
              </p>
            </div>
          </div>
        </div>

        {/* Search Button */}
        {onSearchOpen && (
          <div className="px-4 pt-4">
            <button
              onClick={onSearchOpen}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white/50 transition-colors"
            >
              <Search className="w-4 h-4" />
              <span className="text-sm">Suche...</span>
              <kbd className="ml-auto text-xs bg-white/10 px-2 py-0.5 rounded">⌘K</kbd>
            </button>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {visibleItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => window.innerWidth < 1024 && onToggle()}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200",
                  "group relative overflow-hidden",
                  isActive
                    ? "bg-gradient-primary text-white neon-glow-sm"
                    : "text-white/70 hover:text-white hover:bg-white/5"
                )}
              >
                <item.icon className={cn(
                  "w-5 h-5 transition-transform duration-200",
                  "group-hover:scale-110"
                )} />
                <span className="font-medium">{item.label}</span>
                
                {isActive && (
                  <motion.div
                    layoutId="sidebar-active"
                    className="absolute inset-0 bg-gradient-primary rounded-xl -z-10"
                    transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                  />
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Decoy Mode Indicator */}
        {isDecoyMode && (
          <div className="mx-4 mb-2 p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
            <p className="text-yellow-400 text-xs text-center">Eingeschränkter Modus</p>
          </div>
        )}

        {/* Logout */}
        <div className="p-4 border-t border-white/5">
          <button
            onClick={handleLogout}
            className={cn(
              "flex items-center gap-3 px-4 py-3 w-full rounded-xl",
              "text-white/70 hover:text-red-400 hover:bg-red-500/10",
              "transition-all duration-200 group"
            )}
          >
            <LogOut className="w-5 h-5 transition-transform duration-200 group-hover:scale-110" />
            <span className="font-medium">Abmelden</span>
          </button>
        </div>
      </motion.aside>
    </>
  );
};