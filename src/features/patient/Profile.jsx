import React, { useState } from 'react';
import {
  User,
  Phone,
  Calendar,
  HeartPulse,
  UserCheck,
  ShieldCheck,
  Moon,
  Sun,
  Smile,
  Lock,
  Save,
  CheckCircle2,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../context/ThemeContext';
import { useMascot } from '../../context/MascotContext';
import { useToast } from '../../hooks/useToast';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Avatar } from '../../components/ui/Avatar';
import { formatDate } from '../../lib/formatters';

export function PatientProfile() {
  const { user, updateProfile } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { showSparky, toggleSparky } = useMascot();
  const toast = useToast();

  const [fullName, setFullName] = useState(user?.fullName || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [emergencyContact, setEmergencyContact] = useState(user?.emergencyContact || '');
  const [medicalHistory, setMedicalHistory] = useState(user?.medicalHistory || '');

  const [isSaving, setIsSaving] = useState(false);

  // Password mock state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPass, setIsChangingPass] = useState(false);

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await updateProfile({
        fullName,
        phone,
        emergencyContact,
        medicalHistory,
      });
      toast.success('Profile details updated successfully!');
    } catch (err) {
      toast.error('Failed to update profile.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      toast.error('New password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match.');
      return;
    }

    setIsChangingPass(true);
    setTimeout(() => {
      setIsChangingPass(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast.success('Password changed successfully (Mock).');
    }, 400);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="space-y-2">
        <h2 className="text-2xl sm:text-3xl font-heading font-extrabold text-ink-primary tracking-tight">
          Profile & Account Settings
        </h2>
        <p className="text-sm text-ink-secondary">
          Manage your contact credentials, medical records disclosures, theme, and mascot preferences.
        </p>
      </div>

      {/* Patient Profile Card */}
      <Card className="p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row items-center gap-5 pb-6 border-b border-surface-border">
          <Avatar name={user?.fullName || user?.email} size="xl" />
          <div className="text-center sm:text-left space-y-1">
            <h3 className="text-xl font-heading font-bold text-ink-primary">
              {user?.fullName || 'Patient'}
            </h3>
            <p className="text-xs text-ink-muted">{user?.email}</p>
            <div className="flex items-center gap-2 pt-1 justify-center sm:justify-start">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300">
                PATIENT PORTAL
              </span>
              <span className="text-[11px] text-ink-muted">
                Member since {formatDate(user?.createdAt)}
              </span>
            </div>
          </div>
        </div>

        <form onSubmit={handleSaveProfile} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Full Name"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              leftIcon={User}
              required
            />
            <Input
              label="Phone Number"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              leftIcon={Phone}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Date of Birth"
              type="date"
              value={user?.dateOfBirth || ''}
              disabled
              leftIcon={Calendar}
              helperText="Date of birth is locked for clinical integrity."
            />
            <Input
              label="Emergency Contact & Relationship"
              type="text"
              value={emergencyContact}
              onChange={(e) => setEmergencyContact(e.target.value)}
              leftIcon={UserCheck}
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-ink-secondary flex items-center gap-1.5">
              <HeartPulse className="w-4 h-4 text-rose-500" />
              Medical History & Allergies
            </label>
            <textarea
              value={medicalHistory}
              onChange={(e) => setMedicalHistory(e.target.value)}
              rows={3}
              className="w-full bg-surface-card border border-surface-border rounded-xl p-3 text-sm text-ink-primary focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none resize-none"
            />
          </div>

          <div className="flex justify-end pt-2">
            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={isSaving}
              rightIcon={Save}
            >
              Save Profile Changes
            </Button>
          </div>
        </form>
      </Card>

      {/* Preferences Card: Theme & Mascot Toggles */}
      <Card className="p-6 sm:p-8 space-y-6">
        <h3 className="text-lg font-heading font-bold text-ink-primary border-b border-surface-border pb-3">
          App Preferences & Accessibility
        </h3>

        <div className="divide-y divide-surface-border/60">
          {/* Dark Mode Toggle */}
          <div className="py-4 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="font-heading font-bold text-sm text-ink-primary flex items-center gap-2">
                {theme === 'dark' ? <Moon className="w-4 h-4 text-amber-400" /> : <Sun className="w-4 h-4 text-amber-500" />}
                Theme Mode
              </span>
              <p className="text-xs text-ink-secondary">
                Switch between clinical bright mode and sleek dark mode.
              </p>
            </div>
            <Button variant="secondary" size="sm" onClick={toggleTheme}>
              {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
            </Button>
          </div>

          {/* Mascot Toggle */}
          <div className="py-4 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="font-heading font-bold text-sm text-ink-primary flex items-center gap-2">
                <Smile className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                Show &ldquo;Sparky the Smile Guard&rdquo; Mascot
              </span>
              <p className="text-xs text-ink-secondary">
                Toggle animated companion guidance, brushing cheers, and daily tips.
              </p>
            </div>
            <Button
              variant={showSparky ? 'primary' : 'outline'}
              size="sm"
              onClick={toggleSparky}
            >
              {showSparky ? 'Enabled (Showing)' : 'Disabled (Hidden)'}
            </Button>
          </div>
        </div>
      </Card>

      {/* Security & Password Reset */}
      <Card className="p-6 sm:p-8 space-y-6">
        <h3 className="text-lg font-heading font-bold text-ink-primary border-b border-surface-border pb-3">
          Security & Password
        </h3>

        <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
          <Input
            label="Current Password"
            type="password"
            placeholder="••••••••"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            leftIcon={Lock}
            required
          />
          <Input
            label="New Password"
            type="password"
            placeholder="At least 6 characters"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            leftIcon={Lock}
            required
          />
          <Input
            label="Confirm New Password"
            type="password"
            placeholder="Repeat new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            leftIcon={Lock}
            required
          />

          <Button
            type="submit"
            variant="outline"
            size="md"
            isLoading={isChangingPass}
          >
            Update Password
          </Button>
        </form>
      </Card>
    </div>
  );
}
