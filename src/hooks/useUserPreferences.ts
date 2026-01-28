import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface UserPreferences {
  id: string;
  user_id: string;
  font_family: string;
  font_size: string;
  density: 'compact' | 'normal' | 'comfortable';
  icon_pack: string;
  custom_css: string | null;
  dashboard_layout: Record<string, any>;
  sync_settings: Record<string, any>;
  haptics_enabled: boolean;
  screenshot_protection: boolean;
  created_at: string;
  updated_at: string;
}

const DEFAULT_PREFERENCES: Partial<UserPreferences> = {
  font_family: 'system',
  font_size: 'normal',
  density: 'normal',
  icon_pack: 'lucide',
  custom_css: null,
  dashboard_layout: {},
  sync_settings: {},
  haptics_enabled: true,
  screenshot_protection: false,
};

export function useUserPreferences() {
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { userId, supabaseClient: supabase } = useAuth();

  const fetchPreferences = useCallback(async () => {
    if (!userId) return;

    try {
      const { data, error } = await supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setPreferences(data as UserPreferences);
      } else {
        // Create default preferences
        const { data: newPrefs, error: createError } = await supabase
          .from('user_preferences')
          .insert({
            user_id: userId,
            ...DEFAULT_PREFERENCES,
          })
          .select()
          .single();

        if (createError) throw createError;
        setPreferences(newPrefs as UserPreferences);
      }
    } catch (error) {
      console.error('Error fetching preferences:', error);
    } finally {
      setIsLoading(false);
    }
  }, [userId, supabase]);

  useEffect(() => {
    fetchPreferences();
  }, [fetchPreferences]);

  // Apply preferences to document
  useEffect(() => {
    if (!preferences) return;

    const root = document.documentElement;

    // Font size
    const fontSizes: Record<string, string> = {
      small: '14px',
      normal: '16px',
      large: '18px',
      xlarge: '20px',
    };
    root.style.setProperty('--base-font-size', fontSizes[preferences.font_size] || '16px');

    // Density
    const densities: Record<string, { spacing: string; padding: string }> = {
      compact: { spacing: '0.5rem', padding: '0.5rem' },
      normal: { spacing: '1rem', padding: '1rem' },
      comfortable: { spacing: '1.5rem', padding: '1.25rem' },
    };
    const density = densities[preferences.density] || densities.normal;
    root.style.setProperty('--content-spacing', density.spacing);
    root.style.setProperty('--content-padding', density.padding);

    // Custom CSS
    let styleElement = document.getElementById('user-custom-css');
    if (preferences.custom_css) {
      if (!styleElement) {
        styleElement = document.createElement('style');
        styleElement.id = 'user-custom-css';
        document.head.appendChild(styleElement);
      }
      styleElement.textContent = preferences.custom_css;
    } else if (styleElement) {
      styleElement.remove();
    }

    // Screenshot protection
    if (preferences.screenshot_protection) {
      root.style.setProperty('-webkit-user-select', 'none');
      root.style.setProperty('user-select', 'none');
    } else {
      root.style.removeProperty('-webkit-user-select');
      root.style.removeProperty('user-select');
    }
  }, [preferences]);

  const updatePreferences = useCallback(async (updates: Partial<UserPreferences>) => {
    if (!preferences) return;

    try {
      const { error } = await supabase
        .from('user_preferences')
        .update(updates)
        .eq('id', preferences.id);

      if (error) throw error;

      setPreferences(prev => prev ? { ...prev, ...updates } : null);
      toast.success('Einstellungen gespeichert');
    } catch (error) {
      console.error('Error updating preferences:', error);
      toast.error('Fehler beim Speichern');
    }
  }, [preferences, supabase]);

  return {
    preferences,
    isLoading,
    updatePreferences,
    refetch: fetchPreferences,
  };
}

export default useUserPreferences;
