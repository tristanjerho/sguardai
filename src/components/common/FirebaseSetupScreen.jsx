import React from 'react';
import { AlertTriangle, KeyRound, CheckCircle2, XCircle, RefreshCw, Sparkles } from 'lucide-react';
import { firebaseConfig } from '../../config/firebase';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';

export function FirebaseSetupScreen() {
  const envStatus = [
    { label: 'VITE_FIREBASE_API_KEY', exists: Boolean(firebaseConfig.apiKey) },
    { label: 'VITE_FIREBASE_AUTH_DOMAIN', exists: Boolean(firebaseConfig.authDomain) },
    { label: 'VITE_FIREBASE_PROJECT_ID', exists: Boolean(firebaseConfig.projectId) },
    { label: 'VITE_FIREBASE_STORAGE_BUCKET', exists: Boolean(firebaseConfig.storageBucket) },
    { label: 'VITE_FIREBASE_MESSAGING_SENDER_ID', exists: Boolean(firebaseConfig.messagingSenderId) },
    { label: 'VITE_FIREBASE_APP_ID', exists: Boolean(firebaseConfig.appId) },
  ];

  return (
    <div className="min-h-screen bg-surface-base flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-xl space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 mb-2 border border-amber-200 dark:border-amber-800">
            <KeyRound className="w-7 h-7" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-heading font-extrabold text-ink-primary tracking-tight">
            Firebase Configuration Required
          </h1>
          <p className="text-sm text-ink-secondary max-w-md mx-auto">
            SmileGuard AI operates exclusively on real Firebase Authentication and Cloud Firestore.
            Please connect your Firebase project environment variables.
          </p>
        </div>

        <Card className="shadow-soft-lg">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              Environment Variables Status (.env)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="divide-y divide-surface-border rounded-xl border border-surface-border overflow-hidden">
              {envStatus.map((item) => (
                <div key={item.label} className="p-3 bg-surface-card flex items-center justify-between text-xs">
                  <span className="font-mono text-ink-primary">{item.label}</span>
                  {item.exists ? (
                    <span className="flex items-center gap-1 text-emerald-600 font-semibold">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Configured
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-rose-500 font-semibold">
                      <XCircle className="w-3.5 h-3.5" /> Missing
                    </span>
                  )}
                </div>
              ))}
            </div>

            <div className="p-4 rounded-xl bg-surface-subtle text-xs text-ink-secondary space-y-2">
              <p className="font-semibold text-ink-primary">Quick Setup Instructions:</p>
              <ol className="list-decimal pl-4 space-y-1">
                <li>Create or edit your <code className="font-mono text-teal-600 bg-surface-base px-1 py-0.5 rounded">.env</code> file at project root.</li>
                <li>Copy the template keys from <code className="font-mono text-teal-600 bg-surface-base px-1 py-0.5 rounded">.env.example</code>.</li>
                <li>Fill in your project credentials from Firebase Console &gt; Project Settings.</li>
                <li>Restart the Vite development server.</li>
              </ol>
            </div>

            <Button
              variant="primary"
              size="md"
              className="w-full"
              leftIcon={RefreshCw}
              onClick={() => window.location.reload()}
            >
              Check Configuration Again
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
