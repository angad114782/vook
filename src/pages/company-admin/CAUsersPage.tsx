import { ResponsiveTable } from '../../components/data/ResponsiveDataView';
import { useState } from 'react';
import { toast } from 'sonner';
import { type CAUser } from '../../api/companyAdmin';
import { Search, Plus, X, Edit2, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import PaginationBar from '../../components/data/Pagination';
import { extractError } from '../../utils/errorUtils';
import { useCaUsers } from '../../hooks/queries/useCaQueries';
import { useCreateCaUser, useUpdateCaUser } from '../../hooks/mutations/useCaMutations';
import LegacyDrawer from '../../components/ui/LegacyDrawer';

const ROLES = ['HR', 'MANAGER', 'SUPERVISOR', 'FINANCE', 'COMPANY_ADMIN'];

const ROLE_COLORS: Record<string, { bg: string; color: string }> = {
  HR:            { bg: '#f0fdfa', color: '#0d7470' },
  MANAGER:       { bg: '#eff6ff', color: '#2563eb' },
  SUPERVISOR:    { bg: '#ede9fe', color: '#7c3aed' },
  FINANCE:       { bg: '#fff7ed', color: '#ea580c' },
  EMPLOYEE:      { bg: '#f0fdf4', color: '#16a34a' },
  COMPANY_ADMIN: { bg: '#eef2ff', color: '#6366f1' },
};

const avatarColors = ['#6366f1', '#0d7470', '#7c3aed', '#ea580c', '#2563eb', '#16a34a'];
const getColor = (n?: string) => avatarColors[(n ?? 'U').charCodeAt(0) % avatarColors.length]!;
const ini = (n: string) => n.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

export default function CAUsersPage() {
  const [search,        setSearch]        = useState('');
  const [roleFilter,    setRoleFilter]    = useState('ALL');
  const [page,          setPage]          = useState(1);
  const limit = 20;
  // Add user modal
  const [showAdd,       setShowAdd]       = useState(false);
  const [form,          setForm]          = useState({ name: '', email: '', role: 'EMPLOYEE' });
  const [formError,     setFormError]     = useState('');
  // Edit user modal
  const [editModalUser, setEditModalUser] = useState<CAUser | null>(null);
  const [editForm,      setEditForm]      = useState({ role: '', isActive: true });
  // Credentials modal
  const [credentials,   setCredentials]   = useState<{ name: string; email: string } | null>(null);

  const debouncedSearch = useDebouncedValue(search, 500);

  const params: Record<string, string> = { page: String(page), limit: String(limit) };
  if (debouncedSearch) params.search = debouncedSearch;
  if (roleFilter !== 'ALL') params.role = roleFilter;

  const { data, isLoading: loading } = useCaUsers(params);
  const createUser  = useCreateCaUser();
  const updateUser  = useUpdateCaUser();

  const users      = data?.users      ?? [];
  const pagination = data?.pagination ?? { total: 0, page: 1, limit: 20, totalPages: 1 };

  const handleSearchChange = (v: string) => { setSearch(v); setPage(1); };
  const handleRoleFilter   = (r: string) => { setRoleFilter(r); setPage(1); };

  const handleAdd = () => {
    if (!form.name || !form.email) { setFormError('Name and email are required'); return; }
    setFormError('');
    createUser.mutate(
      form,
      {
        onSuccess: () => {
          setShowAdd(false);
          setForm({ name: '', email: '', role: 'EMPLOYEE' });
          setCredentials({ name: form.name, email: form.email });
        },
        onError: (err) => {
          setFormError(extractError(err, 'Failed to create user'));
        },
      },
    );
  };

  const handleEditSave = () => {
    if (!editModalUser) return;
    updateUser.mutate(
      { id: editModalUser.id, data: { role: editForm.role, isActive: editForm.isActive } },
      {
        onSuccess: () => {
          setEditModalUser(null);
          toast.success('User updated');
        },
        onError: (err) => {
          toast.error(extractError(err, 'Failed to update user'));
        },
      },
    );
  };

  const handleToggleActive = (u: CAUser) => {
    updateUser.mutate(
      { id: u.id, data: { isActive: !u.isActive } },
      {
        onSuccess: () => {
          toast.success(`User ${u.isActive ? 'deactivated' : 'activated'}`);
        },
        onError: (err) => {
          toast.error(extractError(err, 'Failed to update user status'));
        },
      },
    );
  };

  const InputStyle: React.CSSProperties = { width: '100%', padding: '9px 12px', border: '1.5px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', color: '#374151', outline: 'none', fontFamily: 'Inter, sans-serif', boxSizing: 'border-box' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a' }}>User Access</h1>
          <p style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>Manage all users in your company — assign roles, activate or deactivate accounts</p>
        </div>
        <button onClick={() => setShowAdd(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 16px', backgroundColor: '#6366f1', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
          <Plus size={14} /> Add admin account
        </button>
      </div>

      <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        {/* Filters */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '180px', maxWidth: '260px' }}>
            <Search size={13} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input value={search} onChange={(e) => handleSearchChange(e.target.value)} placeholder="Search name or email..." style={{ width: '100%', paddingLeft: '32px', paddingRight: '10px', paddingTop: '7px', paddingBottom: '7px', border: '1.5px solid #e2e8f0', borderRadius: '8px', fontSize: '12px', outline: 'none', fontFamily: 'Inter, sans-serif', color: '#374151', backgroundColor: '#f8fafc' }} />
          </div>
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
            {['ALL', ...ROLES].map((r) => (
              <button key={r} onClick={() => handleRoleFilter(r)} style={{ padding: '5px 11px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: 600, fontFamily: 'Inter, sans-serif', backgroundColor: roleFilter === r ? '#6366f1' : '#f1f5f9', color: roleFilter === r ? 'white' : '#64748b', whiteSpace: 'nowrap' }}>
                {r === 'ALL' ? 'All Roles' : r.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}><Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} color="#6366f1" /></div>
        ) : (
          <ResponsiveTable style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc' }}>
                {['Account', 'Role', 'Linked employee', 'Last sign-in', 'Status', 'Actions'].map((h) => (
                  <th key={h} style={{ textAlign: 'left', padding: '10px 16px', fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.4px', borderBottom: '1px solid #f1f5f9', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((u, i) => {
                const rc = ROLE_COLORS[u.role] ?? ROLE_COLORS['EMPLOYEE']!;
                const color = getColor(u.name);
                return (
                  <tr key={u.id} style={{ borderBottom: i < users.length - 1 ? '1px solid #f8fafc' : 'none', opacity: u.isActive ? 1 : 0.5 }}>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color, fontWeight: 700, fontSize: '11px', flexShrink: 0 }}>{ini(u.name)}</div>
                        <div>
                          <p style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>{u.name}</p>
                          <p style={{ fontSize: '11px', color: '#94a3b8' }}>{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ padding: '3px 9px', borderRadius: '20px', fontSize: '11px', fontWeight: 600, backgroundColor: rc.bg, color: rc.color, whiteSpace: 'nowrap' }}>{u.role.replace('_', ' ')}</span>
                    </td>
                    <td style={{ padding: '12px 16px' }}><span style={{ fontSize: '12px', color: '#64748b' }}>{u.employee ? `${u.employee.employeeId} · ${u.employee.department ?? 'Unassigned'}` : 'Standalone admin'}</span></td>
                    <td style={{ padding: '12px 16px' }}><span style={{ fontSize: '12px', color: '#64748b', whiteSpace: 'nowrap' }}>{u.lastLoginAt ? fmtDate(u.lastLoginAt) : 'Never'}</span></td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 9px', borderRadius: '20px', fontSize: '11px', fontWeight: 600, backgroundColor: u.isActive ? '#f0fdf4' : '#fef2f2', color: u.isActive ? '#15803d' : '#b91c1c' }}>
                        {u.isActive ? <CheckCircle2 size={10} /> : <XCircle size={10} />} {u.accountStatus === 'INVITED' ? 'Invited' : u.isActive ? 'Active' : 'Suspended'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          onClick={() => { setEditModalUser(u); setEditForm({ role: u.role, isActive: u.isActive }); }}
                          title="Edit user"
                          style={{ width: '28px', height: '28px', borderRadius: '6px', border: '1px solid #e2e8f0', backgroundColor: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#6366f1' }}
                        >
                          <Edit2 size={12} />
                        </button>
                        <button
                          onClick={() => handleToggleActive(u)}
                          title={u.isActive ? 'Deactivate' : 'Activate'}
                          style={{ width: '28px', height: '28px', borderRadius: '6px', border: 'none', backgroundColor: u.isActive ? '#fef2f2' : '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                        >
                          {u.isActive ? <XCircle size={12} color="#dc2626" /> : <CheckCircle2 size={12} color="#16a34a" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {users.length === 0 && <tr><td colSpan={6} style={{ padding: '40px', textAlign: 'center', fontSize: '13px', color: '#94a3b8' }}>No users found</td></tr>}
            </tbody>
          </ResponsiveTable>
        )}
      </div>

      <PaginationBar page={pagination.page} totalPages={pagination.totalPages} total={pagination.total} limit={limit} onPageChange={(p) => setPage(p)} />

      {/* Add User Modal */}
      {showAdd && (
        <LegacyDrawer open onClose={() => { setShowAdd(false); setFormError(''); }} direction="right" className="legacy-form-drawer">
          <div style={{ backgroundColor: 'white', borderRadius: '14px', width: '440px', maxWidth: '94vw', padding: '28px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>Add New User</h3>
              <button onClick={() => { setShowAdd(false); setFormError(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={18} /></button>
            </div>
            {formError && <div style={{ padding: '10px 14px', backgroundColor: '#fef2f2', borderRadius: '8px', color: '#dc2626', fontSize: '12px', marginBottom: '14px' }}>{formError}</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div><label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>Full Name *</label><input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="e.g. Rohit Sharma" style={InputStyle} /></div>
              <div><label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>Email Address *</label><input type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} placeholder="rohit@company.com" style={InputStyle} /></div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>Role</label>
                <select value={form.role} onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))} style={{ ...InputStyle, cursor: 'pointer', backgroundColor: 'white' }}>
                  {ROLES.map((r) => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
                </select>
              </div>
              <div style={{ padding: '10px 12px', borderRadius: 8, background: '#eff8ff', color: '#145d84', fontSize: 12 }}>A 48-hour invitation will be emailed. The user verifies their address and creates their own password.</div>
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button onClick={() => { setShowAdd(false); setFormError(''); }} style={{ flex: 1, padding: '10px', border: '1.5px solid #e2e8f0', borderRadius: '8px', backgroundColor: 'white', color: '#374151', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>Cancel</button>
              <button onClick={handleAdd} disabled={createUser.isPending} style={{ flex: 1, padding: '10px', border: 'none', borderRadius: '8px', backgroundColor: createUser.isPending ? '#a5b4fc' : '#6366f1', color: 'white', fontSize: '13px', fontWeight: 600, cursor: createUser.isPending ? 'not-allowed' : 'pointer', fontFamily: 'Inter, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                {createUser.isPending ? <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Creating...</> : 'Create User'}
              </button>
            </div>
          </div>
        </LegacyDrawer>
      )}

      {/* Edit User Modal */}
      {editModalUser && (
        <LegacyDrawer open onClose={() => setEditModalUser(null)} direction="right" className="legacy-form-drawer">
          <div style={{ backgroundColor: 'white', borderRadius: '14px', width: '460px', maxWidth: '94vw', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', overflow: 'hidden' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid #f1f5f9' }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>Edit User</h3>
                <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>Update role and account status</p>
              </div>
              <button onClick={() => setEditModalUser(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={18} /></button>
            </div>

            {/* User identity (read-only) */}
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px solid #f1f5f9' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: `${getColor(editModalUser.name)}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: getColor(editModalUser.name), fontWeight: 700, fontSize: '13px', flexShrink: 0 }}>
                  {ini(editModalUser.name)}
                </div>
                <div>
                  <p style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>{editModalUser.name}</p>
                  <p style={{ fontSize: '12px', color: '#64748b' }}>{editModalUser.email}</p>
                </div>
              </div>

              {/* Role */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Role</label>
                <select
                  value={editForm.role}
                  onChange={(e) => setEditForm((p) => ({ ...p, role: e.target.value }))}
                  style={{ ...InputStyle, cursor: 'pointer', backgroundColor: 'white' }}
                >
                  {ROLES.map((r) => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
                </select>
              </div>

              {/* Status */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Account Status</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {[{ label: 'Active', value: true, bg: '#f0fdf4', activeBg: '#16a34a', color: '#16a34a' }, { label: 'Inactive', value: false, bg: '#fef2f2', activeBg: '#dc2626', color: '#dc2626' }].map(({ label, value, bg, activeBg, color }) => (
                    <button
                      key={label}
                      onClick={() => setEditForm((p) => ({ ...p, isActive: value }))}
                      style={{ flex: 1, padding: '9px', border: `1.5px solid ${editForm.isActive === value ? activeBg : '#e2e8f0'}`, borderRadius: '8px', backgroundColor: editForm.isActive === value ? bg : 'white', color: editForm.isActive === value ? color : '#94a3b8', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding: '0 24px 24px', display: 'flex', gap: '10px' }}>
              <button onClick={() => setEditModalUser(null)} style={{ flex: 1, padding: '10px', border: '1.5px solid #e2e8f0', borderRadius: '8px', backgroundColor: 'white', color: '#374151', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>Cancel</button>
              <button onClick={handleEditSave} disabled={updateUser.isPending} style={{ flex: 1, padding: '10px', border: 'none', borderRadius: '8px', backgroundColor: updateUser.isPending ? '#a5b4fc' : '#6366f1', color: 'white', fontSize: '13px', fontWeight: 600, cursor: updateUser.isPending ? 'not-allowed' : 'pointer', fontFamily: 'Inter, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                {updateUser.isPending ? <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Saving...</> : 'Save Changes'}
              </button>
            </div>
          </div>
        </LegacyDrawer>
      )}

      {/* Invitation confirmation */}
      {credentials && (
        <LegacyDrawer open onClose={() => setCredentials(null)} direction="right" className="legacy-detail-drawer">
          <div style={{ backgroundColor: 'white', borderRadius: '16px', width: '100%', maxWidth: '420px', boxShadow: '0 20px 60px rgba(0,0,0,0.18)', overflow: 'hidden' }}>
            <div style={{ padding: '24px 24px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                <CheckCircle2 size={22} color="#16a34a" />
                <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>User Created</h2>
              </div>
              <p style={{ fontSize: '13px', color: '#64748b', lineHeight: 1.6, marginBottom: '20px' }}>
                A time-limited invitation was created. The user will verify their email and choose their own password.
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
              <button onClick={() => setCredentials(null)} style={{ width: '100%', padding: '11px', backgroundColor: '#6366f1', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>Done</button>
            </div>
          </div>
        </LegacyDrawer>
      )}
    </div>
  );
}
