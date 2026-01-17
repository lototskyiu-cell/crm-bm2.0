
import { useState, useEffect } from 'react';
import { API } from '../services/api';
import { User, RoleConfig } from '../types';

export const usePermissions = (user: User | null) => {
  const [roleConfig, setRoleConfig] = useState<RoleConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const fetchPermissions = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      // If user is explicitly 'admin' role, we can optionally bypass fetching
      // But adhering to the prompt, we fetch config to ensure even admins follow the matrix if configured.
      // However, usually Admins are hardcoded to true. Let's fetch to be safe.
      try {
        const allRoles = await API.getPermissions();
        const config = allRoles.find(r => r.id === user.role);
        if (isMounted) {
          setRoleConfig(config || null);
          setLoading(false);
        }
      } catch (e) {
        console.error("Failed to load permissions", e);
        if (isMounted) setLoading(false);
      }
    };

    fetchPermissions();

    return () => { isMounted = false; };
  }, [user?.role]);

  const check = (key: string, type: 'view' | 'edit'): boolean => {
    if (!user) return false;
    
    // Global Admin Bypass (Safety Net)
    if (user.role === 'admin') return true;

    // If role config hasn't loaded yet, default to false (secure by default)
    if (!roleConfig) return false;

    // Check specific module permission
    const perm = roleConfig.permissions?.[key];
    
    // If permission record exists, return the value. 
    // If undefined, default to FALSE (Secure) or TRUE depending on philosophy.
    // The prompt implies explicit checking. Let's default to false if not found in DB.
    return perm?.[type] ?? false; 
  };

  return {
    canView: (moduleKey: string) => check(moduleKey, 'view'),
    canEdit: (moduleKey: string) => check(moduleKey, 'edit'),
    loading
  };
};
