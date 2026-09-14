import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { type Employee } from '../../api/hr';
import { Search, Plus, Edit2, X, ChevronDown, Loader2 } from 'lucide-react';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { extractError } from '../../utils/errorUtils';
import { useEmployees } from '../../hooks/queries/useHrQueries';
import { useCreateEmployee, useUpdateEmployee } from '../../hooks/mutations/useHrMutations';
import PaginationBar from '../../components/data/Pagination';

const DEPARTMENTS = ['Engineering', 'Sales', 'Marketing', 'HR', 'Design', 'Finance'];
const SHIFTS = ['Morning', 'Evening', 'Night'];

const avatarColors = [
  { bg: '#eef2ff', color: '#6366f1' }, { bg: '#f5f3ff', color: '#8b5cf6' },
  { bg: '#f0f9ff', color: '#0ea5e9' }, { bg: '#f0fdf4', color: '#10b981' },
  { bg: '#fffbeb', color: '#f59e0b' }, { bg: '#fdf4ff', color: '#ec4899' },
];
const getAv = (name?: string) => avatarColors[(name ?? 'H').charCodeAt(0) % avatarColors.length]!;
const initials = (name?: string) => (name ?? 'User').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const fmtCurrency = (n: number | null) => n ? `₹${(n / 100000).toFixed(1)}L` : '—';

// ── Add/Edit Modal ─────────────────────────────────────────────────────────────

