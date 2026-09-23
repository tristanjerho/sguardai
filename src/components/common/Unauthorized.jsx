import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { Button } from '../ui/Button';
import { useAuth } from '../../hooks/useAuth';
import { ROLES } from '../../lib/roles';

export function Unauthorized() {
  const { user } = useAuth();

  const getHomePath = () => {
    if (!user) return '/login';
    if (user.role === ROLES.PATIENT) return '/patient';
    if (user.role === ROLES.DENTIST) return '/clinic';
    if (user.role === ROLES.LAB_TECH) return '/lab';
    if (user.role === ROLES.ADMIN || user.role === ROLES.SUPERADMIN) return '/admin';
    return '/';
  };

  return (
    <div className="min-h-screen bg-surface-base flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-5">
        <div className="w-16 h-16 rounded-3xl bg-rose-500/10 text-rose-600 dark:text-rose-400 mx-auto flex items-center justify-center border border-rose-200 dark:border-rose-800">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-heading font-extrabold text-ink-primary">
            Access Denied
          </h1>
          <p className="text-sm text-ink-secondary">
            You do not have the required permissions or credentials to access this clinical portal.
          </p>
        </div>
        <div className="pt-2">
          <Link to={getHomePath()}>
            <Button variant="primary" size="md" leftIcon={ArrowLeft}>
              Return to Authorized Portal
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
