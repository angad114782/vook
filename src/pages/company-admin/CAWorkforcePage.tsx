import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { extractError } from '../../utils/errorUtils';
import { Search, Plus, X, ChevronDown, Loader2, CheckCircle2, Upload, Download } from 'lucide-react';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import PaginationBar from '../../components/data/Pagination';
import { useEmployees } from '../../hooks/queries/useHrQueries';
import { useCaDepartments } from '../../hooks/queries/useCaQueries';
import { useCreateEmployee } from '../../hooks/mutations/useHrMutations';
import { useProvisionEmployeeAccount } from '../../hooks/mutations/useCaMutations';
import { organizationApi } from '../../api/organization';

interface AddEmpForm {
  name: string; dept: string; designation: string; email: string; type: string; joined: string; createAccess: boolean; role: string;
}
const EMPTY_FORM: AddEmpForm = { name: '', dept: '', designation: '', email: '', type: 'Permanent', joined: '', createAccess: true, role: 'EMPLOYEE' };

const ini = (n: string) => n.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();

function parseCsv(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = []; let value = ''; let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"' && quoted && text[index + 1] === '"') { value += '"'; index += 1; }
    else if (character === '"') quoted = !quoted;
    else if (character === ',' && !quoted) { row.push(value.trim()); value = ''; }
    else if ((character === '\n' || character === '\r') && !quoted) { if (character === '\r' && text[index + 1] === '\n') index += 1; row.push(value.trim()); if (row.some(Boolean)) rows.push(row); row = []; value = ''; }
    else value += character;
  }
  row.push(value.trim()); if (row.some(Boolean)) rows.push(row); return rows;
}

const normalizeHeader = (value: string) => value.trim().replace(/[\s_-]+(.)/g, (_, letter: string) => letter.toUpperCase()).replace(/^./, (letter) => letter.toLowerCase());

