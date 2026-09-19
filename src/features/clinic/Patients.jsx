import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  Search,
  Phone,
  Calendar,
  ChevronRight,
  ShieldCheck,
  Eye,
} from 'lucide-react';
import { patientService } from '../../services/patientService';
import { Card, CardContent } from '../../components/ui/Card';
import { Avatar } from '../../components/ui/Avatar';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { TableSkeleton } from '../../components/ui/Skeleton';
import { formatDate } from '../../lib/formatters';

export function PatientsDirectory() {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  useEffect(() => {
    async function loadPatients() {
      try {
        setLoading(true);
        const list = await patientService.listPatients();
        setPatients(list);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadPatients();
  }, []);

  const filteredPatients = patients.filter(
    (p) =>
      p.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.phone.includes(searchTerm)
  );

  const totalPages = Math.ceil(filteredPatients.length / itemsPerPage) || 1;
  const displayedPatients = filteredPatients.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-heading font-extrabold text-ink-primary tracking-tight">
            Patient Directory
          </h2>
          <p className="text-sm text-ink-secondary">
            Registered dental charts, contact registries, and comprehensive medical case files.
          </p>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted" />
          <input
            type="text"
            placeholder="Search patients by name or phone..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full bg-surface-card border border-surface-border rounded-xl pl-10 pr-4 py-2 text-xs sm:text-sm text-ink-primary outline-none focus:border-teal-500"
          />
        </div>
      </div>

      {loading ? (
        <TableSkeleton rows={5} />
      ) : filteredPatients.length === 0 ? (
        <EmptyState
          title="No Patients Found"
          description="No patient accounts matched your search terms."
          icon={Users}
        />
      ) : (
        <Card className="overflow-hidden shadow-soft-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-surface-border bg-surface-50/80 dark:bg-surface-100/60 text-[11px] font-bold uppercase tracking-wider text-ink-secondary">
                  <th className="p-4 pl-6">Patient</th>
                  <th className="p-4">Contact</th>
                  <th className="p-4">Date of Birth</th>
                  <th className="p-4">Onboarding Status</th>
                  <th className="p-4 pr-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border/60 text-xs sm:text-sm">
                {displayedPatients.map((pat) => (
                  <tr
                    key={pat.id}
                    className="hover:bg-surface-50/60 dark:hover:bg-surface-100/30 transition-colors"
                  >
                    <td className="p-4 pl-6">
                      <div className="flex items-center gap-3">
                        <Avatar name={pat.fullName || pat.email} size="sm" />
                        <div>
                          <p className="font-heading font-bold text-ink-primary">
                            {pat.fullName || 'New Patient'}
                          </p>
                          <p className="text-xs text-ink-muted">{pat.email}</p>
                        </div>
                      </div>
                    </td>

                    <td className="p-4 text-ink-secondary">
                      {pat.phone || <span className="text-ink-muted italic">No phone yet</span>}
                    </td>

                    <td className="p-4 text-ink-secondary">
                      {pat.dateOfBirth ? formatDate(pat.dateOfBirth) : <span className="text-ink-muted">Pending</span>}
                    </td>

                    <td className="p-4">
                      {pat.isOnboarded ? (
                        <Badge variant="success" size="sm" showDot>
                          Verified Chart (RA 10173)
                        </Badge>
                      ) : (
                        <Badge variant="warning" size="sm" showDot>
                          Incomplete Profile
                        </Badge>
                      )}
                    </td>

                    <td className="p-4 pr-6 text-right">
                      <Link to={`/clinic/patients/${pat.id}`}>
                        <Button variant="secondary" size="sm" rightIcon={ChevronRight}>
                          View Chart
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="p-4 border-t border-surface-border flex items-center justify-between text-xs text-ink-secondary">
              <span>
                Showing page {currentPage} of {totalPages}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => p - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
