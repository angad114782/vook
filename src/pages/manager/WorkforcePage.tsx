import { useState, useMemo } from 'react';
import { type Employee } from '../../api/hr';
import { Search, Loader2, X } from 'lucide-react';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import PaginationBar from '../../components/data/Pagination';
import { useMgrWorkforce } from '../../hooks/queries/useMgrQueries';
import { useAttendanceRecords } from '../../hooks/queries/useHrQueries';

const DEPT_TABS = [
  { key: 'ALL',         label: 'All'         },
  { key: 'Assembly',    label: 'Assembly'    },
  { key: 'Quality',     label: 'Quality'     },
  { key: 'Maintenance', label: 'Maintenance' },
  { key: 'Marketing',   label: 'Marketing'   },
  { key: 'R&D',         label: 'R&D'         },
  { key: 'Finance',     label: 'Finance'     },
];

const TYPE_FILTERS = ['All', 'Permanent', 'Contract'];

const avatarColors = [
  { bg: '#eef2ff', color: '#6366f1' }, { bg: '#f0fdf4', color: '#10b981' },
  { bg: '#fffbeb', color: '#f59e0b' }, { bg: '#fdf4ff', color: '#ec4899' },
  { bg: '#f0f9ff', color: '#0ea5e9' },
];
const getAv = (name?: string) => avatarColors[(name ?? 'M').charCodeAt(0) % avatarColors.length]!;
const initials = (name: string) => name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();


