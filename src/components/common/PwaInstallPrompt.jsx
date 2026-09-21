import React, { useState, useEffect } from 'react';
import { Download, X, Share, Smartphone, PlusSquare, Sparkles } from 'lucide-react';
import { Button } from '../ui/Button';

export function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isIos, setIsIos] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);

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

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-md z-50 animate-in fade-in slide-in-from-bottom-5 duration-300">
      <div className="p-4 rounded-2xl bg-surface-card/95 backdrop-blur-md border border-teal-500/30 shadow-soft-xl text-ink-primary space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-teal-600 to-teal-400 flex items-center justify-center text-white shrink-0 shadow-soft-sm">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-heading font-extrabold text-ink-primary flex items-center gap-1.5">
                <span>Install SmileGuard AI App</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300 font-bold">
                  PWA
                </span>
              </div>
              <p className="text-[11px] text-ink-secondary">
                Install on your device without downloading APK files.
              </p>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="p-1 rounded-lg text-ink-muted hover:text-ink-primary hover:bg-surface-subtle"
            aria-label="Dismiss install prompt"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {isIos ? (
          <div className="p-2.5 rounded-xl bg-surface-subtle border border-surface-border text-xs text-ink-secondary space-y-1.5">
            <div className="font-semibold text-ink-primary flex items-center gap-1">
              <Share className="w-3.5 h-3.5 text-teal-600" />
              <span>How to install on iPhone/iPad:</span>
            </div>
            <ol className="list-decimal pl-4 space-y-0.5 text-[11px] text-ink-muted">
              <li>Tap the <strong className="text-ink-primary">Share</strong> button in your Safari toolbar.</li>
              <li>Scroll down and tap <strong className="text-ink-primary">Add to Home Screen ⊞</strong>.</li>
              <li>Open SmileGuard AI from your home screen as a native app!</li>
            </ol>
          </div>
        ) : (
          <div className="flex items-center justify-end gap-2 pt-1">
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