export default function CAWorkforcePage() {
  const queryClient = useQueryClient();
  const [tab,        setTab]        = useState<'overview' | 'list'>('overview');
  const [deptFilter, setDeptFilter] = useState('All');
  const [search,     setSearch]     = useState('');
  const [page,       setPage]       = useState(1);
  const limit = 20;
  const [showAdd,    setShowAdd]    = useState(false);
  const [form,       setForm]       = useState<AddEmpForm>(EMPTY_FORM);
  const [addError,   setAddError]   = useState('');
  const [credentials, setCredentials] = useState<{ name: string; email: string } | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ created: number; rejected: number; errors: Array<{ row: number; field: string; message: string; values: Record<string, unknown> }> } | null>(null);

  const debouncedSearch = useDebouncedValue(search, 500);

  const empParams: Record<string, string> = { page: String(page), limit: String(limit) };
  if (debouncedSearch) empParams.search = debouncedSearch;
  if (deptFilter !== 'All') empParams.department = deptFilter;

  const { data: empData, isLoading: loading } = useEmployees(empParams);
  const { data: deptsData } = useCaDepartments();
  const createEmployee = useCreateEmployee();
  const provisionAccount = useProvisionEmployeeAccount();

  const employees  = empData?.employees  ?? [];
  const stats      = empData?.stats      ?? { total: 0, active: 0, inactive: 0, departments: 0 };
  const pagination = empData?.pagination ?? { total: 0, page: 1, limit: 20, totalPages: 1 };
  const depts      = (deptsData ?? []).filter((d) => d.isActive);

  const handleSearchChange = (v: string) => { setSearch(v); setPage(1); };
  const handleDeptFilter   = (d: string) => { setDeptFilter(d); setPage(1); };

  const handleAddEmployee = () => {
    if (!form.name || !form.dept || (form.createAccess && !form.email)) { setAddError('Name, department, and an email when creating access are required'); return; }
    setAddError('');
    createEmployee.mutate(
      {
        name: form.name,
        email: form.email,
        departmentId: form.dept,
        designation: form.designation,
        joiningDate: form.joined,
        employmentType: form.type,
        createAccess: form.createAccess,
        role: form.role,
      },
      {
        onSuccess: () => {
          setShowAdd(false);
          setForm(EMPTY_FORM);
          if (form.createAccess) setCredentials({ name: form.name, email: form.email });
          toast.success('Employee created');
        },
        onError: (err) => {
          setAddError(extractError(err, 'Failed to create employee'));
        },
      },
    );
  };

  const maxBar = Math.max(...depts.map((d) => d.total), 1);

  const importFile = async (file?: File) => {
    if (!file) return;
    setImporting(true); setImportResult(null);
    try {
      let cells: string[][];
      if (file.name.toLowerCase().endsWith('.csv')) cells = parseCsv(await file.text());
      else {
        const ExcelJS = await import('exceljs'); const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(await file.arrayBuffer()); const sheet = workbook.worksheets[0];
        if (!sheet) throw new Error('The workbook has no worksheet.');
        cells = [];
        sheet.eachRow((row) => { const values: string[] = []; for (let column = 1; column <= row.cellCount; column += 1) { const cell = row.getCell(column); values.push(cell.value instanceof Date ? cell.value.toISOString().slice(0, 10) : cell.text.trim()); } cells.push(values); });
      }
      if (cells.length < 2) throw new Error('Add a header row and at least one employee.');
      const headers = cells[0].map(normalizeHeader);
      const rows = cells.slice(1).map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ''])));
      const response = await organizationApi.importEmployees(rows);
      setImportResult(response.data); await queryClient.invalidateQueries({ queryKey: ['hr', 'employees'] }); await queryClient.invalidateQueries({ queryKey: ['ca', 'departments'] });
      toast.success(`${response.data.created} employees imported${response.data.rejected ? `; ${response.data.rejected} need correction` : ''}.`);
    } catch (error: any) { toast.error(error.response?.data?.message ?? error.message ?? 'Unable to import employees.'); }
    finally { setImporting(false); }
  };

  const downloadErrors = () => {
    if (!importResult?.errors.length) return;
    const csv = [['row', 'field', 'message', 'values'], ...importResult.errors.map((error) => [String(error.row), error.field, error.message, JSON.stringify(error.values)])].map((row) => row.map((value) => `"${value.replace(/"/g, '""')}"`).join(',')).join('\n');
    const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); link.download = 'employee-import-errors.csv'; link.click(); URL.revokeObjectURL(link.href);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div>
        <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a' }}>Workforce</h1>
        <p style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>Manage your company's employees and organizational structure.</p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', backgroundColor: '#f1f5f9', borderRadius: '8px', padding: '3px', width: 'fit-content' }}>
        {(['overview', 'list'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} style={{ padding: '6px 14px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 600, fontFamily: 'Inter, sans-serif', backgroundColor: tab === t ? 'white' : 'transparent', color: tab === t ? '#0d4a47' : '#64748b', boxShadow: tab === t ? '0 1px 4px rgba(0,0,0,0.08)' : 'none' }}>
            {t === 'overview' ? 'Overview' : 'Employee List'}
          </button>
        ))}
      </div>

      {loading && tab === 'overview' ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}><Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} color="#0d7470" /></div>
      ) : tab === 'overview' ? (
        <>
          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
            {[
              { label: 'Total Employees', value: stats.total,       color: '#0d7470' },
              { label: 'Active',          value: stats.active,      color: '#2563eb' },
              { label: 'Inactive',        value: stats.inactive,    color: '#d97706' },
              { label: 'Departments',     value: stats.departments, color: '#6366f1' },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ backgroundColor: 'white', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '14px 16px' }}>
                <p style={{ fontSize: '28px', fontWeight: 800, color, lineHeight: 1 }}>{value}</p>
                <p style={{ fontSize: '11px', fontWeight: 600, color: '#374151', marginTop: '4px' }}>{label}</p>
              </div>
            ))}
          </div>

          {/* Dept bar chart */}
          <div style={{ backgroundColor: 'white', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '16px 18px' }}>
            <h3 style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', marginBottom: '14px' }}>Headcount by Department</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {depts.map((d) => (
                <div key={d.name}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '11px', color: '#374151', fontWeight: 500 }}>{d.name}</span>
                    <span style={{ fontSize: '10px', color: '#64748b' }}>{d.total}</span>
                  </div>
                  <div style={{ height: '10px', backgroundColor: '#f1f5f9', borderRadius: '5px', overflow: 'hidden' }}>
                    <div style={{ width: `${(d.total / maxBar) * 100}%`, height: '100%', backgroundColor: '#0d7470' }} />
                  </div>
                </div>
              ))}
              {depts.length === 0 && <p style={{ fontSize: '12px', color: '#94a3b8', textAlign: 'center', padding: '16px' }}>No department data available</p>}
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Controls */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {['All', ...depts.map((d) => d.name)].map((d) => (
                <button key={d} onClick={() => handleDeptFilter(d)} style={{ padding: '5px 11px', borderRadius: '20px', border: `1px solid ${deptFilter === d ? '#0d7470' : '#e2e8f0'}`, backgroundColor: deptFilter === d ? '#0d7470' : 'white', color: deptFilter === d ? 'white' : '#374151', fontSize: '11px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
                  {d}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <div style={{ position: 'relative' }}>
                <Search size={13} style={{ position: 'absolute', left: '9px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input value={search} onChange={(e) => handleSearchChange(e.target.value)} placeholder="Search employee…" style={{ paddingLeft: '30px', paddingRight: '10px', paddingTop: '7px', paddingBottom: '7px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '12px', outline: 'none', fontFamily: 'Inter, sans-serif', color: '#374151', width: '180px' }} />
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, minHeight: 34, padding: '7px 12px', border: '1px solid #cbd5e1', borderRadius: 8, background: 'white', color: '#334155', fontSize: 12, fontWeight: 600, cursor: importing ? 'wait' : 'pointer' }}>{importing ? <Loader2 size={13} /> : <Upload size={13} />} Import CSV/XLSX<input type="file" accept=".csv,.xlsx" hidden disabled={importing} onChange={(event) => { void importFile(event.target.files?.[0]); event.currentTarget.value = ''; }} /></label>
              <button onClick={() => setShowAdd(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', backgroundColor: '#0d7470', color: 'white', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
                <Plus size={13} /> Add Employee
              </button>
            </div>
          </div>

          {importResult && <div role="status" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '11px 13px', borderRadius: 9, background: importResult.rejected ? '#fff7ed' : '#ecfdf5', color: importResult.rejected ? '#9a3412' : '#047857', fontSize: 12 }}><span><strong>{importResult.created}</strong> created · <strong>{importResult.rejected}</strong> rejected. Expected columns: name, email, departmentCode, designation, joiningDate, employmentType.</span>{importResult.rejected > 0 && <button className="admin-button admin-button--secondary" onClick={downloadErrors}><Download size={14} /> Download errors</button>}</div>}

          {/* Table */}
          <div style={{ backgroundColor: 'white', borderRadius: '10px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
            {loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}><Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} color="#0d7470" /></div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc' }}>
                    {['ID', 'Name', 'Department', 'Designation', 'Type', 'Access', 'Status'].map((h) => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid #e2e8f0' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {employees.map((e, i) => (
                    <tr key={e.id} style={{ backgroundColor: i % 2 === 0 ? 'white' : '#fafafa' }}>
                      <td style={{ padding: '10px 14px', fontSize: '11px', color: '#94a3b8', fontFamily: 'monospace', borderBottom: '1px solid #f1f5f9' }}>{e.employeeId}</td>
                      <td style={{ padding: '10px 14px', borderBottom: '1px solid #f1f5f9' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: '#f0fdfa', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, color: '#0d7470', flexShrink: 0 }}>{ini(e.user.name)}</div>
                          <span style={{ fontSize: '12px', fontWeight: 600, color: '#0f172a' }}>{e.user.name}</span>
                        </div>
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: '12px', color: '#374151', borderBottom: '1px solid #f1f5f9' }}>{e.department ?? '—'}</td>
                      <td style={{ padding: '10px 14px', fontSize: '12px', color: '#374151', borderBottom: '1px solid #f1f5f9' }}>{e.designation ?? '—'}</td>
                      <td style={{ padding: '10px 14px', borderBottom: '1px solid #f1f5f9' }}>
                        <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 600, backgroundColor: e.employmentType === 'Permanent' ? '#eff6ff' : '#fef3c7', color: e.employmentType === 'Permanent' ? '#2563eb' : '#d97706' }}>{e.employmentType}</span>
                      </td>
                      <td style={{ padding: '10px 14px', borderBottom: '1px solid #f1f5f9' }}>{e.user.accountStatus === 'NOT_CREATED' ? <button onClick={() => provisionAccount.mutate({ id: e.id, data: { email: e.user.email || undefined } }, { onSuccess: () => toast.success('Account provisioned') })} style={{ padding:'4px 7px', border:'1px solid #0d7470', borderRadius:6, background:'white', color:'#0d7470', cursor:'pointer', fontSize:10, fontWeight:700 }}>Provision access</button> : <span style={{ fontSize: '10px', fontWeight: 700, color: e.user.accountStatus === 'INVITED' ? '#b45309' : '#15803d' }}>{e.user.accountStatus === 'INVITED' ? 'Invited' : 'Active'}</span>}</td>
                      <td style={{ padding: '10px 14px', borderBottom: '1px solid #f1f5f9' }}>
                        <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 600, backgroundColor: e.status === 'Active' ? '#f0fdf4' : '#fef2f2', color: e.status === 'Active' ? '#16a34a' : '#dc2626' }}>{e.status}</span>
                      </td>
                    </tr>
                  ))}
                  {employees.length === 0 && (
                    <tr><td colSpan={7} style={{ padding: '40px', textAlign: 'center', fontSize: '13px', color: '#94a3b8' }}>No employees found</td></tr>
                  )}
                </tbody>
              </table>
            )}
          </div>

          <PaginationBar page={pagination.page} totalPages={pagination.totalPages} total={pagination.total} limit={limit} onPageChange={(p) => setPage(p)} />
        </>
      )}

      {/* Add Employee Slide-in Panel */}
      {showAdd && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100 }}>
          <div onClick={() => setShowAdd(false)} style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.3)' }} />
          <div style={{ position: 'absolute', right: 0, top: 0, height: '100%', width: '380px', backgroundColor: 'white', boxShadow: '-4px 0 24px rgba(0,0,0,0.12)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '18px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>Add Employee</h2>
                <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>Login access is activated through a time-limited email invitation</p>
              </div>
              <button onClick={() => { setShowAdd(false); setAddError(''); setForm(EMPTY_FORM); }} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={16} color="#64748b" /></button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
              {addError && <div style={{ padding: '10px', borderRadius: '8px', backgroundColor: '#fef2f2', color: '#b91c1c', fontSize: '12px', marginBottom: '14px' }}>{addError}</div>}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {([
                  { label: 'Full Name *', key: 'name', type: 'text', placeholder: 'Rahul Sharma' },
                  { label: 'Email Address *', key: 'email', type: 'email', placeholder: 'rahul@company.com' },
                  { label: 'Designation', key: 'designation', type: 'text', placeholder: 'Software Engineer' },
                  { label: 'Date of Joining', key: 'joined', type: 'date', placeholder: '' },
                ] as const).map(({ label, key, type, placeholder }) => (
                  <div key={key}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>{label}</label>
                    <input type={type} value={form[key]} onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))} placeholder={placeholder} style={{ width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '7px', fontSize: '12px', outline: 'none', fontFamily: 'Inter, sans-serif', color: '#374151', boxSizing: 'border-box' }} />
                  </div>
                ))}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>Department</label>
                  <div style={{ position: 'relative' }}>
                    <select value={form.dept} onChange={(e) => setForm((p) => ({ ...p, dept: e.target.value }))} style={{ width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '7px', fontSize: '12px', outline: 'none', fontFamily: 'Inter, sans-serif', color: '#374151', appearance: 'none', backgroundColor: 'white' }}>
                      <option value="">Select department</option>
                      {depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                    <ChevronDown size={12} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }} />
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>Employment Type</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {['Permanent', 'Contract'].map((t) => (
                      <button key={t} onClick={() => setForm((p) => ({ ...p, type: t }))} style={{ flex: 1, padding: '8px', border: `1.5px solid ${form.type === t ? '#0d7470' : '#e2e8f0'}`, borderRadius: '7px', backgroundColor: form.type === t ? '#f0fdfa' : 'white', color: form.type === t ? '#0d7470' : '#374151', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ padding: '11px', border: '1px solid #e2e8f0', borderRadius: '8px', background: '#f8fafc' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: 600, color: '#374151', cursor: 'pointer' }}><input type="checkbox" checked={form.createAccess} onChange={(e) => setForm((p) => ({ ...p, createAccess: e.target.checked }))} /> Create login access now</label>
                  <p style={{ fontSize: '11px', color: '#64748b', margin: '5px 0 0 24px' }}>You can provision access later from the employee record.</p>
                  {form.createAccess && <select value={form.role} onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))} style={{ margin: '10px 0 0 24px', padding: '6px 8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12px' }}>{['EMPLOYEE','SUPERVISOR','MANAGER','HR','FINANCE'].map((r) => <option key={r}>{r}</option>)}</select>}
                </div>
              </div>
            </div>
            <div style={{ padding: '16px 20px', borderTop: '1px solid #e2e8f0', display: 'flex', gap: '10px' }}>
              <button onClick={() => { setShowAdd(false); setAddError(''); setForm(EMPTY_FORM); }} style={{ flex: 1, padding: '9px', border: '1px solid #e2e8f0', borderRadius: '8px', backgroundColor: 'white', color: '#374151', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>Cancel</button>
              <button onClick={handleAddEmployee} disabled={createEmployee.isPending} style={{ flex: 1, padding: '9px', border: 'none', borderRadius: '8px', backgroundColor: createEmployee.isPending ? '#94a3b8' : '#0d7470', color: 'white', fontSize: '12px', fontWeight: 600, cursor: createEmployee.isPending ? 'not-allowed' : 'pointer', fontFamily: 'Inter, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                {createEmployee.isPending ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : null}
                Add Employee
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invitation confirmation */}
      {credentials && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '24px' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '16px', width: '100%', maxWidth: '420px', boxShadow: '0 20px 60px rgba(0,0,0,0.18)', overflow: 'hidden' }}>
            <div style={{ padding: '24px 24px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                <CheckCircle2 size={22} color="#16a34a" />
                <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>Employee Created</h2>
              </div>
              <p style={{ fontSize: '13px', color: '#64748b', lineHeight: 1.6, marginBottom: '20px' }}>
                An invitation was created for this employee. They will verify their email and choose their own password; no password is disclosed to administrators.
              </p>
            </div>
            <div style={{ margin: '0 24px', borderRadius: '10px', border: '1px solid #e2e8f0', overflow: 'hidden', marginBottom: '20px' }}>
              {[
                { label: 'Name', value: credentials.name },
                { label: 'Email', value: credentials.email },
              ].map(({ label, value }) => (
                <div key={label} style={{ display: 'flex', padding: '11px 16px', borderBottom: '1px solid #f1f5f9', gap: '12px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#94a3b8', width: '70px', flexShrink: 0 }}>{label}</span>
                  <span style={{ fontSize: '13px', color: '#0f172a', fontWeight: 500 }}>{value}</span>
                </div>
              ))}
            </div>
            <div style={{ padding: '0 24px 24px' }}>
              <button onClick={() => setCredentials(null)} style={{ width: '100%', padding: '11px', backgroundColor: '#0d7470', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>Done</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
