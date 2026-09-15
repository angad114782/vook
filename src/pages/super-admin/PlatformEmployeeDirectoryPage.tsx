import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, Loader2, Search, ShieldCheck, Users } from 'lucide-react';
import { toast } from 'sonner';
import { platformApi } from '../../api/platform';
import Pagination from '../../components/data/Pagination';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';

interface EmployeeRow {
  id: string;
  employeeId: string;
  name: string;
  email?: string;
  mobile?: string;
  companyId?: { id?: string; _id?: string; name: string; companyCode: string };
  department?: string;
  designation?: string;
  employmentType?: string;
  status: string;
  joiningDate?: string;
}
interface CompanyOption { id?: string; _id?: string; name: string; companyCode: string }
interface EmployeeDirectoryResponse {
  employees: EmployeeRow[];
  companies: CompanyOption[];
  pagination: { total: number; page: number; limit: number; totalPages: number };
  privacy: string;
}

const statusOptions = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'ONBOARDING', label: 'Onboarding' },
  { value: 'INACTIVE', label: 'Inactive' },
  { value: 'NOTICE_PERIOD', label: 'Notice period' },
  { value: 'TERMINATED', label: 'Terminated' },
  { value: 'ARCHIVED', label: 'Archived' },
];

function csvCell(value: unknown): string {
  let text = String(value ?? '');
  // Prevent spreadsheet applications from interpreting exported values as formulas.
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export function createEmployeeCsv(rows: EmployeeRow[]): string {
  const headers = ['Employee ID', 'Name', 'Work email', 'Mobile', 'Company', 'Company code', 'Department', 'Designation', 'Employment type', 'Status', 'Joining date'];
  const body = rows.map((employee) => [
    employee.employeeId, employee.name, employee.email, employee.mobile,
    employee.companyId?.name, employee.companyId?.companyCode,
    employee.department, employee.designation, employee.employmentType,
    employee.status, employee.joiningDate,
  ].map(csvCell).join(','));
  return ['\uFEFF' + headers.map(csvCell).join(','), ...body].join('\r\n');
}

export default function PlatformEmployeeDirectoryPage() {
  const [search, setSearch] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [status, setStatus] = useState('ALL');
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);
  const debounced = useDebouncedValue(search, 350);
  const filters = { search: debounced || undefined, companyId: companyId || undefined, status };
  const query = useQuery({
    queryKey: ['platform', 'employees', debounced, companyId, status, page],
    queryFn: () => platformApi.getEmployees<EmployeeDirectoryResponse>({ ...filters, page, limit: 25 }).then((response) => response.data),
  });

  const exportCsv = async () => {
    setExporting(true);
    try {
      const rows: EmployeeRow[] = [];
      const exportFilters = { search: search.trim() || undefined, companyId: companyId || undefined, status };
      let exportPage = 1;
      let totalPages = 1;
      do {
        const response = await platformApi.getEmployees<EmployeeDirectoryResponse>({ ...exportFilters, page: exportPage, limit: 100 });
        rows.push(...response.data.employees);
        totalPages = Math.min(response.data.pagination.totalPages || 1, 1_000);
        exportPage += 1;
      } while (exportPage <= totalPages);

      const url = URL.createObjectURL(new Blob([createEmployeeCsv(rows)], { type: 'text/csv;charset=utf-8' }));
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `platform-employees-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${rows.length} employee directory records.`);
    } catch {
      toast.error('Employee directory export failed. Try again.');
    } finally {
      setExporting(false);
    }
  };

  return <div className="admin-page">
    <header className="admin-page__header">
      <div><h1>Platform employee directory</h1><p>Restricted support visibility across company workspaces.</p></div>
      <div className="platform-employee-actions">
        <span className="health-chip"><ShieldCheck size={15} /> Super Admin only</span>
        <button className="admin-button" onClick={() => void exportCsv()} disabled={exporting || query.isLoading}>
          {exporting ? <Loader2 size={15} className="spin" /> : <Download size={15} />}
          {exporting ? 'Preparing CSV…' : 'Export CSV'}
        </button>
      </div>
    </header>

    <section className="admin-card employee-privacy-note"><Users size={18} /><div><strong>Minimum necessary directory data</strong><p>{query.data?.privacy ?? 'Work contact and employment-directory fields only. Salary, banking, documents and identity records are excluded.'}</p></div></section>

    <section className="admin-card platform-employee-filters">
      <label><Search size={15} /><input aria-label="Search employees" placeholder="Name, ID, email, mobile or designation" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} /></label>
      <select aria-label="Filter by company" value={companyId} onChange={(event) => { setCompanyId(event.target.value); setPage(1); }}><option value="">All companies</option>{query.data?.companies.map((company) => { const id = company.id ?? company._id ?? ''; return <option key={id} value={id}>{company.name} · {company.companyCode}</option>; })}</select>
      <select aria-label="Filter by status" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option value="ALL">All statuses</option>{statusOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
    </section>

    <section className="admin-card platform-employee-table">
      <table className="org-table">
        <thead><tr><th>Employee</th><th>Contact</th><th>Company</th><th>Department</th><th>Designation</th><th>Employment</th><th>Status</th><th>Joined</th></tr></thead>
        <tbody>{query.data?.employees.map((employee) => <tr key={employee.id}>
          <td><strong>{employee.name}</strong><small>{employee.employeeId}</small></td>
          <td><span>{employee.email ?? '—'}</span><small>{employee.mobile ?? 'No mobile number'}</small></td>
          <td>{employee.companyId?.name ?? '—'}<small>{employee.companyId?.companyCode}</small></td>
          <td>{employee.department ?? '—'}</td>
          <td>{employee.designation ?? '—'}</td>
          <td>{employee.employmentType ?? '—'}</td>
          <td><span className={`admin-status ${employee.status === 'ACTIVE' ? 'success' : 'neutral'}`}>{employee.status.replaceAll('_', ' ')}</span></td>
          <td>{employee.joiningDate ? new Date(employee.joiningDate).toLocaleDateString('en-IN') : '—'}</td>
        </tr>)}</tbody>
      </table>
      {query.isLoading && <div className="empty-state"><Loader2 size={22} className="spin" /><strong>Loading employees…</strong></div>}
      {!query.isLoading && !query.data?.employees.length && <div className="empty-state"><Users size={24} /><strong>No matching employees</strong></div>}
    </section>
    {query.data && <Pagination page={page} totalPages={query.data.pagination.totalPages} total={query.data.pagination.total} limit={query.data.pagination.limit} onPageChange={setPage} />}
  </div>;
}