export default function WorkforcePage() {
  const [search,       setSearch]       = useState('');
  const [dept,         setDept]         = useState('ALL');
  const [typeFilter,   setTypeFilter]   = useState('All');
  const [page,         setPage]         = useState(1);
  const [limit]                         = useState(20);
  const [viewEmployee, setViewEmployee] = useState<Employee | null>(null);

  const debouncedSearch = useDebouncedValue(search, 500);

  const today = useMemo(() => new Date(), []);
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const todayStr = `${today.getFullYear()}-${mm}-${dd}`;

  const empParams: Record<string, string> = { page: String(page), limit: String(limit) };
  if (debouncedSearch) empParams.search = debouncedSearch;
  if (dept !== 'ALL') empParams.department = dept;
  if (typeFilter !== 'All') empParams.employmentType = typeFilter;

  const { data: empData, isLoading: loading } = useMgrWorkforce(empParams);
  const { data: attData } = useAttendanceRecords({
    year: String(today.getFullYear()),
    month: String(today.getMonth() + 1),
    limit: '500',
  });

  const employees: Employee[] = empData?.employees ?? [];
  const stats = empData?.stats ?? { total: 0, active: 0, inactive: 0, departments: 0 };
  const pagination = empData?.pagination ?? { total: 0, page: 1, limit: 20, totalPages: 1 };

  // Build present-today set from attendance records
  const presentIds = useMemo(() => {
    const ids = new Set<string>();
    attData?.records?.forEach((r) => {
      const recDate = new Date(r.date as unknown as string).toISOString().slice(0, 10);
      if (recDate === todayStr && (r.status === 'Present' || r.status === 'Late')) {
        ids.add((r.employeeId as unknown as { _id: string })._id ?? String(r.employeeId));
      }
    });
    return ids;
  }, [attData, todayStr]);

  const handleSearchChange = (v: string) => { setSearch(v); setPage(1); };
  const handleDeptChange   = (d: string) => { setDept(d); setPage(1); };
  const handleTypeChange   = (t: string) => { setTypeFilter(t); setPage(1); };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a' }}>Workforce</h1>
        <p style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>Manage and track all employee information</p>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px' }}>
        {[
          { label: 'Total Workers',   value: stats.total       },
          { label: 'Active',          value: stats.active      },
          { label: 'Inactive',        value: stats.inactive    },
          { label: 'Departments',     value: stats.departments },
        ].map(({ label, value }) => (
          <div key={label} style={{ backgroundColor: 'white', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '14px 18px' }}>
            <p style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>{label}</p>
            <p style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>{value}</p>
          </div>
        ))}
      </div>

      <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        {/* Department tabs */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {DEPT_TABS.map(({ key, label }) => (
            <button key={key} onClick={() => handleDeptChange(key)} style={{ padding: '5px 12px', borderRadius: '20px', border: '1px solid', cursor: 'pointer', fontSize: '12px', fontWeight: 600, fontFamily: 'Inter, sans-serif', transition: 'all 0.15s', borderColor: dept === key ? '#0d7470' : '#e2e8f0', backgroundColor: dept === key ? '#0d7470' : 'white', color: dept === key ? 'white' : '#374151' }}>
              {label}{key === 'ALL' ? <span style={{ opacity: 0.7 }}> {stats.total}</span> : null}
            </button>
          ))}
        </div>

        {/* Filters */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', gap: '8px', alignItems: 'center' }}>
          {/* Type toggle */}
          <div style={{ display: 'flex', border: '1.5px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden', backgroundColor: 'white' }}>
            {TYPE_FILTERS.map((t) => (
              <button key={t} onClick={() => handleTypeChange(t)} style={{ padding: '6px 14px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 600, fontFamily: 'Inter, sans-serif', backgroundColor: typeFilter === t ? '#0d7470' : 'white', color: typeFilter === t ? 'white' : '#374151', transition: 'all 0.15s' }}>{t}</button>
            ))}
          </div>
          <div style={{ position: 'relative', flex: 1, maxWidth: '280px' }}>
            <Search size={13} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input value={search} onChange={(e) => handleSearchChange(e.target.value)} placeholder="Search employee..." style={{ width: '100%', paddingLeft: '32px', paddingRight: '10px', paddingTop: '6px', paddingBottom: '6px', border: '1.5px solid #e2e8f0', borderRadius: '8px', fontSize: '12px', outline: 'none', fontFamily: 'Inter, sans-serif', color: '#374151', backgroundColor: '#f8fafc' }} />
          </div>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '60px', gap: '10px', color: '#64748b' }}><Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} /><span style={{ fontSize: '14px' }}>Loading...</span></div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc' }}>
                  {['Employee', 'Type', 'Department', 'Shift', 'Contact Info', 'Status'].map((h) => (
                    <th key={h} style={{ textAlign: 'left', padding: '10px 16px', fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.4px', borderBottom: '1px solid #f1f5f9', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {employees.map((emp, i) => {
                  const av = getAv(emp.user.name);
                  const present = presentIds.has(emp.id);
                  return (
                    <tr key={emp.id} onClick={() => setViewEmployee(emp)} style={{ borderBottom: i < employees.length - 1 ? '1px solid #f8fafc' : 'none', cursor: 'pointer' }}>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: '30px', height: '30px', borderRadius: '50%', backgroundColor: av.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: av.color, fontWeight: 700, fontSize: '10px', flexShrink: 0 }}>{initials(emp.user.name)}</div>
                          <div>
                            <p style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>{emp.user.name}</p>
                            <p style={{ fontSize: '11px', color: '#94a3b8' }}>{emp.employeeId}</p>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: 600, backgroundColor: emp.employmentType === 'Permanent' ? '#dbeafe' : '#f5f3ff', color: emp.employmentType === 'Permanent' ? '#1d4ed8' : '#6d28d9' }}>{emp.employmentType}</span>
                      </td>
                      <td style={{ padding: '12px 16px' }}><span style={{ fontSize: '13px', color: '#374151' }}>{emp.department ?? '—'}</span></td>
                      <td style={{ padding: '12px 16px' }}><span style={{ fontSize: '12px', color: '#64748b' }}>{emp.shiftType ?? '—'}</span></td>
                      <td style={{ padding: '12px 16px' }}>
                        <p style={{ fontSize: '12px', color: '#374151' }}>{emp.user.email}</p>
                        <p style={{ fontSize: '11px', color: '#94a3b8' }}>+91 XXXXX XXXXX</p>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <div style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: present ? '#16a34a' : '#dc2626' }} />
                          <span style={{ fontSize: '12px', color: present ? '#16a34a' : '#dc2626', fontWeight: 600 }}>{present ? 'Present' : 'Absent'}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <PaginationBar page={pagination.page} totalPages={pagination.totalPages} total={pagination.total} limit={limit} onPageChange={(p) => setPage(p)} />

      {viewEmployee && (() => {
        const av = getAv(viewEmployee.user.name);
        const present = presentIds.has(viewEmployee.id);
        return (
          <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ backgroundColor: 'white', borderRadius: '14px', width: '420px', maxWidth: '95vw', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
              <div style={{ padding: '20px 22px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: av.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: av.color, fontWeight: 700, fontSize: '12px' }}>{initials(viewEmployee.user.name)}</div>
                  <div>
                    <p style={{ fontWeight: 700, fontSize: '15px', color: '#0f172a' }}>{viewEmployee.user.name}</p>
                    <p style={{ fontSize: '11px', color: '#94a3b8' }}>{viewEmployee.employeeId}</p>
                  </div>
                </div>
                <button onClick={() => setViewEmployee(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}><X size={18} /></button>
              </div>
              <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {([
                  ['Department',       viewEmployee.department ?? '—'],
                  ['Employment Type',  viewEmployee.employmentType ?? '—'],
                  ['Shift',            viewEmployee.shiftType ?? '—'],
                  ['Email',            viewEmployee.user.email],
                  ['Status',           present ? 'Present' : 'Absent'],
                ] as [string, string][]).map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>{k}</span>
                    <span style={{ fontSize: '13px', color: k === 'Status' ? (present ? '#16a34a' : '#dc2626') : '#0f172a', fontWeight: 500 }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
