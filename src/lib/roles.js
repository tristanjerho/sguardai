/**
 * System user roles for SmileGuard
 */
export const ROLES = {
  PATIENT: 'PATIENT',
  DENTIST: 'DENTIST',
  LAB_TECH: 'LAB_TECH',
  ADMIN: 'ADMIN',
  SUPERADMIN: 'SUPERADMIN',
};

export const ROLE_LABELS = {
  [ROLES.PATIENT]: 'Patient',
  [ROLES.DENTIST]: 'Dentist / Specialist',
  [ROLES.LAB_TECH]: 'Lab Technician',
  [ROLES.ADMIN]: 'Clinic Administrator',
  [ROLES.SUPERADMIN]: 'Super Administrator',
};

export const isStaffRole = (role) => {
  return [ROLES.DENTIST, ROLES.LAB_TECH, ROLES.ADMIN, ROLES.SUPERADMIN].includes(role);
};

export const isAdminRole = (role) => {
  return [ROLES.ADMIN, ROLES.SUPERADMIN].includes(role);
};
