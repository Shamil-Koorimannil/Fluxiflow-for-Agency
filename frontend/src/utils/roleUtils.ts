/**
 * Helper utility for formatting user roles into user-facing display labels.
 */

export const getRoleDisplayLabel = (role?: string | null): string => {
  if (!role) return 'Member';
  switch (role.toUpperCase()) {
    case 'ORG_ADMIN':
      return 'Organisation admin';
    case 'ADMIN':
      return 'Admin/Manager';
    case 'MEMBER':
      return 'Member';
    default:
      return role;
  }
};
