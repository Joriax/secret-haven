import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, Image, FolderOpen, Lock, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface CreateNewDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

const createOptions = [
  {
    id: 'note',
    icon: FileText,
    title: 'Neue Notiz',
    description: 'Erstelle eine neue Textnotiz',
    path: '/notes',
    action: 'create-note',
    gradient: 'from-purple-500 to-purple-700',
    bgClass: 'bg-purple-500/20',
    iconClass: 'text-purple-400',
  },
  {
    id: 'photo',
    icon: Image,
    title: 'Foto hochladen',
    description: 'Lade Fotos oder Videos hoch',
    path: '/photos',
    action: 'upload-photo',
    gradient: 'from-pink-500 to-rose-700',
    bgClass: 'bg-pink-500/20',
    iconClass: 'text-pink-400',
  },
  {
    id: 'file',
    icon: FolderOpen,
    title: 'Datei hochladen',
    description: 'Lade beliebige Dateien hoch',
    path: '/files',
    action: 'upload-file',
    gradient: 'from-blue-500 to-indigo-700',
    bgClass: 'bg-blue-500/20',
    iconClass: 'text-blue-400',
  },
  {
    id: 'secret',
    icon: Lock,
    title: 'Geheimer Text',
    description: 'Verschlüsselter sicherer Text',
    path: '/secret-texts',
    action: 'create-secret',
    gradient: 'from-amber-500 to-orange-700',
    bgClass: 'bg-amber-500/20',
    iconClass: 'text-amber-400',
  },
];

export const CreateNewDialog: React.FC<CreateNewDialogProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();

  const handleOptionClick = (option: typeof createOptions[0]) => {
    onClose();
    navigate(option.path, { state: { action: option.action } });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="glass-card p-6 w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-foreground">Was möchtest du erstellen?</h2>
              <button
                onClick={onClose}
                className="p-2 hover:bg-muted rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {createOptions.map((option) => (
                <motion.button
                  key={option.id}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleOptionClick(option)}
                  className="glass-card-hover p-4 flex flex-col items-center gap-3 text-center"
                >
                  <div className={`w-12 h-12 rounded-xl ${option.bgClass} flex items-center justify-center`}>
                    <option.icon className={`w-6 h-6 ${option.iconClass}`} />
                  </div>
                  <div>
                    <h3 className="font-medium text-foreground text-sm">{option.title}</h3>
                    <p className="text-xs text-muted-foreground mt-1">{option.description}</p>
                  </div>
                </motion.button>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
