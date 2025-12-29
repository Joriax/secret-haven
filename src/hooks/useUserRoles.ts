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
  const { userId, sessionToken } = useAuth();

  const fetchRoles = useCallback(async () => {
    if (!userId || !sessionToken) {
      setIsLoading(false);
      return;
    }

    try {
      // Get current user's roles via edge function
      const { data: userRolesResponse, error: userRolesError } = await supabase.functions.invoke('verify-pin', {
        body: { 
          action: 'get-user-roles',
          sessionToken 
        }
      });

      if (userRolesError) throw userRolesError;

      const userRoles = userRolesResponse?.roles || [];
      const hasAdminRole = userRoles.some((r: UserRole) => r.role === 'admin');
      setIsAdmin(hasAdminRole);

      // If admin, fetch all roles
      if (hasAdminRole) {
        const { data: allRolesResponse, error: allRolesError } = await supabase.functions.invoke('verify-pin', {
          body: { 
            action: 'admin-get-all-roles',
            sessionToken 
          }
        });

        if (allRolesError) throw allRolesError;
        
        setRoles(allRolesResponse?.roles as UserRole[] || []);
      }
    } catch (error) {
      console.error('Error fetching roles:', error);
    } finally {
      setIsLoading(false);
    }
  }, [userId, sessionToken]);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  const assignRole = async (targetUserId: string, role: AppRole) => {
    if (!isAdmin || !userId || !sessionToken) return false;

    try {
      const { data, error } = await supabase.functions.invoke('verify-pin', {
        body: { 
          action: 'admin-assign-role', 
          targetUserId,
          sessionToken,
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
    if (!isAdmin || !userId || !sessionToken) return false;

    try {
      const { data, error } = await supabase.functions.invoke('verify-pin', {
        body: { 
          action: 'admin-remove-role', 
          targetUserId,
          sessionToken,
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
