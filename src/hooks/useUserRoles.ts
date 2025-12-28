import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type AppRole = 'admin' | 'user';

interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
  created_at: string;
}

export function useUserRoles() {
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { userId } = useAuth();

  const fetchRoles = useCallback(async () => {
    if (!userId) {
      setIsLoading(false);
      return;
    }

    try {
      // Check if current user is admin
      const { data: userRoles } = await supabase
        .from('user_roles')
        .select('*')
        .eq('user_id', userId);

      const hasAdminRole = userRoles?.some(r => r.role === 'admin') || false;
      setIsAdmin(hasAdminRole);

      // If admin, fetch all roles
      if (hasAdminRole) {
        const { data: allRoles } = await supabase
          .from('user_roles')
          .select('*')
          .order('created_at', { ascending: false });
        
        setRoles(allRoles as UserRole[] || []);
      }
    } catch (error) {
      console.error('Error fetching roles:', error);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  const assignRole = async (targetUserId: string, role: AppRole) => {
    if (!isAdmin || !userId) return false;

    try {
      const { data, error } = await supabase.functions.invoke('verify-pin', {
        body: { 
          action: 'admin-assign-role', 
          targetUserId,
          adminUserId: userId,
          role
        }
      });

      if (error) throw error;
      
      if (data?.success) {
        await fetchRoles();
        return true;
      } else {
        console.error('Error assigning role:', data?.error);
        return false;
      }
    } catch (error) {
      console.error('Error assigning role:', error);
      return false;
    }
  };

  const removeRole = async (targetUserId: string, role: AppRole) => {
    if (!isAdmin || !userId) return false;

    try {
      const { data, error } = await supabase.functions.invoke('verify-pin', {
        body: { 
          action: 'admin-remove-role', 
          targetUserId,
          adminUserId: userId,
          role
        }
      });

      if (error) throw error;
      
      if (data?.success) {
        await fetchRoles();
        return true;
      } else {
        console.error('Error removing role:', data?.error);
        return false;
      }
    } catch (error) {
      console.error('Error removing role:', error);
      return false;
    }
  };

  return {
    roles,
    isAdmin,
    isLoading,
    assignRole,
    removeRole,
    fetchRoles,
  };
}
