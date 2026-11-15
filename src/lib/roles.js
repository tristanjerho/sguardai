/**
 * System user roles for SmileGuard
 */
export const ROLES = {
  PATIENT: 'PATIENT',
  DENTIST: 'DENTIST',
  RECEPTIONIST: 'RECEPTIONIST',
  LAB_TECH: 'LAB_TECH',
  ADMIN: 'ADMIN',
  SUPERADMIN: 'SUPERADMIN',
};

export const ROLE_LABELS = {
  [ROLES.PATIENT]: 'Patient',
  [ROLES.DENTIST]: 'Dentist / Specialist',
  [ROLES.RECEPTIONIST]: 'Clinic Receptionist',
  [ROLES.LAB_TECH]: 'Laboratory Admin / Specialist',
  [ROLES.ADMIN]: 'Clinic Administrator',
  [ROLES.SUPERADMIN]: 'Super Administrator',
};

export const isStaffRole = (role) => {
  return [ROLES.DENTIST, ROLES.RECEPTIONIST, ROLES.LAB_TECH, ROLES.ADMIN, ROLES.SUPERADMIN].includes(role);
};

export const isAdminRole = (role) => {
  return [ROLES.ADMIN, ROLES.SUPERADMIN].includes(role);
};
