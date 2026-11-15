import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Download, X, Share, Smartphone, PlusSquare, Sparkles } from 'lucide-react';
import { Button } from '../ui/Button';

export function PwaInstallPrompt() {
  const location = useLocation();
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isIos, setIsIos] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);

  const isPortalRoute = /^\/(patient|clinic|lab|admin)/.test(location.pathname);
  const isBookingPage = location.pathname === '/patient/book';

  useEffect(() => {
    // 1. Check if already installed & running in standalone display mode
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true;

    if (isStandalone) {
      return; // Never show prompt if already running as installed PWA
    }

    // 2. Check if dismissed recently
    const dismissedAt = localStorage.getItem('sguardai_pwa_dismissed');
    if (dismissedAt && Date.now() - Number(dismissedAt) < 7 * 24 * 60 * 60 * 1000) {
      return;
    }

    // 3. Android / Chromium: Listen for beforeinstallprompt event
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // 4. iOS Safari detection
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    const isSafari = /safari/.test(userAgent) && !/chrome|crios|fxios/.test(userAgent);

    if (isIosDevice && isSafari) {
      setIsIos(true);
      setShowPrompt(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const choiceResult = await deferredPrompt.userChoice;
    if (choiceResult.outcome === 'accepted') {
      setShowPrompt(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('sguardai_pwa_dismissed', Date.now().toString());
  };

  if (!showPrompt || isBookingPage) return null;

  // Position flush beside the bottom-right Gardy assistant FAB (leaving >= 5rem clear on the right)
  const bottomOffsetClass = isPortalRoute
    ? 'bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] md:bottom-6'
    : 'bottom-4 sm:bottom-6';

  return (
    <div
      className={`fixed ${bottomOffsetClass} left-3 right-[5rem] sm:left-auto sm:right-[5.75rem] sm:w-[22rem] sm:max-w-[calc(100vw-7rem)] z-40 animate-in fade-in slide-in-from-bottom-5 duration-300`}
    >
      <div className="p-3 sm:p-4 rounded-2xl bg-surface-card/95 backdrop-blur-md border border-teal-500/30 shadow-soft-xl text-ink-primary space-y-2.5 sm:space-y-3">
        <div className="flex items-start justify-between gap-2.5">
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <div className="hidden xs:flex w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-teal-600 to-teal-400 items-center justify-center text-white shrink-0 shadow-soft-sm">
              <Smartphone className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-heading font-extrabold text-ink-primary flex flex-wrap items-center gap-1.5 leading-snug">
                <span>Install SmileGuard App</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300 font-bold shrink-0">
                  PWA
                </span>
              </div>
              <p className="text-[11px] text-ink-secondary leading-snug break-words">
                Install on your device without APK files.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleDismiss}
            className="p-1 rounded-lg text-ink-muted hover:text-ink-primary hover:bg-surface-subtle shrink-0"
            aria-label="Dismiss install prompt"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {isIos ? (
          <div className="p-2.5 rounded-xl bg-surface-subtle border border-surface-border text-xs text-ink-secondary space-y-1.5">
            <div className="font-semibold text-ink-primary flex items-center gap-1">
              <Share className="w-3.5 h-3.5 text-teal-600 shrink-0" />
              <span>How to install on iPhone/iPad:</span>
            </div>
            <ol className="list-decimal pl-4 space-y-0.5 text-[11px] text-ink-muted">
              <li>Tap the <strong className="text-ink-primary">Share</strong> button in your Safari toolbar.</li>
              <li>Scroll down and tap <strong className="text-ink-primary">Add to Home Screen ⊞</strong>.</li>
              <li>Open SmileGuard from your home screen as a native app!</li>
            </ol>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-end gap-1.5 sm:gap-2 pt-0.5">
            <Button variant="ghost" size="sm" onClick={handleDismiss}>
              Not now
            </Button>
            <Button
              variant="primary"
              size="sm"
              leftIcon={Download}
              onClick={handleInstallClick}
            >
              Install App
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
