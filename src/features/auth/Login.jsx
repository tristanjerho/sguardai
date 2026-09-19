import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Mail, Lock, Sparkles, User, Stethoscope, ShieldCheck, ArrowRight } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
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
      toast.success(`Welcome back, ${user.fullName || user.email}!`);

      if (user.role === ROLES.PATIENT) {
        if (!user.isOnboarded) {
          navigate('/onboarding');
        } else {
          navigate('/patient');
        }
      } else if (user.role === ROLES.DENTIST) {
        navigate('/clinic');
      } else if (user.role === ROLES.ADMIN) {
        navigate('/admin');
      } else {
        navigate('/');
      }
    } catch (err) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const fillDemoAccount = (demoEmail, demoPassword) => {
    setEmail(demoEmail);
    setPassword(demoPassword);
    setError('');
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    try {
      const user = await loginWithGoogle();
      toast.success(`Signed in via Google as ${user.fullName}`);
      navigate('/patient');
    } catch (err) {
      setError(err.message || 'Google sign-in failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-gradient-to-br from-teal-50/50 via-surface-base to-orange-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-teal-950/20">
      <div className="w-full max-w-md space-y-6">
        {/* Brand header */}
        <div className="text-center space-y-2">
          <Link to="/" className="inline-flex items-center gap-2 group mb-2">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-teal-600 to-teal-400 flex items-center justify-center text-white shadow-soft group-hover:scale-105 transition-transform">
              <Sparkles className="w-6 h-6" />
            </div>
          </Link>
          <h1 className="text-2xl sm:text-3xl font-heading font-extrabold text-ink-primary tracking-tight">
            Welcome to SmileGuard<span className="text-orange-500">.AI</span>
          </h1>
          <p className="text-sm text-ink-secondary">
            Sign in to access your dental records or clinical workspace
          </p>
        </div>

        {/* Demo Accounts Quick-Fill Box */}
        <div className="p-4 rounded-2xl bg-teal-50/70 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800/60 shadow-soft-sm space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-heading font-bold text-teal-900 dark:text-teal-200 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
              1-Click Demo Accounts (Password: Demo1234)
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => fillDemoAccount('patient@demo.com', 'Demo1234')}
              className="px-2.5 py-2 rounded-xl text-xs font-semibold bg-surface-card border border-teal-200 dark:border-teal-800 hover:border-teal-400 text-teal-800 dark:text-teal-300 flex flex-col items-center gap-1 transition-all shadow-soft-sm"
            >
              <User className="w-3.5 h-3.5" />
              <span>Patient</span>
            </button>

            <button
              type="button"
              onClick={() => fillDemoAccount('dentist@demo.com', 'Demo1234')}
              className="px-2.5 py-2 rounded-xl text-xs font-semibold bg-surface-card border border-teal-200 dark:border-teal-800 hover:border-teal-400 text-teal-800 dark:text-teal-300 flex flex-col items-center gap-1 transition-all shadow-soft-sm"
            >
              <Stethoscope className="w-3.5 h-3.5" />
              <span>Dentist</span>
            </button>

            <button
              type="button"
              onClick={() => fillDemoAccount('admin@demo.com', 'Demo1234')}
              className="px-2.5 py-2 rounded-xl text-xs font-semibold bg-surface-card border border-teal-200 dark:border-teal-800 hover:border-teal-400 text-teal-800 dark:text-teal-300 flex flex-col items-center gap-1 transition-all shadow-soft-sm"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Admin</span>
            </button>
          </div>
        </div>

        {/* Login Card */}
        <Card className="p-6 sm:p-8 space-y-6 shadow-soft-lg">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <Input
              label="Email Address"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              leftIcon={Mail}
              required
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
              />
              <div className="flex justify-end pt-1">
                <Link
                  to="/forgot-password"
                  className="text-xs font-semibold text-teal-600 hover:text-teal-700 dark:text-teal-400"
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

          <div className="relative flex items-center justify-center my-4">
            <div className="border-t border-surface-border w-full" />
            <span className="bg-surface-card px-3 text-xs uppercase tracking-wider text-ink-muted">
              Or continue with
            </span>
            <div className="border-t border-surface-border w-full" />
          </div>

          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-3 py-2.5 px-4 rounded-xl border border-surface-border bg-surface-card hover:bg-surface-50 dark:hover:bg-surface-100 text-ink-primary text-sm font-semibold transition-all shadow-soft-sm"
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
            <span>Google Account (Demo SSO)</span>
          </button>
        </Card>

        {/* Signup callout */}
        <p className="text-center text-xs text-ink-secondary">
          Don&apos;t have a patient account?{' '}
          <Link
            to="/signup"
            className="font-bold text-teal-600 hover:text-teal-700 dark:text-teal-400 underline underline-offset-2"
          >
            Create Patient Account
          </Link>
        </p>
      </div>
    </div>
  );
}
