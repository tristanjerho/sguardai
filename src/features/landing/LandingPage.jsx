import React from 'react';
import { Link } from 'react-router-dom';
import {
  Sparkles,
  CalendarCheck,
  Flame,
  BrainCircuit,
  Activity,
  ShieldCheck,
  ArrowRight,
  Stethoscope,
  Users,
  CheckCircle2,
  ChevronRight,
  Sun,
  Moon,
} from 'lucide-react';
import { Mascot } from '../../components/mascot/Mascot';
import { MascotBubble } from '../../components/mascot/MascotBubble';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { useTheme } from '../../context/ThemeContext';

export function LandingPage() {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="min-h-screen bg-surface-base text-ink-primary flex flex-col selection:bg-teal-500 selection:text-white">
      {/* Navigation Bar */}
      <header className="sticky top-0 z-30 w-full h-16 border-b border-surface-border bg-surface-card/85 backdrop-blur-md px-4 sm:px-8 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-teal-600 to-teal-400 flex items-center justify-center text-white shadow-soft">
            <Sparkles className="w-5 h-5" />
          </div>
          <span className="font-heading font-extrabold text-lg sm:text-xl tracking-tight bg-gradient-to-r from-teal-700 via-teal-600 to-teal-500 dark:from-teal-300 dark:to-teal-500 bg-clip-text text-transparent">
            SmileGuard<span className="text-orange-500">.AI</span>
          </span>
        </Link>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={toggleTheme}
            className="p-2 rounded-xl text-ink-secondary hover:text-ink-primary hover:bg-surface-100 transition-colors"
            aria-label="Toggle dark mode"
          >
            {theme === 'dark' ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5 text-slate-600" />}
          </button>

          <Link to="/login">
            <Button variant="ghost" size="sm">
              Sign In
            </Button>
          </Link>

          <Link to="/signup">
            <Button variant="primary" size="sm" rightIcon={ArrowRight}>
              Patient Portal
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero Section with Sparky Waving */}
      <section className="relative py-16 sm:py-24 px-4 sm:px-8 overflow-hidden">
        {/* Background gradient orbs */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-teal-500/10 dark:bg-teal-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Hero Left Content */}
          <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-teal-50 dark:bg-teal-950/70 border border-teal-200 dark:border-teal-800 text-teal-800 dark:text-teal-300 text-xs font-bold">
              <Sparkles className="w-4 h-4 text-orange-500" />
              <span>Intelligent Dental Clinic & Orthodontic Monitoring</span>
            </div>

            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-heading font-black tracking-tight leading-[1.15] text-ink-primary">
              Guarding Every Smile with{' '}
              <span className="bg-gradient-to-r from-teal-600 via-teal-500 to-emerald-500 dark:from-teal-300 dark:to-teal-500 bg-clip-text text-transparent">
                Clinical Precision
              </span>{' '}
              & AI.
            </h1>

            <p className="text-base sm:text-lg text-ink-secondary max-w-xl mx-auto lg:mx-0 leading-relaxed">
              Connect patients and dental specialists seamlessly. Experience real-time orthodontic stage tracking, gamified brushing streaks with <strong>Sparky the Smile Guard</strong>, and AI-assisted radiograph diagnostics.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3.5 pt-2">
              <Link to="/login" className="w-full sm:w-auto">
                <Button variant="primary" size="lg" className="w-full sm:w-auto font-bold shadow-soft" rightIcon={ArrowRight}>
                  Sign In to Clinic Portal
                </Button>
              </Link>
              <Link to="/signup" className="w-full sm:w-auto">
                <Button variant="secondary" size="lg" className="w-full sm:w-auto">
                  Create Patient Account
                </Button>
              </Link>
            </div>

            {/* Credibility badges */}
            <div className="pt-4 flex flex-wrap items-center justify-center lg:justify-start gap-4 text-xs text-ink-secondary">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-teal-600" />
                RA 10173 Privacy Protected
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-teal-600" />
                Real-time Double-Booking Guard
              </span>
            </div>
          </div>

          {/* Hero Right: Sparky & Interactive Speech Bubble */}
          <div className="lg:col-span-5 flex flex-col items-center justify-center space-y-4">
            <div className="relative p-8 rounded-3xl bg-gradient-to-br from-teal-500/10 via-teal-50/50 to-orange-50/30 dark:from-teal-950/40 dark:via-slate-900/60 dark:to-slate-950 border border-teal-200/80 dark:border-teal-800/60 shadow-soft-lg flex flex-col items-center text-center">
              <Mascot mood="wave" size="xl" />

              <div className="mt-4">
                <MascotBubble
                  title="Hi there, I'm Sparky!"
                  message="Welcome to SmileGuard AI! Sign in to book appointments, track your orthodontic journey, or manage clinical dental records securely."
                  badge="Smile Mascot"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Pillars: For Patients vs For Clinics */}
      <section className="py-16 px-4 sm:px-8 bg-surface-50/70 dark:bg-surface-100/20 border-y border-surface-border">
        <div className="max-w-6xl mx-auto space-y-12">
          <div className="text-center space-y-3 max-w-2xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-heading font-extrabold text-ink-primary">
              Built for Patients and Modern Dental Teams
            </h2>
            <p className="text-sm text-ink-secondary">
              Everything needed to manage appointments, orthodontic progress, and digital radiology in one unified platform.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Patient Portal Highlights */}
            <Card className="p-6 sm:p-8 space-y-6 border-teal-200 dark:border-teal-800/60">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-teal-100 dark:bg-teal-900/60 flex items-center justify-center text-teal-700 dark:text-teal-300">
                  <Flame className="w-6 h-6 text-orange-500" />
                </div>
                <div>
                  <h3 className="text-xl font-heading font-bold text-ink-primary">
                    For Patients
                  </h3>
                  <p className="text-xs text-ink-muted">Empowering your daily smile journey</p>
                </div>
              </div>

              <ul className="space-y-3.5 text-xs sm:text-sm text-ink-secondary">
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-teal-600 flex-shrink-0 mt-0.5" />
                  <span><strong>3-Step Booking Wizard:</strong> Pick procedures and verify specialist availability with zero double-booking.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-teal-600 flex-shrink-0 mt-0.5" />
                  <span><strong>Visual Orthodontic Timeline:</strong> Watch alignment phases unfold with interactive progress rings.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-teal-600 flex-shrink-0 mt-0.5" />
                  <span><strong>Brush Streak & Rewards:</strong> Check in morning and night to unlock milestone badges with Sparky cheering you on.</span>
                </li>
              </ul>

              <Link to="/signup" className="block">
                <Button variant="primary" size="md" className="w-full">
                  Create Free Patient Account
                </Button>
              </Link>
            </Card>

            {/* Clinic & Specialist Highlights */}
            <Card className="p-6 sm:p-8 space-y-6 border-teal-200 dark:border-teal-800/60">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-teal-100 dark:bg-teal-900/60 flex items-center justify-center text-teal-700 dark:text-teal-300">
                  <Stethoscope className="w-6 h-6 text-teal-600" />
                </div>
                <div>
                  <h3 className="text-xl font-heading font-bold text-ink-primary">
                    For Clinics & Specialists
                  </h3>
                  <p className="text-xs text-ink-muted">High-efficiency chairside workflow</p>
                </div>
              </div>

              <ul className="space-y-3.5 text-xs sm:text-sm text-ink-secondary">
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-teal-600 flex-shrink-0 mt-0.5" />
                  <span><strong>Queue Triage:</strong> Approve, reschedule, or decline appointments with automated patient notifications.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-teal-600 flex-shrink-0 mt-0.5" />
                  <span><strong>AI Workstation & Grad-CAM:</strong> Neural radiograph analysis with activation heatmaps and confidence score bars.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-teal-600 flex-shrink-0 mt-0.5" />
                  <span><strong>Dental Lab Management:</strong> Track retainers, crowns, and expanders from prescription to delivery.</span>
                </li>
              </ul>

              <Link to="/login" className="block">
                <Button variant="secondary" size="md" className="w-full">
                  Sign in as Dentist / Admin
                </Button>
              </Link>
            </Card>
          </div>
        </div>
      </section>

      {/* How It Works in 3 Steps */}
      <section className="py-16 px-4 sm:px-8">
        <div className="max-w-5xl mx-auto space-y-12">
          <div className="text-center space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400">
              Simple Workflow
            </span>
            <h2 className="text-2xl sm:text-3xl font-heading font-extrabold text-ink-primary">
              How SmileGuard AI Works in 3 Steps
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="p-6 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-teal-600 text-white font-heading font-extrabold text-lg flex items-center justify-center mx-auto shadow-soft">
                1
              </div>
              <h3 className="font-heading font-bold text-base text-ink-primary">
                Book & Onboard
              </h3>
              <p className="text-xs text-ink-secondary leading-relaxed">
                Choose your specialist, pick an open slot, and consent to RA 10173 data privacy in seconds.
              </p>
            </Card>

            <Card className="p-6 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-teal-600 text-white font-heading font-extrabold text-lg flex items-center justify-center mx-auto shadow-soft">
                2
              </div>
              <h3 className="font-heading font-bold text-base text-ink-primary">
                Visit & AI Diagnostics
              </h3>
              <p className="text-xs text-ink-secondary leading-relaxed">
                Attend your appointment while our specialists inspect digital radiographs with Grad-CAM assistance.
              </p>
            </Card>

            <Card className="p-6 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-teal-600 text-white font-heading font-extrabold text-lg flex items-center justify-center mx-auto shadow-soft">
                3
              </div>
              <h3 className="font-heading font-bold text-base text-ink-primary">
                Track & Earn Streaks
              </h3>
              <p className="text-xs text-ink-secondary leading-relaxed">
                Monitor your orthodontic timeline, log daily brushing, and celebrate smile milestones with Sparky!
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-surface-border py-8 px-4 sm:px-8 bg-surface-card text-xs text-ink-secondary">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-heading font-bold text-teal-700 dark:text-teal-400">
              SmileGuard AI Platform
            </span>
            <span>• Intelligent Dental Cloud Platform</span>
          </div>

          <p className="text-center sm:text-right text-ink-muted">
            Compliant with Republic Act No. 10173 (Philippine Data Privacy Act of 2012).
          </p>
        </div>
      </footer>
    </div>
  );
}