function EmployeeModal({ emp, onClose }: { emp?: Employee; onClose: () => void }) {
  const isEdit = !!emp;
  const [form, setForm] = useState({
    name: emp?.user.name ?? '', email: emp?.user.email ?? '',
    department: emp?.department ?? '', designation: emp?.designation ?? '',
    shiftType: emp?.shiftType ?? 'Morning', shiftTiming: emp?.shiftTiming ?? '09:00-18:00',
    joiningDate: emp?.joiningDate ? emp.joiningDate.slice(0, 10) : '',
    annualCtc: emp?.annualCtc ? String(emp.annualCtc) : '',
    employmentType: emp?.employmentType ?? 'Permanent',
    accountHolder: emp?.accountHolder ?? '', bankName: emp?.bankName ?? '', branchName: emp?.branchName ?? '',
  });
  const [error, setError] = useState('');
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const createEmployee = useCreateEmployee();
  const updateEmployee = useUpdateEmployee();
  const loading = createEmployee.isPending || updateEmployee.isPending;

  const handleSubmit = () => {
    if (!form.name || (!isEdit && !form.email)) { setError('Name and email are required'); return; }
    setError('');
    if (isEdit) {
      updateEmployee.mutate({ id: emp!.id, data: form as Record<string, string> }, {
        onSuccess: () => onClose(),
        onError: (err) => setError(extractError(err, 'Failed to save employee')),
      });
    } else {
      createEmployee.mutate(form as Record<string, string>, {
        onSuccess: () => { toast.success('Employee added'); onClose(); },
        onError: (err) => setError(extractError(err, 'Failed to save employee')),
      });
    }
  };

  const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 10px', border: '1.5px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', outline: 'none', fontFamily: 'Inter, sans-serif', color: '#0f172a' };
  const labelStyle: React.CSSProperties = { fontSize: '11px', fontWeight: 700, color: '#64748b', marginBottom: '4px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.3px' };

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', zIndex: 1000 }}>
      <div style={{ backgroundColor: 'white', width: '480px', height: '100vh', overflowY: 'auto', boxShadow: '-8px 0 32px rgba(0,0,0,0.12)' }}>
        {/* Header */}
        <div style={{ padding: '20px 24px', background: 'linear-gradient(135deg, #0d4a47, #0d7470)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'white' }}>{isEdit ? 'Edit Employee' : 'Add Employee'}</h2>
            <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', marginTop: '2px' }}>Add a new permanent or contract workforce profile</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.7)' }}><X size={20} /></button>
        </div>

        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {error && <div style={{ padding: '10px', borderRadius: '8px', backgroundColor: '#fef2f2', color: '#b91c1c', fontSize: '13px' }}>{error}</div>}

          {/* Basic Details */}
          <div>
            <p style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', marginBottom: '12px', paddingBottom: '8px', borderBottom: '1px solid #f1f5f9' }}>Basic Details</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div><label style={labelStyle}>Full Name *</label><input value={form.name} onChange={(e) => set('name', e.target.value)} disabled={isEdit} placeholder="e.g. Ankita Yadav" style={{ ...inputStyle, opacity: isEdit ? 0.7 : 1 }} /></div>
                <div><label style={labelStyle}>Date of Joining</label><input type="date" value={form.joiningDate} onChange={(e) => set('joiningDate', e.target.value)} style={inputStyle} /></div>
              </div>
              {!isEdit && <div><label style={labelStyle}>Email *</label><input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="employee@company.com" style={inputStyle} /></div>}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>Shift Type</label>
                  <div style={{ position: 'relative' }}>
                    <select value={form.shiftType} onChange={(e) => set('shiftType', e.target.value)} style={{ ...inputStyle, appearance: 'none', paddingRight: '28px' }}>
                      {SHIFTS.map((s) => <option key={s}>{s}</option>)}
                    </select>
                    <ChevronDown size={13} style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }} />
                  </div>
                </div>
                <div><label style={labelStyle}>Shift Timing</label><input value={form.shiftTiming} onChange={(e) => set('shiftTiming', e.target.value)} placeholder="09:00-18:00" style={inputStyle} /></div>
              </div>
              <div>
                <label style={labelStyle}>Employment Type</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {['Permanent', 'Contract'].map((t) => (
                    <button key={t} onClick={() => set('employmentType', t)} style={{ padding: '6px 16px', borderRadius: '20px', border: `1.5px solid ${form.employmentType === t ? '#0d7470' : '#e2e8f0'}`, backgroundColor: form.employmentType === t ? '#0d7470' : 'white', color: form.employmentType === t ? 'white' : '#374151', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>{t}</button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Work Assignment */}
          <div>
            <p style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', marginBottom: '12px', paddingBottom: '8px', borderBottom: '1px solid #f1f5f9' }}>Work Assignment</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={labelStyle}>Department / Unit</label>
                <div style={{ position: 'relative' }}>
                  <select value={form.department} onChange={(e) => set('department', e.target.value)} style={{ ...inputStyle, appearance: 'none', paddingRight: '28px' }}>
                    <option value="">Select</option>
                    {DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}
                  </select>
                  <ChevronDown size={13} style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }} />
                </div>
              </div>
              <div><label style={labelStyle}>Role / Designation</label><input value={form.designation} onChange={(e) => set('designation', e.target.value)} placeholder="e.g. UI/UX Designer" style={inputStyle} /></div>
              <div style={{ gridColumn: '1 / -1' }}><label style={labelStyle}>Annual CTC (₹)</label><input type="number" value={form.annualCtc} onChange={(e) => set('annualCtc', e.target.value)} placeholder="e.g. 1200000" style={inputStyle} /></div>
            </div>
          </div>

          {/* Bank Details */}
          <div>
            <p style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', marginBottom: '12px', paddingBottom: '8px', borderBottom: '1px solid #f1f5f9' }}>Bank Account Details</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div><label style={labelStyle}>Account Holder Name</label><input value={form.accountHolder} onChange={(e) => set('accountHolder', e.target.value)} style={inputStyle} /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div><label style={labelStyle}>Bank Name</label><input value={form.bankName} onChange={(e) => set('bankName', e.target.value)} placeholder="e.g. HDFC Bank" style={inputStyle} /></div>
                <div><label style={labelStyle}>Branch Name</label><input value={form.branchName} onChange={(e) => set('branchName', e.target.value)} style={inputStyle} /></div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ padding: '16px 24px', borderTop: '1px solid #f1f5f9', display: 'flex', gap: '10px', justifyContent: 'flex-end', position: 'sticky', bottom: 0, backgroundColor: 'white' }}>
          <button onClick={onClose} style={{ padding: '9px 18px', border: '1.5px solid #e2e8f0', borderRadius: '8px', backgroundColor: 'white', color: '#374151', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>Cancel</button>
          <button onClick={handleSubmit} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 20px', backgroundColor: '#0d7470', border: 'none', borderRadius: '8px', color: 'white', fontSize: '13px', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'Inter, sans-serif', opacity: loading ? 0.7 : 1 }}>
            {loading && <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />}
            {isEdit ? 'Save Changes' : 'Add Employee'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function EmployeesPage() {
  const [urlParams, setUrlParams] = useSearchParams();
  const search = urlParams.get('search') ?? '';
  const deptFilter = urlParams.get('department') ?? 'ALL';
  const page = Math.max(1, Number(urlParams.get('page') ?? '1') || 1);
  const limit = 20;
  const [modal, setModal] = useState<{ open: boolean; emp?: Employee }>({ open: false });

  const debouncedSearch = useDebouncedValue(search, 500);

  const params: Record<string, string> = { page: String(page), limit: String(limit) };
  if (debouncedSearch) params.search = debouncedSearch;
  if (deptFilter !== 'ALL') params.department = deptFilter;

  const { data, isLoading } = useEmployees(params);
  const employees = data?.employees ?? [];
  const stats = data?.stats ?? { total: 0, active: 0, inactive: 0, departments: 0 };
  const pagination = data?.pagination ?? { page, totalPages: 1, total: stats.total, limit };

  const updateUrl = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(urlParams);
    Object.entries(changes).forEach(([key, value]) => value ? next.set(key, value) : next.delete(key));
    setUrlParams(next, { replace: true });
  };
  const handleSearchChange = (value: string) => updateUrl({ search: value || null, page: '1' });
  const handleDeptChange = (dept: string) => updateUrl({ department: dept === 'ALL' ? null : dept, page: '1' });


  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a' }}>Employee List</h1>
          <p style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>Manage and track all employee information</p>
        </div>
        <button onClick={() => setModal({ open: true })} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 18px', backgroundColor: '#0d7470', border: 'none', borderRadius: '9px', color: 'white', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
          <Plus size={15} /> Add Employee
        </button>
      </div>

      {/* Department tabs */}
      <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '12px 16px', borderBottom: '1px solid #f1f5f9', flexWrap: 'wrap' }}>
          {['ALL', ...DEPARTMENTS].map((d) => (
            <button key={d} onClick={() => handleDeptChange(d)} style={{ padding: '5px 14px', borderRadius: '20px', border: '1px solid transparent', backgroundColor: deptFilter === d ? '#0d7470' : '#f1f5f9', color: deptFilter === d ? 'white' : '#475569', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
              {d === 'ALL' ? 'All' : d}
            </button>
          ))}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
            <div style={{ position: 'relative' }}>
              <Search size={13} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input value={search} onChange={(e) => handleSearchChange(e.target.value)} placeholder="Search by name..." style={{ paddingLeft: '32px', paddingRight: '10px', paddingTop: '7px', paddingBottom: '7px', border: '1.5px solid #e2e8f0', borderRadius: '8px', fontSize: '12px', outline: 'none', fontFamily: 'Inter, sans-serif', color: '#374151' }} />
            </div>
          </div>
        </div>

        {/* Table */}
        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '60px', gap: '10px', color: '#64748b' }}>
            <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} /><span style={{ fontSize: '14px' }}>Loading...</span>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc' }}>
                  {['Employee Name', 'Role', 'Joining Date', 'Contact Information', 'Status', ''].map((h) => (
                    <th key={h} style={{ textAlign: 'left', padding: '10px 18px', fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.4px', borderBottom: '1px solid #f1f5f9', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {employees.map((e, i) => {
                  const av = getAv(e.user.name);
                  return (
                    <tr key={e.id} onClick={() => setModal({ open: true, emp: e })} style={{ borderBottom: i < employees.length - 1 ? '1px solid #f8fafc' : 'none', cursor: 'pointer' }}>
                      <td style={{ padding: '13px 18px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ width: '34px', height: '34px', borderRadius: '50%', backgroundColor: av.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: av.color, fontWeight: 700, fontSize: '11px', flexShrink: 0 }}>{initials(e.user.name)}</div>
                          <div>
                            <p style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>{e.user.name}</p>
                            <p style={{ fontSize: '11px', color: '#94a3b8' }}>{e.employeeId} • {e.department}</p>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '13px 18px' }}><span style={{ fontSize: '13px', color: '#374151' }}>{e.designation ?? '—'}</span></td>
                      <td style={{ padding: '13px 18px' }}><span style={{ fontSize: '13px', color: '#374151' }}>{fmtDate(e.joiningDate)}</span></td>
                      <td style={{ padding: '13px 18px' }}>
                        <p style={{ fontSize: '12px', color: '#374151' }}>{e.user.email}</p>
                        <p style={{ fontSize: '11px', color: '#94a3b8' }}>{fmtCurrency(e.annualCtc)} CTC</p>
                      </td>
                      <td style={{ padding: '13px 18px' }}>
                        <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 600, backgroundColor: e.status === 'Active' ? '#dcfce7' : '#f1f5f9', color: e.status === 'Active' ? '#15803d' : '#475569' }}>{e.status}</span>
                      </td>
                      <td style={{ padding: '13px 18px' }}>
                        <button onClick={(e2) => { e2.stopPropagation(); setModal({ open: true, emp: e }); }} style={{ width: '30px', height: '30px', borderRadius: '7px', border: '1px solid #e2e8f0', backgroundColor: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b' }}><Edit2 size={13} /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div style={{ padding: '12px 18px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '13px', color: '#64748b' }}>Total: <strong>{stats.total}</strong> employees • Active: <strong>{stats.active}</strong></span>
        </div>
      </div>

      <PaginationBar page={pagination.page} totalPages={pagination.totalPages} total={pagination.total} limit={limit} onPageChange={(nextPage) => updateUrl({ page: String(nextPage) })} />

      {modal.open && <EmployeeModal emp={modal.emp} onClose={() => setModal({ open: false })} />}
    </div>
  );
}
