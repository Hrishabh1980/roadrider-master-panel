import React, { createContext, useContext, useMemo } from 'react';
import type { Module, Permission, RolePermissions } from '../types/permissions';
import { ROLE_PRESETS, PAGE_TO_MODULE } from '../types/permissions';

// ─────────────────────────────────────────────────────────────────────
//  PermissionsContext
//  Usage:
//    const { can, canView } = usePermissions();
//    if (can('customers', 'edit')) { ... }
//    if (canView('finance')) { ... }
// ─────────────────────────────────────────────────────────────────────

interface PermissionsContextValue {
  permissions: RolePermissions;
  roleName: string;
  /** Check a specific permission on a module */
  can: (module: Module, permission: Permission) => boolean;
  /** Shorthand: can(module, 'view') */
  canView: (module: Module) => boolean;
  /** Given a page ID (nav item id), can the user view it? */
  canViewPage: (pageId: string) => boolean;
  /** Is the current user a Super Admin? */
  isSuperAdmin: boolean;
}

const PermissionsContext = createContext<PermissionsContextValue>({
  permissions: {},
  roleName: 'Super Admin',
  can: () => true,
  canView: () => true,
  canViewPage: () => true,
  isSuperAdmin: true,
});

export function PermissionsProvider({
  children,
  currentUser,
}: {
  children: React.ReactNode;
  currentUser: any;
}) {
  const value = useMemo<PermissionsContextValue>(() => {
    // Determine role from user object
    const roleId = (currentUser?.roleId as string) || 'super_admin';
    const roleKey = roleId.toLowerCase().replace(/\s+/g, '_');

    const isSuperAdmin =
      roleKey === 'super_admin' ||
      currentUser?.role === 'Super Admin';

    // Priority: 1) inline permissions (from assigned sub-admin), 2) preset, 3) super admin
    let permissions: RolePermissions;
    if (currentUser?.permissions && Object.keys(currentUser.permissions).length > 0 && !isSuperAdmin) {
      // Assigned sub-admin with exact permission matrix
      permissions = currentUser.permissions as RolePermissions;
    } else if (!isSuperAdmin) {
      const preset = ROLE_PRESETS[roleKey];
      permissions = preset?.permissions || {};
    } else {
      permissions = ROLE_PRESETS.super_admin.permissions;
    }

    const roleName =
      currentUser?.role || ROLE_PRESETS[roleKey]?.name || 'Super Admin';

    const can = (module: Module, permission: Permission): boolean => {
      if (isSuperAdmin) return true;
      return !!(permissions[module]?.[permission]);
    };

    const canView = (module: Module): boolean => can(module, 'view');

    const canViewPage = (pageId: string): boolean => {
      if (isSuperAdmin) return true;
      const module = PAGE_TO_MODULE[pageId];
      if (!module) return true; // Unknown page → allow
      return canView(module);
    };

    return { permissions, roleName, can, canView, canViewPage, isSuperAdmin };
  }, [currentUser]);

  return (
    <PermissionsContext.Provider value={value}>
      {children}
    </PermissionsContext.Provider>
  );
}

export function usePermissions() {
  return useContext(PermissionsContext);
}
