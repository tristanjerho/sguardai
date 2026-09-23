import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Phone, Calendar, HeartPulse, UserCheck, Sparkles, ArrowRight } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Logo } from '../../components/common/Logo';

export function Onboarding() {
  const { user, completeOnboarding } = useAuth();
  const [fullName, setFullName] = useState(user?.fullName || '');
  const [phone, setPhone] = useState(user?.phone || '+63 9');
  const [dateOfBirth, setDateOfBirth] = useState(user?.dateOfBirth || '');
  const [medicalHistory, setMedicalHistory] = useState(user?.medicalHistory || '');
  const [emergencyContact, setEmergencyContact] = useState(user?.emergencyContact || '');
  const [hasPrivacyConsent, setHasPrivacyConsent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const toast = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!fullName.trim()) {
      setError('Please provide your full legal name.');
      return;
    }
    if (!phone || phone.length < 8) {
      setError('Please enter a valid mobile number.');
      return;
    }
    if (!dateOfBirth) {
      setError('Please select your date of birth.');
      return;
    }
    if (!emergencyContact.trim()) {
      setError('Please specify an emergency contact person and phone number.');
      return;
    }
    if (!hasPrivacyConsent) {
      setError('You must review and consent to the Data Privacy Act (RA 10173) agreement.');
      return;
    }

    setIsLoading(true);
    try {
      await completeOnboarding({
        fullName,
        phone,
        dateOfBirth,
        medicalHistory,
        emergencyContact,
      });
      toast.success('Medical profile & privacy consent recorded successfully!');
      navigate('/patient');
    } catch (err) {
      setError(err.message || 'Failed to complete profile onboarding.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen py-10 px-4 sm:px-6 bg-gradient-to-br from-teal-50/60 via-surface-base to-orange-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-teal-950/20">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex justify-center mb-1">
            <Logo size="xl" showText={false} />
          </div>
          <h1 className="text-2xl sm:text-3xl font-heading font-extrabold text-ink-primary tracking-tight">
            Patient Medical Onboarding
          </h1>
          <p className="text-sm text-ink-secondary">
            Welcome to <span className="text-teal-700 dark:text-teal-400 font-bold">SmileGuard</span>! Please complete your dental chart baseline.
          </p>
        </div>

        <Card className="p-6 sm:p-8 space-y-6 shadow-soft-lg">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Full Legal Name"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Maria Santos"
                required
              />

              <Input
                label="Mobile Contact"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+63 917 555 0101"
                leftIcon={Phone}
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Date of Birth"
                type="date"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
                leftIcon={Calendar}
                required
              />

              <Input
                label="Emergency Contact & Phone"
                type="text"
                value={emergencyContact}
                onChange={(e) => setEmergencyContact(e.target.value)}
                placeholder="e.g. Jose Santos (Father) - +63 917 555 0199"
                leftIcon={UserCheck}
                required
              />
            </div>

            {/* Medical History */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-ink-secondary flex items-center gap-1.5">
                <HeartPulse className="w-4 h-4 text-rose-500" />
                Medical & Dental History / Allergies
              </label>
              <textarea
                value={medicalHistory}
                onChange={(e) => setMedicalHistory(e.target.value)}
                rows={3}
                placeholder="Please state any allergies (e.g. penicillin, latex, local anesthesia), existing medical conditions (e.g. hypertension, asthma), or previous oral surgeries..."
                className="w-full bg-surface-card border border-surface-border rounded-xl p-3.5 text-sm text-ink-primary placeholder:text-ink-muted/70 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all resize-none"
              />
              <p className="text-[11px] text-ink-muted">
                This information is kept strictly confidential and accessible only to your attending dentist.
              </p>
            </div>

            {/* Republic Act 10173 Data Privacy Act Consent Box */}
            <div className="p-4 sm:p-5 rounded-2xl bg-teal-50/80 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800/60 space-y-3">
              <div className="flex items-center gap-2 text-teal-900 dark:text-teal-200 font-heading font-bold text-sm">
                <ShieldCheck className="w-5 h-5 text-teal-600 dark:text-teal-400 flex-shrink-0" />
                <span>Republic Act No. 10173 — Data Privacy Act of 2012 Consent</span>
              </div>

              <div className="text-xs text-teal-800/90 dark:text-teal-300/90 leading-relaxed bg-surface-card/60 p-3 rounded-xl border border-teal-200/50 dark:border-teal-800/40 max-h-32 overflow-y-auto">
                <p>
                  By checking the box below, you voluntarily consent to the collection, processing, diagnostic storage, and secure transmission of your personal and health-sensitive dental records (including radiographs, clinical photographs, treatment progressions, and appointment histories) by SmileGuard and its certified dental practitioners in compliance with <strong>Republic Act No. 10173 (Philippine Data Privacy Act of 2012)</strong>.
                </p>
                <p className="mt-1.5">
                  Your data will be safeguarded with end-to-end encryption and will never be shared with third parties without your explicit authorization.
                </p>
              </div>

              <label className="flex items-start gap-3 cursor-pointer select-none pt-1">
                <input
                  type="checkbox"
                  checked={hasPrivacyConsent}
                  onChange={(e) => setHasPrivacyConsent(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded text-teal-600 focus:ring-teal-500 border-slate-300 dark:border-slate-700 bg-surface-card cursor-pointer"
                  required
                />
                <span className="text-xs font-semibold text-ink-primary leading-tight">
                  I have read, understood, and agree to the Data Privacy Act (RA 10173) processing terms and consent to clinical data retention.
                </span>
              </label>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              isLoading={isLoading}
              className="w-full"
              rightIcon={ArrowRight}
            >
              Complete Onboarding & Enter Portal
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
