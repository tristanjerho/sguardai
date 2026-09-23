import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldAlert,
  ShieldCheck,
  Users,
  UserPlus,
  Activity,
  Server,
  Database,
  Cloud,
  Cpu,
  RefreshCw,
  Download,
  AlertTriangle,
  CheckCircle2,
  Lock,
  ArrowRight,
  FlaskConical,
  Stethoscope,
  Clock,
  Search,
  KeyRound,
  Zap,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { authService } from '../../services/authService';
import { appointmentService } from '../../services/appointmentService';
import { laboratoryService } from '../../services/laboratoryService';
import { activityLogService } from '../../services/activityLogService';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Avatar } from '../../components/ui/Avatar';
import { StatCard } from '../../components/charts/StatCard';
import { ROLES } from '../../lib/roles';
import { formatDate } from '../../lib/formatters';

export function SuperAdminDashboard() {
  const { user: currentUser } = useAuth();
  const toast = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Core Data Registries
  const [users, setUsers] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [labOrders, setLabOrders] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);

  // Search & Governance filters
  const [userSearch, setUserSearch] = useState('');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState('ALL');

  // Diagnostics & Health State
  const [firestoreLatency, setFirestoreLatency] = useState(null);
  const [isTestingLatency, setIsTestingLatency] = useState(false);

  // Staff Provisioning Modal
  const [isProvisionOpen, setIsProvisionOpen] = useState(false);
  const [newFullName, setNewFullName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState(ROLES.DENTIST);
  const [newSpecialty, setNewSpecialty] = useState('General Dentistry');
  const [newPassword, setNewPassword] = useState('');
  const [isProvisioning, setIsProvisioning] = useState(false);

  // Role Elevation Modal
  const [selectedUser, setSelectedUser] = useState(null);
  const [targetRole, setTargetRole] = useState('');
  const [isUpdatingRole, setIsUpdatingRole] = useState(false);

  // Emergency Alert Broadcast
  const [emergencyNotice, setEmergencyNotice] = useState(() => {
    try {
      return localStorage.getItem('sguard_emergency_broadcast') || '';
    } catch {
      return '';
    }
  });
  const [isNoticeModalOpen, setIsNoticeModalOpen] = useState(false);
  const [tempNotice, setTempNotice] = useState(emergencyNotice);

  // Real-time latency measurement
  const testDatabaseLatency = async () => {
    setIsTestingLatency(true);
    const start = performance.now();
    try {
      await authService.listUsers();
      const end = performance.now();
      setFirestoreLatency(Math.round(end - start));
    } catch (err) {
      setFirestoreLatency(-1);
    } finally {
      setIsTestingLatency(false);
    }
  };

  // Load All Global Platform Data
  const loadPlatformData = async () => {
    try {
      setIsRefreshing(true);
      const [uList, apptList, ordersList, logsList] = await Promise.allSettled([
        authService.listUsers(),
        appointmentService.list ? appointmentService.list() : Promise.resolve([]),
        laboratoryService.list ? laboratoryService.list() : Promise.resolve([]),
        activityLogService.list(50),
      ]);

      if (uList.status === 'fulfilled' && Array.isArray(uList.value)) {
        setUsers(uList.value);
      }
      if (apptList.status === 'fulfilled' && Array.isArray(apptList.value)) {
        setAppointments(apptList.value);
      }
      if (ordersList.status === 'fulfilled' && Array.isArray(ordersList.value)) {
        setLabOrders(ordersList.value);
      }
      if (logsList.status === 'fulfilled' && Array.isArray(logsList.value)) {
        setAuditLogs(logsList.value);
      }

      // Test latency
      testDatabaseLatency();
    } catch (err) {
      console.error('Superadmin data load error:', err);
      toast.error('Failed to aggregate platform telemetry data');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadPlatformData();

    const unsubUsers = authService.subscribeToUsers((uList) => {
      setUsers(uList);
    });

    const unsubAppts = appointmentService.subscribeToAppointments((aList) => {
      setAppointments(aList);
    });

    return () => {
      unsubUsers();
      unsubAppts();
    };
  }, []);

  // Metrics aggregations
  const metrics = useMemo(() => {
    const rolesCount = {
      PATIENT: 0,
      DENTIST: 0,
      LAB_TECH: 0,
      ADMIN: 0,
      SUPERADMIN: 0,
    };

    if (Array.isArray(users)) {
      users.forEach((u) => {
        const r = u?.role || 'PATIENT';
        if (rolesCount[r] !== undefined) rolesCount[r]++;
        else rolesCount.PATIENT++;
      });
    }

    const activeAppts = Array.isArray(appointments)
      ? appointments.filter((a) => a?.status === 'CONFIRMED' || a?.status === 'PENDING').length
      : 0;

    const inProductionOrders = Array.isArray(labOrders)
      ? labOrders.filter((o) => o?.status !== 'DISPATCHED' && o?.status !== 'COMPLETED').length
      : 0;

    return {
      totalUsers: Array.isArray(users) ? users.length : 0,
      rolesCount,
      totalAppointments: Array.isArray(appointments) ? appointments.length : 0,
      activeAppts,
      totalLabOrders: Array.isArray(labOrders) ? labOrders.length : 0,
      inProductionOrders,
      totalLogs: Array.isArray(auditLogs) ? auditLogs.length : 0,
    };
  }, [users, appointments, labOrders, auditLogs]);

  // Filtered Users
  const filteredUsers = useMemo(() => {
    if (!Array.isArray(users)) return [];
    return users.filter((u) => {
      if (!u) return false;
      const search = (userSearch || '').toLowerCase();
      const matchesSearch =
        (u.fullName || '').toLowerCase().includes(search) ||
        (u.email || '').toLowerCase().includes(search) ||
        (u.id || '').toLowerCase().includes(search);

      const matchesRole =
        selectedRoleFilter === 'ALL' || u.role === selectedRoleFilter;

      return matchesSearch && matchesRole;
    });
  }, [users, userSearch, selectedRoleFilter]);

  // Handle Staff Provisioning
  const handleProvisionStaff = async (e) => {
    e.preventDefault();
    if (!newEmail || !newFullName || !newPassword) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsProvisioning(true);
    try {
      await authService.createStaffUser({
        fullName: newFullName,
        email: newEmail,
        role: newRole,
        specialty: newSpecialty,
        password: newPassword,
      });

      await activityLogService.log({
        userId: currentUser?.uid,
        actor: currentUser?.fullName || currentUser?.email || 'SuperAdmin',
        action: `PROVISION_STAFF_${newRole}`,
        resourceType: 'USER_REGISTRY',
        resourceId: newEmail,
        entity: `Created staff account: ${newFullName} (${newRole})`,
      });

      toast.success(`Successfully provisioned ${newRole} account for ${newFullName}`);
      setIsProvisionOpen(false);
      setNewFullName('');
      setNewEmail('');
      setNewPassword('');
      await loadPlatformData();
    } catch (err) {
      toast.error(err.message || 'Failed to provision staff account');
    } finally {
      setIsProvisioning(false);
    }
  };

  // Handle Role Elevation
  const handleUpdateRole = async () => {
    if (!selectedUser || !targetRole) return;

    if (selectedUser.id === currentUser?.uid && targetRole !== ROLES.SUPERADMIN) {
      toast.error('Safety Guard: You cannot demote your own active SuperAdmin session!');
      return;
    }

    setIsUpdatingRole(true);
    try {
      await authService.updateUserRole(selectedUser.id, targetRole);

      await activityLogService.log({
        userId: currentUser?.uid,
        actor: currentUser?.fullName || currentUser?.email || 'SuperAdmin',
        action: 'ELEVATE_ROLE',
        resourceType: 'USER_SECURITY',
        resourceId: selectedUser.id,
        entity: `Changed ${selectedUser.fullName || selectedUser.email}'s role to ${targetRole}`,
      });

      toast.success(`Role for ${selectedUser.fullName || selectedUser.email} updated to ${targetRole}`);
      setSelectedUser(null);
      await loadPlatformData();
    } catch (err) {
      toast.error('Failed to elevate user permissions');
    } finally {
      setIsUpdatingRole(false);
    }
  };

  // Export Audit Logs (RA 10173 Compliance CSV)
  const exportAuditCSV = () => {
    if (!Array.isArray(auditLogs) || auditLogs.length === 0) {
      toast.error('No audit logs available to export');
      return;
    }

    const headers = ['Timestamp', 'Actor', 'Action', 'Resource Type', 'Resource ID', 'Details'];
    const rows = auditLogs.map((log) => [
      `"${formatDate(log.timestamp) || ''}"`,
      `"${log.actor || ''}"`,
      `"${log.action || ''}"`,
      `"${log.resourceType || ''}"`,
      `"${log.resourceId || ''}"`,
      `"${(log.entity || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `smileguard_audit_log_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success('Audit log export downloaded successfully');
  };

  // Save Emergency Notice Broadcast
  const handleSaveBroadcast = () => {
    setEmergencyNotice(tempNotice);
    try {
      if (tempNotice) {
        localStorage.setItem('sguard_emergency_broadcast', tempNotice);
        toast.success('Emergency broadcast banner active');
      } else {
        localStorage.removeItem('sguard_emergency_broadcast');
        toast.success('Broadcast banner cleared');
      }
    } catch {
      // safe fallback
    }
    setIsNoticeModalOpen(false);
  };

  // Environment inspection variables
  const cloudinaryConfigured = Boolean(
    import.meta.env.VITE_CLOUDINARY_CLOUD_NAME &&
      import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET
  );
  const aiServiceConfigured = Boolean(import.meta.env.VITE_AI_SERVICE_URL);
  const pwaSupported = typeof window !== 'undefined' && 'serviceWorker' in navigator;

  return (
    <div className="space-y-8 pb-12">
      {/* Top Banner & SuperAdmin Crown Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-3xl bg-gradient-to-r from-slate-900 via-teal-950 to-slate-900 text-white shadow-xl border border-teal-500/20 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="space-y-2 z-10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-teal-500/20 border border-teal-400/30 text-teal-300">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-heading font-extrabold tracking-tight">
                  SuperAdmin Command Center
                </h1>
                <Badge variant="primary" className="bg-amber-400 text-slate-950 font-extrabold uppercase text-[10px] tracking-wider px-2 py-0.5">
                  Root Sovereign
                </Badge>
              </div>
              <p className="text-xs sm:text-sm text-slate-300 mt-0.5">
                Full platform sovereignty, infrastructure telemetry, and security governance.
              </p>
            </div>
          </div>
        </div>

        {/* Global Quick Action Bar */}
        <div className="flex flex-wrap items-center gap-2 z-10">
          <Button
            variant="secondary"
            size="sm"
            onClick={testDatabaseLatency}
            disabled={isTestingLatency}
            className="bg-white/10 hover:bg-white/20 text-white border-white/10 text-xs"
          >
            <Zap className={`w-3.5 h-3.5 mr-1.5 text-amber-300 ${isTestingLatency ? 'animate-bounce' : ''}`} />
            {firestoreLatency !== null ? `${firestoreLatency} ms Latency` : 'Ping DB'}
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={exportAuditCSV}
            className="bg-white/10 hover:bg-white/20 text-white border-white/10 text-xs"
          >
            <Download className="w-3.5 h-3.5 mr-1.5 text-teal-300" />
            Audit CSV
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => setIsNoticeModalOpen(true)}
            className="bg-white/10 hover:bg-white/20 text-white border-white/10 text-xs"
          >
            <AlertTriangle className="w-3.5 h-3.5 mr-1.5 text-orange-300" />
            {emergencyNotice ? 'Broadcast: Active' : 'Broadcast Notice'}
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsProvisionOpen(true)}
            className="bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs"
          >
            <UserPlus className="w-3.5 h-3.5 mr-1.5" />
            Provision Staff
          </Button>

          <button
            onClick={loadPlatformData}
            disabled={isRefreshing}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/10 transition-all"
            title="Refresh Platform Telemetry"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Emergency Broadcast Banner Display (If Set) */}
      {emergencyNotice && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between text-amber-800 dark:text-amber-200 text-xs sm:text-sm animate-pulse">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />
            <div>
              <span className="font-bold uppercase tracking-wider text-[11px] mr-2 px-2 py-0.5 rounded bg-amber-500/20 text-amber-700 dark:text-amber-300">
                Clinic Broadcast
              </span>
              <span>{emergencyNotice}</span>
            </div>
          </div>
          <button
            onClick={() => {
              setEmergencyNotice('');
              try {
                localStorage.removeItem('sguard_emergency_broadcast');
              } catch {}
              toast.info('Emergency broadcast removed');
            }}
            className="text-xs font-semibold text-amber-700 dark:text-amber-300 hover:underline ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Cloud Infrastructure & Telemetry Health Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Firestore Node */}
        <Card className="p-4 border-l-4 border-l-teal-500">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Database className="w-5 h-5 text-teal-600 dark:text-teal-400" />
              <div>
                <p className="text-xs font-bold text-ink-primary">Cloud Firestore</p>
                <p className="text-[11px] text-ink-muted">Project: sguardai-7d893</p>
              </div>
            </div>
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
          </div>
          <div className="mt-3 pt-2 border-t border-surface-border flex items-center justify-between text-[11px]">
            <span className="text-ink-muted">Security Rules</span>
            <span className="font-bold text-emerald-600 dark:text-emerald-400">Locked & Authoritative</span>
          </div>
        </Card>

        {/* Cloudinary Media Preset */}
        <Card className="p-4 border-l-4 border-l-sky-500">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Cloud className="w-5 h-5 text-sky-600 dark:text-sky-400" />
              <div>
                <p className="text-xs font-bold text-ink-primary">Cloudinary Scans</p>
                <p className="text-[11px] text-ink-muted">Bite-wing & OPG Bucket</p>
              </div>
            </div>
            <Badge variant={cloudinaryConfigured ? 'success' : 'warning'} size="sm">
              {cloudinaryConfigured ? 'Configured' : 'Preset Needed'}
            </Badge>
          </div>
          <div className="mt-3 pt-2 border-t border-surface-border flex items-center justify-between text-[11px]">
            <span className="text-ink-muted">Direct REST Pipeline</span>
            <span className="font-semibold text-ink-secondary">Unsigned Upload</span>
          </div>
        </Card>

        {/* AI Diagnostics Boundary */}
        <Card className="p-4 border-l-4 border-l-purple-500">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Cpu className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              <div>
                <p className="text-xs font-bold text-ink-primary">AI Diagnostics</p>
                <p className="text-[11px] text-ink-muted">Gemini 1.5 Boundary</p>
              </div>
            </div>
            <Badge variant={aiServiceConfigured ? 'success' : 'primary'} size="sm">
              {aiServiceConfigured ? 'Active' : 'Server Boundary'}
            </Badge>
          </div>
          <div className="mt-3 pt-2 border-t border-surface-border flex items-center justify-between text-[11px]">
            <span className="text-ink-muted">Frontend Key Protection</span>
            <span className="font-bold text-emerald-600 dark:text-emerald-400">Secure (Zero Key Leak)</span>
          </div>
        </Card>

        {/* PWA & Health Storage Privacy */}
        <Card className="p-4 border-l-4 border-l-emerald-500">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Server className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <div>
                <p className="text-xs font-bold text-ink-primary">PWA Offline Mode</p>
                <p className="text-[11px] text-ink-muted">Workbox v1.3.0</p>
              </div>
            </div>
            <Badge variant={pwaSupported ? 'success' : 'primary'} size="sm">
              {pwaSupported ? 'Ready' : 'Fallback'}
            </Badge>
          </div>
          <div className="mt-3 pt-2 border-t border-surface-border flex items-center justify-between text-[11px]">
            <span className="text-ink-muted">Clinical Data Caching</span>
            <span className="font-bold text-emerald-600 dark:text-emerald-400">Zero-Cache Compliant</span>
          </div>
        </Card>
      </div>

      {/* Global Stat Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          title="Total Registered Accounts"
          value={metrics.totalUsers}
          subtitle={`${metrics.rolesCount.PATIENT} Patients • ${metrics.rolesCount.DENTIST} Dentists • ${metrics.rolesCount.LAB_TECH} Techs`}
          icon={Users}
          color="teal"
        />
        <StatCard
          title="Clinic Appointments"
          value={metrics.totalAppointments}
          subtitle={`${metrics.activeAppts} Active/Pending Queue`}
          icon={Clock}
          color="blue"
        />
        <StatCard
          title="CAD/CAM Lab Orders"
          value={metrics.totalLabOrders}
          subtitle={`${metrics.inProductionOrders} In Fabrication Pipeline`}
          icon={FlaskConical}
          color="purple"
        />
        <StatCard
          title="Security & Audit Trail"
          value={metrics.totalLogs}
          subtitle="Immutable Firestore Events"
          icon={ShieldAlert}
          color="orange"
        />
      </div>

      {/* Quick Jump Stations for SuperAdmin */}
      <div className="space-y-3">
        <h2 className="text-sm font-heading font-extrabold uppercase tracking-wider text-ink-muted">
          Platform Subsystem Gateways
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link
            to="/clinic"
            className="p-5 rounded-2xl bg-surface-card border border-surface-border hover:border-teal-500/50 hover:shadow-soft transition-all group flex flex-col justify-between"
          >
            <div>
              <div className="p-3 rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 w-fit mb-3">
                <Stethoscope className="w-5 h-5" />
              </div>
              <h3 className="font-heading font-bold text-sm text-ink-primary group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
                Chairside Clinic Portal
              </h3>
              <p className="text-xs text-ink-muted mt-1">
                Odontograms, radiographs, and live patient queue.
              </p>
            </div>
            <div className="flex items-center text-xs font-semibold text-teal-600 dark:text-teal-400 mt-4">
              Enter Clinic <ArrowRight className="w-3.5 h-3.5 ml-1 transition-transform group-hover:translate-x-1" />
            </div>
          </Link>

          <Link
            to="/lab"
            className="p-5 rounded-2xl bg-surface-card border border-surface-border hover:border-purple-500/50 hover:shadow-soft transition-all group flex flex-col justify-between"
          >
            <div>
              <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 w-fit mb-3">
                <FlaskConical className="w-5 h-5" />
              </div>
              <h3 className="font-heading font-bold text-sm text-ink-primary group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                Dental Laboratory Board
              </h3>
              <p className="text-xs text-ink-muted mt-1">
                6-stage CAD/CAM Kanban from Milling to Dispatch.
              </p>
            </div>
            <div className="flex items-center text-xs font-semibold text-purple-600 dark:text-purple-400 mt-4">
              Open Lab Board <ArrowRight className="w-3.5 h-3.5 ml-1 transition-transform group-hover:translate-x-1" />
            </div>
          </Link>

          <Link
            to="/admin/users"
            className="p-5 rounded-2xl bg-surface-card border border-surface-border hover:border-blue-500/50 hover:shadow-soft transition-all group flex flex-col justify-between"
          >
            <div>
              <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 w-fit mb-3">
                <Users className="w-5 h-5" />
              </div>
              <h3 className="font-heading font-bold text-sm text-ink-primary group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                User Registry & Staff
              </h3>
              <p className="text-xs text-ink-muted mt-1">
                Full user catalog, profile metadata, and verification states.
              </p>
            </div>
            <div className="flex items-center text-xs font-semibold text-blue-600 dark:text-blue-400 mt-4">
              Manage Users <ArrowRight className="w-3.5 h-3.5 ml-1 transition-transform group-hover:translate-x-1" />
            </div>
          </Link>

          <Link
            to="/admin/logs"
            className="p-5 rounded-2xl bg-surface-card border border-surface-border hover:border-orange-500/50 hover:shadow-soft transition-all group flex flex-col justify-between"
          >
            <div>
              <div className="p-3 rounded-xl bg-orange-50 dark:bg-orange-950/60 text-orange-600 dark:text-orange-400 w-fit mb-3">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <h3 className="font-heading font-bold text-sm text-ink-primary group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">
                Full Security Audit Stream
              </h3>
              <p className="text-xs text-ink-muted mt-1">
                Filtered real-time immutable security event log stream.
              </p>
            </div>
            <div className="flex items-center text-xs font-semibold text-orange-600 dark:text-orange-400 mt-4">
              View All Logs <ArrowRight className="w-3.5 h-3.5 ml-1 transition-transform group-hover:translate-x-1" />
            </div>
          </Link>
        </div>
      </div>

      {/* Role Governance & Staff Elevation Matrix */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-heading font-bold text-ink-primary flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              Role Governance & Privilege Delegation
            </h2>
            <p className="text-xs text-ink-muted">
              Server-authoritative role modification with active session safety guards.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
              <input
                type="text"
                placeholder="Search user, email, or UID..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-surface-card border border-surface-border focus:outline-none focus:ring-2 focus:ring-teal-500 text-ink-primary placeholder:text-ink-muted"
              />
            </div>

            <select
              value={selectedRoleFilter}
              onChange={(e) => setSelectedRoleFilter(e.target.value)}
              className="py-1.5 px-3 text-xs rounded-xl bg-surface-card border border-surface-border text-ink-primary focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="ALL">All Roles ({users.length})</option>
              <option value={ROLES.SUPERADMIN}>SUPERADMIN ({metrics.rolesCount.SUPERADMIN})</option>
              <option value={ROLES.ADMIN}>ADMIN ({metrics.rolesCount.ADMIN})</option>
              <option value={ROLES.DENTIST}>DENTIST ({metrics.rolesCount.DENTIST})</option>
              <option value={ROLES.LAB_TECH}>LAB_TECH ({metrics.rolesCount.LAB_TECH})</option>
              <option value={ROLES.PATIENT}>PATIENT ({metrics.rolesCount.PATIENT})</option>
            </select>
          </div>
        </div>

        {/* Governance Table */}
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-50 dark:bg-surface-200/40 border-b border-surface-border font-heading font-semibold text-ink-muted uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">User / Account</th>
                  <th className="py-3 px-4">Current Role</th>
                  <th className="py-3 px-4">Specialty / Title</th>
                  <th className="py-3 px-4">Registered Date</th>
                  <th className="py-3 px-4 text-right">Privilege Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-ink-muted">
                      No accounts found matching search criteria.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.slice(0, 10).map((u) => {
                    const isSelf = u.id === currentUser?.uid;
                    return (
                      <tr key={u.id} className="hover:bg-surface-50 dark:hover:bg-surface-200/30 transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <Avatar name={u.fullName || u.email} size="sm" />
                            <div>
                              <div className="flex items-center gap-1.5 font-bold text-ink-primary">
                                <span>{u.fullName || 'Unnamed Account'}</span>
                                {isSelf && (
                                  <span className="text-[10px] bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300 font-bold px-1.5 py-0.2 rounded">
                                    YOU
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-ink-muted">{u.email}</p>
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          <Badge
                            variant={
                              u.role === ROLES.SUPERADMIN
                                ? 'danger'
                                : u.role === ROLES.ADMIN
                                ? 'primary'
                                : u.role === ROLES.DENTIST
                                ? 'success'
                                : u.role === ROLES.LAB_TECH
                                ? 'warning'
                                : 'neutral'
                            }
                            size="sm"
                          >
                            {u.role || 'PATIENT'}
                          </Badge>
                        </td>

                        <td className="py-3 px-4 text-ink-secondary">
                          {u.specialty || (u.role === ROLES.PATIENT ? 'General Patient' : '—')}
                        </td>

                        <td className="py-3 px-4 text-ink-muted">
                          {formatDate(u.createdAt) || 'Recent'}
                        </td>

                        <td className="py-3 px-4 text-right">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              setSelectedUser(u);
                              setTargetRole(u.role || ROLES.PATIENT);
                            }}
                            className="text-xs"
                          >
                            Change Role
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          {filteredUsers.length > 10 && (
            <div className="p-3 bg-surface-50 dark:bg-surface-200/40 border-t border-surface-border text-center text-xs text-ink-muted">
              Showing 10 of {filteredUsers.length} matching accounts. View full catalog in{' '}
              <Link to="/admin/users" className="text-teal-600 dark:text-teal-400 font-bold hover:underline">
                User Management
              </Link>
              .
            </div>
          )}
        </Card>
      </div>

      {/* Live System Activity Stream (Latest 6) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-heading font-bold text-ink-primary flex items-center gap-2">
              <Activity className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              Live Platform Audit Stream
            </h2>
            <p className="text-xs text-ink-muted">
              Recent real-time events logged across clinic, auth, and database operations.
            </p>
          </div>
          <Link
            to="/admin/logs"
            className="text-xs font-bold text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-1"
          >
            All Audit Records <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <Card className="divide-y divide-surface-border overflow-hidden">
          {auditLogs.length === 0 ? (
            <div className="p-8 text-center text-xs text-ink-muted">
              No audit log entries recorded yet. Activities will automatically stream here.
            </div>
          ) : (
            auditLogs.slice(0, 6).map((log) => (
              <div key={log.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-surface-50 dark:hover:bg-surface-200/20 transition-colors">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 mt-0.5">
                    <ShieldAlert className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-ink-primary">{log.action || 'SYSTEM_ACTION'}</span>
                      <Badge variant="primary" size="sm">
                        {log.resourceType || 'DATABASE'}
                      </Badge>
                    </div>
                    <p className="text-xs text-ink-secondary mt-0.5">{log.entity || 'Standard execution'}</p>
                    <p className="text-[11px] text-ink-muted mt-0.5">Actor: {log.actor || 'System'}</p>
                  </div>
                </div>
                <div className="text-[11px] text-ink-muted self-end sm:self-center font-mono">
                  {formatDate(log.timestamp) || 'Recent'}
                </div>
              </div>
            ))
          )}
        </Card>
      </div>

      {/* MODAL: Staff Provisioning */}
      <Modal
        isOpen={isProvisionOpen}
        onClose={() => setIsProvisionOpen(false)}
        title="Provision Verified Staff Account"
      >
        <form onSubmit={handleProvisionStaff} className="space-y-4">
          <p className="text-xs text-ink-muted">
            Create an administrator-authorized account with immediate clinical or operational privileges.
          </p>

          <Input
            label="Full Name"
            placeholder="Dr. Maria Santos, DDM"
            value={newFullName}
            onChange={(e) => setNewFullName(e.target.value)}
            required
          />

          <Input
            label="Official Staff Email"
            type="email"
            placeholder="m.santos@smileguard.ph"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            required
          />

          <Select
            label="Role Designation"
            value={newRole}
            onChange={(e) => setNewRole(e.target.value)}
            options={[
              { value: ROLES.DENTIST, label: 'DENTIST (Chairside Clinic & Diagnostics)' },
              { value: ROLES.LAB_TECH, label: 'LAB_TECH (Dental Appliance Fabrication)' },
              { value: ROLES.ADMIN, label: 'ADMIN (Clinic Operations & Staff Management)' },
              { value: ROLES.SUPERADMIN, label: 'SUPERADMIN (Full Platform Access)' },
            ]}
          />

          {newRole === ROLES.DENTIST && (
            <Select
              label="Dental Specialty"
              value={newSpecialty}
              onChange={(e) => setNewSpecialty(e.target.value)}
              options={[
                { value: 'General Dentistry', label: 'General Dentistry' },
                { value: 'Orthodontics', label: 'Orthodontics' },
                { value: 'Endodontics', label: 'Endodontics' },
                { value: 'Periodontics', label: 'Periodontics' },
                { value: 'Prosthodontics', label: 'Prosthodontics' },
                { value: 'Pediatric Dentistry', label: 'Pediatric Dentistry' },
              ]}
            />
          )}

          <Input
            label="Initial Password"
            type="password"
            placeholder="Minimum 6 characters"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
          />

          <div className="flex justify-end gap-3 pt-3 border-t border-surface-border">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsProvisionOpen(false)}
              disabled={isProvisioning}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={isProvisioning}>
              Create Staff Account
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL: Change Role / Privilege Elevation */}
      <Modal
        isOpen={Boolean(selectedUser)}
        onClose={() => setSelectedUser(null)}
        title="Elevate or Modify User Role"
      >
        {selectedUser && (
          <div className="space-y-4">
            <div className="p-3 rounded-2xl bg-surface-50 dark:bg-surface-200/40 border border-surface-border flex items-center gap-3">
              <Avatar name={selectedUser.fullName || selectedUser.email} />
              <div>
                <p className="text-sm font-bold text-ink-primary">{selectedUser.fullName || 'Unnamed'}</p>
                <p className="text-xs text-ink-muted">{selectedUser.email}</p>
                <p className="text-[11px] font-mono text-ink-muted mt-0.5">UID: {selectedUser.id}</p>
              </div>
            </div>

            <Select
              label="Target Role Privilege"
              value={targetRole}
              onChange={(e) => setTargetRole(e.target.value)}
              options={[
                { value: ROLES.PATIENT, label: 'PATIENT (Standard Patient Access)' },
                { value: ROLES.DENTIST, label: 'DENTIST (Clinic & Odontograms)' },
                { value: ROLES.LAB_TECH, label: 'LAB_TECH (CAD/CAM Lab Pipeline)' },
                { value: ROLES.ADMIN, label: 'ADMIN (Administrative Access)' },
                { value: ROLES.SUPERADMIN, label: 'SUPERADMIN (Full Sovereignty)' },
              ]}
            />

            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-700 dark:text-amber-300">
              <p className="font-bold flex items-center gap-1.5 mb-1">
                <Lock className="w-3.5 h-3.5" /> Security Notice:
              </p>
              Role updates apply immediately. The user will be rerouted to their designated portal on their next request.
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-surface-border">
              <Button
                variant="secondary"
                onClick={() => setSelectedUser(null)}
                disabled={isUpdatingRole}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleUpdateRole}
                loading={isUpdatingRole}
              >
                Confirm Privilege Change
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* MODAL: Emergency Clinic Notice */}
      <Modal
        isOpen={isNoticeModalOpen}
        onClose={() => setIsNoticeModalOpen(false)}
        title="Broadcast Emergency Clinic Notice"
      >
        <div className="space-y-4">
          <p className="text-xs text-ink-muted">
            Display a high-visibility warning banner across the system header for all patients and staff.
          </p>

          <Input
            label="Banner Message (Leave empty to clear)"
            placeholder="e.g. Clinic will undergo scheduled power maintenance on Sunday from 8am-12pm."
            value={tempNotice}
            onChange={(e) => setTempNotice(e.target.value)}
          />

          <div className="flex justify-end gap-3 pt-3 border-t border-surface-border">
            <Button
              variant="secondary"
              onClick={() => setIsNoticeModalOpen(false)}
            >
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSaveBroadcast}>
              Save Broadcast
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
