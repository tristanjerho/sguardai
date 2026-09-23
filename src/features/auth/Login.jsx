import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Mail, Lock, Sparkles, ArrowRight, AlertCircle } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Logo } from '../../components/common/Logo';
import { ROLES } from '../../lib/roles';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const { login, loginWithGoogle } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSuccessfulAuth = (user) => {
    toast.success(`Welcome back, ${user.fullName || user.email}!`);

    const redirectPath = location.state?.from?.pathname;
    if (redirectPath) {
      navigate(redirectPath, { replace: true });
      return;
    }

    // Role-based destination strictly driven by verified Firestore user profile
    if (user.role === ROLES.PATIENT) {
      if (!user.isOnboarded) {
        navigate('/onboarding', { replace: true });
      } else {
        navigate('/patient', { replace: true });
      }
    } else if (user.role === ROLES.DENTIST) {
      navigate('/clinic', { replace: true });
    } else if (user.role === ROLES.LAB_TECH) {
      navigate('/lab', { replace: true });
    } else if (user.role === ROLES.ADMIN || user.role === ROLES.SUPERADMIN) {
      navigate('/admin', { replace: true });
    } else {
      navigate('/', { replace: true });
    }
  };

  const handleLogin = async (e) => {
    e?.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }

    setIsLoading(true);
    try {
      const user = await login(email, password);
      handleSuccessfulAuth(user);
    } catch (err) {
      let friendlyMsg = err.message || 'Login failed. Please check your credentials.';
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
        friendlyMsg = 'Invalid email address or password. Please verify your credentials.';
      } else if (err.code === 'auth/too-many-requests') {
        friendlyMsg = 'Too many unsuccessful attempts. Please try again later or reset your password.';
      } else if (err.code === 'auth/network-request-failed') {
        friendlyMsg = 'Network connectivity error. Please check your internet connection.';
      }
      setError(friendlyMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setIsLoading(true);
    try {
      const user = await loginWithGoogle();
      handleSuccessfulAuth(user);
    } catch (err) {
      setError(err.message || 'Google sign-in was cancelled or failed.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-gradient-to-br from-teal-50/50 via-surface-base to-orange-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-teal-950/20">
      <div className="w-full max-w-md space-y-6">
        {/* Brand header */}
        <div className="text-center space-y-2">
          <div className="inline-flex justify-center mb-1">
            <Logo size="xl" showText={false} />
          </div>
          <h1 className="text-2xl sm:text-3xl font-heading font-extrabold text-ink-primary tracking-tight">
            Welcome to <span className="text-teal-700 dark:text-teal-400">SmileGuard</span>
          </h1>
          <p className="text-sm text-ink-secondary">
            Sign in to access your clinical workspace or patient portal
          </p>
        </div>

        {/* Login Card */}
        <Card className="p-6 sm:p-8 space-y-5 shadow-soft-lg">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-medium flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Google Sign-in Button */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={isLoading}
            className="w-full py-2.5 px-4 rounded-xl border border-surface-border bg-surface-card hover:bg-surface-subtle text-ink-primary text-xs font-heading font-bold flex items-center justify-center gap-3 transition-all shadow-soft-sm hover:border-surface-border-strong disabled:opacity-50"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>Continue with Google</span>
          </button>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-surface-border" />
            <span className="text-[11px] uppercase tracking-wider text-ink-muted font-bold">
              or with email
            </span>
            <div className="flex-1 h-px bg-surface-border" />
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <Input
              label="Email Address"
              type="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              leftIcon={Mail}
              required
              autoComplete="email"
            />

            <div className="space-y-1">
              <Input
                label="Password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                leftIcon={Lock}
                required
                autoComplete="current-password"
              />
              <div className="flex justify-end pt-1">
                <Link
                  to="/forgot-password"
                  className="text-xs font-semibold text-teal-600 hover:text-teal-700 dark:text-teal-400 hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              isLoading={isLoading}
              className="w-full"
              rightIcon={ArrowRight}
            >
              Sign In
            </Button>
          </form>

          <div className="pt-4 border-t border-surface-border text-center text-xs text-ink-secondary">
            Don't have an account?{' '}
            <Link
              to="/signup"
              className="font-bold text-teal-600 hover:text-teal-700 dark:text-teal-400 hover:underline"
            >
              Create Patient Account
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
