import React from 'react';
import { motion } from 'framer-motion';
import { ChevronRight, ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BreadcrumbItem {
  id: string;
  name: string;
}

interface AppleStyleHeaderProps {
  title: string;
  subtitle?: string;
  breadcrumb?: BreadcrumbItem[];
  rootLabel?: string;
  onBreadcrumbClick?: (item: BreadcrumbItem | null) => void;
  showBackButton?: boolean;
  onBack?: () => void;
  actions?: React.ReactNode;
}

export function AppleStyleHeader({
  title,
  subtitle,
  breadcrumb = [],
  rootLabel = 'Home',
  onBreadcrumbClick,
  showBackButton,
  onBack,
  actions,
}: AppleStyleHeaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col gap-4"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          {/* Breadcrumb Navigation */}
          {breadcrumb.length > 0 && onBreadcrumbClick && (
            <nav className="flex items-center gap-1.5 flex-wrap mb-1">
              <button
                onClick={() => onBreadcrumbClick(null)}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {rootLabel}
              </button>
              {breadcrumb.map((item, index) => (
                <React.Fragment key={item.id}>
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                  <button
                    onClick={() => onBreadcrumbClick(item)}
                    className={cn(
                      "text-sm transition-colors truncate max-w-[150px]",
                      index === breadcrumb.length - 1
                        ? "text-foreground font-medium"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {item.name}
                  </button>
                </React.Fragment>
              ))}
            </nav>
          )}

          {/* Title */}
          <h1 className="text-2xl md:text-3xl font-bold text-foreground truncate">
            {title}
          </h1>

          {/* Subtitle */}
          {subtitle && (
            <p className="text-muted-foreground text-sm mt-0.5">
              {subtitle}
            </p>
          )}
        </div>

        {/* Actions */}
        {(showBackButton || actions) && (
          <div className="flex items-center gap-2 flex-wrap">
            {/* Back button - always first */}
            {showBackButton && onBack && (
              <button
                onClick={onBack}
                className="flex items-center justify-center gap-2 h-9 px-3 rounded-lg bg-muted hover:bg-muted/80 transition-all text-sm font-medium order-first"
              >
                <ChevronLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Zurück</span>
              </button>
            )}
            {actions}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// Unified button component for header actions
interface HeaderButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: React.ReactNode;
  label?: string;
  variant?: 'default' | 'primary' | 'ghost';
  active?: boolean;
}

export function HeaderButton({
  icon,
  label,
  variant = 'default',
  active,
  className,
  ...props
}: HeaderButtonProps) {
  return (
    <button
      {...props}
      className={cn(
        "flex items-center justify-center gap-2 h-9 px-3 rounded-lg transition-all text-sm font-medium",
        variant === 'primary' && "bg-primary text-primary-foreground hover:bg-primary/90",
        variant === 'ghost' && "hover:bg-muted",
        variant === 'default' && !active && "border border-border hover:bg-muted",
        variant === 'default' && active && "bg-primary text-primary-foreground border-primary",
        className
      )}
    >
      {icon}
      {label && <span className="hidden sm:inline">{label}</span>}
    </button>
  );
}

// Toggle button group for view modes
interface ToggleButtonGroupProps {
  options: { id: string; icon: React.ReactNode; label?: string }[];
  value: string;
  onChange: (value: string) => void;
}

export function ToggleButtonGroup({ options, value, onChange }: ToggleButtonGroupProps) {
  return (
    <div className="flex items-center h-9 border border-border rounded-lg overflow-hidden">
      {options.map((option) => (
        <button
          key={option.id}
          onClick={() => onChange(option.id)}
          className={cn(
            "h-full px-3 transition-colors flex items-center justify-center gap-1.5",
            value === option.id
              ? "bg-primary text-primary-foreground"
              : "hover:bg-muted"
          )}
          title={option.label}
        >
          {option.icon}
        </button>
      ))}
    </div>
  );
}
