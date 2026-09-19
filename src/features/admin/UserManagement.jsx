import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  Shield,
  ShieldAlert,
  Search,
  CheckCircle2,
  Ban,
  RotateCcw,
  Edit,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { authService } from '../../services/authService';
import { Card, CardContent } from '../../components/ui/Card';
import { Avatar } from '../../components/ui/Avatar';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { TableSkeleton } from '../../components/ui/Skeleton';
import { ROLES } from '../../lib/roles';
import { formatDate } from '../../lib/formatters';

export function UserManagement() {
  const { user: currentUser } = useAuth();
  const toast = useToast();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Create Staff Modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newFullName, setNewFullName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState(ROLES.DENTIST);
  const [newSpecialty, setNewSpecialty] = useState('Orthodontics');
  const [newPhone, setNewPhone] = useState('+63 9');
  const [newPassword, setNewPassword] = useState('Demo1234');
  const [isCreating, setIsCreating] = useState(false);

  // Change Role Modal
  const [roleModalUser, setRoleModalUser] = useState(null);
  const [selectedRole, setSelectedRole] = useState('');

  const loadUsers = async () => {
    try {
      setLoading(true);
      const list = await authService.listUsers();
      setUsers(list);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load user registry');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleCreateStaff = async (e) => {
    e.preventDefault();
    setIsCreating(true);
    try {
      await authService.createStaffUser({
        fullName: newFullName,
        email: newEmail,
        role: newRole,
        specialty: newSpecialty,
        phone: newPhone,
        password: newPassword,
      });
      toast.success(`Created new ${newRole} account for ${newFullName}.`);
      setIsCreateOpen(false);
      setNewFullName('');
      setNewEmail('');
      await loadUsers();
    } catch (err) {
      toast.error(err.message || 'Failed to create staff account.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleUpdateRole = async () => {
    if (!roleModalUser || !selectedRole) return;
    try {
      await authService.updateUserRole(roleModalUser.id, selectedRole);
      toast.success(`Role for ${roleModalUser.fullName} updated to ${selectedRole}.`);
      setRoleModalUser(null);
      await loadUsers();
    } catch (err) {
      toast.error('Failed to update role.');
    }
  };

  const handleToggleStatus = async (userToToggle) => {
    if (userToToggle.id === currentUser?.id) {
      toast.error('You cannot deactivate your own administrative account.');
      return;
    }
    try {
      await authService.toggleUserStatus(userToToggle.id);
      toast.success(`User status updated.`);
      await loadUsers();
    } catch (err) {
      toast.error('Failed to change user status.');
    }
  };

  const filteredUsers = users.filter(
    (u) =>
      u.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.role.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-heading font-extrabold text-ink-primary tracking-tight">
            User Access & Staff Management
          </h2>
          <p className="text-sm text-ink-secondary">
            Provision clinical practitioner accounts, assign security roles, and enforce account statuses.
          </p>
        </div>

        <Button
          variant="primary"
          size="md"
          onClick={() => setIsCreateOpen(true)}
          leftIcon={UserPlus}
        >
          Add Staff Account
        </Button>
      </div>

      {/* Search Filter */}
      <Card className="p-4">
        <div className="relative w-full max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted" />
          <input
            type="text"
            placeholder="Search by name, email, or role..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-surface-base border border-surface-border rounded-xl pl-10 pr-4 py-2 text-xs sm:text-sm text-ink-primary outline-none focus:border-teal-500"
          />
        </div>
      </Card>

      {/* Users Table */}
      {loading ? (
        <TableSkeleton rows={6} />
      ) : (
        <Card className="overflow-hidden shadow-soft-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-surface-border bg-surface-50/80 dark:bg-surface-100/60 text-[11px] font-bold uppercase tracking-wider text-ink-secondary">
                  <th className="p-4 pl-6">User / Practitioner</th>
                  <th className="p-4">Assigned Role</th>
                  <th className="p-4">Contact</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 pr-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border/60 text-xs sm:text-sm">
                {filteredUsers.map((u) => (
                  <tr
                    key={u.id}
                    className={`hover:bg-surface-50/60 dark:hover:bg-surface-100/30 transition-colors ${
                      u.deactivated ? 'opacity-50 bg-slate-50 dark:bg-slate-900/40' : ''
                    }`}
                  >
                    <td className="p-4 pl-6">
                      <div className="flex items-center gap-3">
                        <Avatar name={u.fullName || u.email} size="sm" />
                        <div>
                          <p className="font-heading font-bold text-ink-primary">
                            {u.fullName}
                          </p>
                          <p className="text-xs text-ink-muted">{u.email}</p>
                          {u.specialty && (
                            <span className="text-[11px] text-teal-700 dark:text-teal-400 font-medium">
                              {u.specialty}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="p-4">
                      <span
                        className={`text-xs font-bold px-2.5 py-1 rounded-full border ${
                          u.role === ROLES.ADMIN
                            ? 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950 dark:text-purple-300'
                            : u.role === ROLES.DENTIST
                            ? 'bg-teal-100 text-teal-800 border-teal-200 dark:bg-teal-950 dark:text-teal-300'
                            : 'bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-200'
                        }`}
                      >
                        {u.role}
                      </span>
                    </td>

                    <td className="p-4 text-ink-secondary">
                      {u.phone || 'N/A'}
                    </td>

                    <td className="p-4">
                      {u.deactivated ? (
                        <Badge variant="danger" size="sm" showDot>
                          Deactivated
                        </Badge>
                      ) : (
                        <Badge variant="success" size="sm" showDot>
                          Active
                        </Badge>
                      )}
                    </td>

                    <td className="p-4 pr-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setRoleModalUser(u);
                            setSelectedRole(u.role);
                          }}
                        >
                          Change Role
                        </Button>

                        <Button
                          variant={u.deactivated ? 'outline' : 'ghost'}
                          size="sm"
                          onClick={() => handleToggleStatus(u)}
                          className={u.deactivated ? 'text-emerald-600' : 'text-rose-600 hover:text-rose-700'}
                        >
                          {u.deactivated ? 'Reactivate' : 'Deactivate'}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Create Staff Account Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Provision Clinical Staff Account"
        description="Create a verified DENTIST or ADMIN user. (Patients register themselves via public signup)."
      >
        <form onSubmit={handleCreateStaff} className="space-y-4">
          <Input
            label="Full Practitioner Name"
            placeholder="e.g. Dr. Robert Tan, DMD"
            value={newFullName}
            onChange={(e) => setNewFullName(e.target.value)}
            required
          />

          <Input
            label="Staff Email"
            type="email"
            placeholder="doctor@clinic.com"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Assigned System Role"
              value={newRole}
              onChange={(e) => setNewRole(e.target.value)}
              options={[
                { value: ROLES.DENTIST, label: 'DENTIST (Clinical Access)' },
                { value: ROLES.ADMIN, label: 'ADMIN (Full System Access)' },
              ]}
              required
            />

            <Input
              label="Specialty / Department"
              placeholder="e.g. Endodontics / Orthodontics"
              value={newSpecialty}
              onChange={(e) => setNewSpecialty(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Phone Number"
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
            />
            <Input
              label="Temporary Password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-surface-border">
            <Button variant="ghost" size="md" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={isCreating}
            >
              Create Account
            </Button>
          </div>
        </form>
      </Modal>

      {/* Change Role Modal */}
      <Modal
        isOpen={!!roleModalUser}
        onClose={() => setRoleModalUser(null)}
        title={`Change Role: ${roleModalUser?.fullName}`}
        description="Select a new security level for this user."
      >
        <div className="space-y-4">
          <Select
            label="Select Role"
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value)}
            options={[
              { value: ROLES.PATIENT, label: 'PATIENT' },
              { value: ROLES.DENTIST, label: 'DENTIST' },
              { value: ROLES.ADMIN, label: 'ADMIN' },
            ]}
          />

          <div className="flex justify-end gap-3 pt-3 border-t border-surface-border">
            <Button variant="ghost" size="md" onClick={() => setRoleModalUser(null)}>
              Cancel
            </Button>
            <Button variant="primary" size="md" onClick={handleUpdateRole}>
              Apply Role Change
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
