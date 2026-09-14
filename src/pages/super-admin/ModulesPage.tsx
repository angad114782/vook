import { useState, useEffect, useCallback } from 'react';
import { modulesApi, type AppModule, type PermissionItem } from '../../api/modules';
import { toast } from 'sonner';
import { extractError } from '../../utils/errorUtils';
import {
  Layers, Shield, Users, Clock, DollarSign,
  BarChart3, FileText, Briefcase, Settings2,
  ChevronDown, Loader2, Download, UserCog,
  BookOpen,
} from 'lucide-react';

// ── helpers ───────────────────────────────────────────────────────────────────

const MODULE_ICON: Record<string, React.ComponentType<{ size?: number; color?: string }>> = {
  'Employee Management': Users,
  'Attendance': Clock,
  'Shift Management': Settings2,
  'Payroll': DollarSign,
  'Leave Management': FileText,
  'Expense Management': Briefcase,
  'Reports & Analytics': BarChart3,
};

const MODULE_COLOR: Record<string, string> = {
  'Employee Management': '#3b82f6',
  'Attendance': '#f59e0b',
  'Shift Management': '#8b5cf6',
  'Payroll': '#10b981',
  'Leave Management': '#ec4899',
  'Expense Management': '#0ea5e9',
  'Reports & Analytics': '#6366f1',
};

const ROLES = ['COMPANY_ADMIN', 'HR', 'MANAGER', 'SUPERVISOR', 'FINANCE', 'EMPLOYEE'];
const ROLE_LABELS: Record<string, string> = {
  COMPANY_ADMIN: 'Company Administrator', HR: 'HR', MANAGER: 'Manager',
  SUPERVISOR: 'Supervisor', FINANCE: 'Finance', EMPLOYEE: 'Employee',
};

const quickActions = [
  { icon: Download, label: 'Export Config' },
  { icon: UserCog,  label: 'Manage Roles' },
  { icon: Shield,   label: 'Audit Access' },
  { icon: Layers,   label: 'Module Report' },
];

// ── Toggle switch ─────────────────────────────────────────────────────────────

function Toggle({ on, onChange, disabled }: { on: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button type="button" aria-pressed={on} aria-label={on ? 'Disable module' : 'Enable module'} disabled={disabled} onClick={() => onChange(!on)}
      style={{ width: '44px', height: '44px', border: 0, background: 'transparent', position: 'relative', cursor: disabled ? 'not-allowed' : 'pointer', flexShrink: 0, padding: 0 }}>
      <span style={{ position: 'absolute', width: '40px', height: '22px', borderRadius: '11px', backgroundColor: on ? '#0d7470' : '#e2e8f0', left: '2px', top: '11px', transition: 'background 0.2s' }}>
        <span style={{ position: 'absolute', top: '3px', left: on ? '21px' : '3px', width: '16px', height: '16px', borderRadius: '50%', backgroundColor: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.25)', transition: 'left 0.2s' }} />
      </span>
    </button>
  );
}

// ── Checkbox ──────────────────────────────────────────────────────────────────

function Checkbox({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="checkbox" aria-checked={checked} onClick={() => onChange(!checked)} style={{ width: '44px', height: '44px', borderRadius: '8px', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <span style={{ width: '18px', height: '18px', borderRadius: '4px', border: `2px solid ${checked ? '#0d7470' : '#cbd5e1'}`, backgroundColor: checked ? '#0d7470' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}>
      {checked && (
        <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
          <path d="M1 4l2.5 2.5L9 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
      </span>
    </button>
  );
}

// ── Module Access Tab ─────────────────────────────────────────────────────────

function ModuleAccessTab() {
  const [companies, setCompanies] = useState<{ id: string; name: string; plan: string }[]>([]);
  const [selectedCompany, setSelectedCompany] = useState('');
  const [modules, setModules] = useState<AppModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [overrideExpiry, setOverrideExpiry] = useState('');
  const [employeeLimit, setEmployeeLimit] = useState('');

  useEffect(() => {
    modulesApi.getCompanies().then(({ data }) => {
      setCompanies(data);
      if (data.length > 0) setSelectedCompany(data[0]!.id);
      else setLoading(false);
    });
  }, []);

  const fetchModules = useCallback(async () => {
    if (!selectedCompany) return;
    setLoading(true);
    try {
      const { data } = await modulesApi.getModules(selectedCompany || undefined);
      setModules(data.modules);
    } finally {
      setLoading(false);
    }
  }, [selectedCompany]);

  useEffect(() => { if (selectedCompany) void fetchModules(); }, [fetchModules, selectedCompany]);

  const handleToggle = async (mod: AppModule, val: boolean) => {
    if (!selectedCompany) return;
    const reason = window.prompt(`Reason for ${val ? 'granting' : 'denying'} ${mod.name} access:`)?.trim();
    if (!reason) return;
    setSaving(mod.id);
    await modulesApi.toggleModule(selectedCompany, mod.id, val, reason, overrideExpiry || undefined);
    setModules((prev) => prev.map((m) => m.id === mod.id ? { ...m, isEnabled: val } : m));
    setSaving(null);
  };
  const saveLimitOverride = async () => {
    const limitValue = Number(employeeLimit); if (!selectedCompany || !Number.isFinite(limitValue) || limitValue < 1) return;
    const reason = window.prompt('Reason for changing this company employee limit:')?.trim(); if (!reason) return;
    setSaving('employee-limit');
    try { await modulesApi.createOverride({ companyId: selectedCompany, effect: 'SET_LIMIT', limitKey: 'employees', limitValue, reason, expiresAt: overrideExpiry || undefined }); toast.success('Company employee limit override saved.'); await fetchModules(); }
    catch (error) { toast.error(extractError(error, 'The limit override could not be saved.')); }
    finally { setSaving(null); }
  };

  const groupedModules = modules.reduce<Record<string, AppModule[]>>((groups, module) => {
    const category = module.category || 'Operations';
    (groups[category] ??= []).push(module);
    return groups;
  }, {});

  const selectStyle: React.CSSProperties = {
    padding: '7px 32px 7px 12px', border: '1.5px solid #e2e8f0', borderRadius: '8px',
    fontSize: '13px', color: '#374151', backgroundColor: 'white', cursor: 'pointer',
    outline: 'none', fontFamily: 'Inter, sans-serif', appearance: 'none',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Company selector */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <div style={{ position: 'relative' }}>
          <select value={selectedCompany} onChange={(e) => setSelectedCompany(e.target.value)} style={selectStyle}>
            <option value="">All Companies</option>
            {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <ChevronDown size={14} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: '#64748b', pointerEvents: 'none' }} />
        </div>
      </div>
      <div className="admin-card" style={{ padding: 14, display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 10, alignItems: 'end' }}>
        <label className="admin-label">Override expiry (optional)<input className="admin-input" type="date" value={overrideExpiry} onChange={(event) => setOverrideExpiry(event.target.value)} /></label>
        <label className="admin-label">Company employee limit<input className="admin-input" type="number" min={1} placeholder="New limit" value={employeeLimit} onChange={(event) => setEmployeeLimit(event.target.value)} /></label>
        <button className="admin-button" disabled={!selectedCompany || !employeeLimit || saving === 'employee-limit'} onClick={() => void saveLimitOverride()}>Set limit override</button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px', gap: '10px', color: '#64748b' }}>
          <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
          <span style={{ fontSize: '14px' }}>Loading modules...</span>
        </div>
      ) : (
        Object.entries(groupedModules).map(([groupName, groupMods]) => {
          if (!groupMods.length) return null;
          return (
            <div key={groupName} style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 22px', borderBottom: '1px solid #f1f5f9' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>{groupName}</h3>
                <span style={{ padding: '2px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 600, backgroundColor: '#d1fae5', color: '#065f46' }}>
                  {groupMods.length} modules
                </span>
              </div>

              {groupMods.map((mod, i) => {
                const Icon = MODULE_ICON[mod.name] ?? Layers;
                const color = MODULE_COLOR[mod.name] ?? '#64748b';
                const isOn = mod.isEnabled ?? false;
                const isSaving = saving === mod.id;

                return (
                  <div key={mod.id} style={{ padding: '18px 22px', borderBottom: i < groupMods.length - 1 ? '1px solid #f8fafc' : 'none', display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
                    <div style={{ width: '42px', height: '42px', borderRadius: '10px', backgroundColor: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Icon size={19} color={color} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', marginBottom: '3px' }}>{mod.name}</p>
                      <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '8px' }}>{mod.description}</p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '11px', color: '#475569', fontWeight: 700 }}>{mod.category}</span>
                        <span style={{ fontSize: '11px', color: '#94a3b8' }}>{mod.key}</span>
                        <span style={{ fontSize: '11px', color: '#64748b' }}>Effective access, including plan and override</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {isSaving && <Loader2 size={14} color="#94a3b8" style={{ animation: 'spin 1s linear infinite' }} />}
                      <Toggle on={isOn} onChange={(v) => void handleToggle(mod, v)} disabled={!selectedCompany || isSaving || mod.isCore} />
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })
      )}
    </div>
  );
}

// ── Module Catalogue Tab ──────────────────────────────────────────────────────

function ModuleCatalogueTab() {
  const [modules, setModules] = useState<AppModule[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await modulesApi.getModules();
      setModules(data.modules);
    } catch (err) {
      toast.error(extractError(err, 'Failed to load modules'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 22px', borderBottom: '1px solid #f1f5f9' }}>
        <div>
          <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>Module Catalogue</h3>
          <p style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>Define stable capabilities; plan versions select from this catalogue</p>
        </div>
        <span className="admin-status success">Application-defined catalogue</span>
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
          <Loader2 size={20} color="#94a3b8" style={{ animation: 'spin 1s linear infinite' }} />
        </div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: '#f8fafc' }}>
              {['Module', 'Description', 'Category / route', 'Actions', 'Status'].map((h) => (
                <th key={h} style={{ padding: '10px 20px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {modules.map((m, i) => (
              <tr key={m.id} style={{ borderTop: i > 0 ? '1px solid #f1f5f9' : 'none' }}>
                <td style={{ padding: '14px 20px', whiteSpace: 'nowrap' }}>
                  <span style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a', display: 'block' }}>{m.name}</span>
                  <span style={{ fontSize: '11px', color: '#94a3b8' }}>{m.key}</span>
                </td>
                <td style={{ padding: '14px 20px', maxWidth: '280px' }}>
                  <span style={{ fontSize: '13px', color: '#64748b' }}>{m.description ?? '—'}</span>
                </td>
                <td style={{ padding: '14px 20px' }}>
                  <span style={{ fontSize: '12px', color: '#334155', display: 'block' }}>{m.category}</span>
                  <span style={{ fontSize: '11px', color: '#94a3b8' }}>/{m.routeKey}</span>
                </td>
                <td style={{ padding: '14px 20px', whiteSpace: 'nowrap' }}>
                  <span style={{ fontSize: '11px', color: '#475569' }}>{(m.actions ?? ['VIEW']).join(' · ')}</span>
                </td>
                <td style={{ padding: '14px 20px' }}>
                  <span className={`admin-status ${m.status === 'ACTIVE' ? 'success' : 'neutral'}`}>{m.isCore ? 'CORE' : m.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

    </div>
  );
}

// ── Role Permissions Tab ──────────────────────────────────────────────────────

function RolePermissionsTab() {
  const [selectedRole, setSelectedRole] = useState('COMPANY_ADMIN');
  const [permissions, setPermissions] = useState<Record<string, PermissionItem[]>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);

  const fetchPerms = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await modulesApi.getPermissions(selectedRole);
      setPermissions(data.permissions);
    } finally {
      setLoading(false);
    }
  }, [selectedRole]);

  useEffect(() => { void fetchPerms(); }, [fetchPerms]);

  const handlePermission = async (permission: string, isGranted: boolean) => {
    setSaving(permission);
    await modulesApi.updatePermission(selectedRole, permission, isGranted);
    setPermissions((prev) => {
      const next = { ...prev };
      for (const mod of Object.keys(next)) {
        next[mod] = next[mod]!.map((p) => p.permission === permission ? { ...p, isGranted } : p);
      }
      return next;
    });
    setSaving(null);
  };

  const roleAvatarColor = (role: string) => {
    const colors = ['#6366f1', '#10b981', '#f59e0b', '#3b82f6', '#ec4899'];
    return colors[ROLES.indexOf(role) % colors.length]!;
  };

  return (
    <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
      <div style={{ width: '200px', flexShrink: 0, backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid #f1f5f9' }}>
          <p style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Roles</p>
        </div>
        {ROLES.map((role) => {
          const isActive = role === selectedRole;
          const color = roleAvatarColor(role);
          return (
            <button key={role} onClick={() => setSelectedRole(role)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', border: 'none', borderLeft: isActive ? `3px solid ${color}` : '3px solid transparent', backgroundColor: isActive ? `${color}08` : 'white', cursor: 'pointer', textAlign: 'left', fontFamily: 'Inter, sans-serif', transition: 'all 0.15s' }}>
              <div style={{ width: '30px', height: '30px', borderRadius: '50%', backgroundColor: `${color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, color, flexShrink: 0 }}>
                {role.split(' ').map((w) => w[0]).slice(0, 2).join('')}
              </div>
                <span style={{ fontSize: '13px', fontWeight: isActive ? 600 : 400, color: isActive ? color : '#374151', lineHeight: '1.3' }}>{ROLE_LABELS[role] ?? role}</span>
            </button>
          );
        })}
      </div>

      <div style={{ flex: 1, backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        <div style={{ padding: '16px 22px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>{ROLE_LABELS[selectedRole] ?? selectedRole}</p>
            <p style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>Manage permissions for this role</p>
          </div>
          {loading && <Loader2 size={16} color="#94a3b8" style={{ animation: 'spin 1s linear infinite' }} />}
        </div>

        <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {Object.entries(permissions).sort(([a], [b]) => a.localeCompare(b)).map(([modKey, perms]) => {
            if (!perms || perms.length === 0) return null;
            return (
              <div key={modKey}>
                <p style={{ fontSize: '11px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '12px' }}>
                  {modKey.replace(/_/g, ' ')}
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {perms.map((p) => {
                    const isSavingThis = saving === p.permission;
                    return (
                      <div key={p.permission} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: '8px', backgroundColor: '#f8fafc', border: '1px solid #f1f5f9' }}>
                        <span style={{ fontSize: '13px', color: '#374151', fontWeight: 500 }}>{p.permission}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {isSavingThis && <Loader2 size={13} color="#94a3b8" style={{ animation: 'spin 1s linear infinite' }} />}
                          <Checkbox checked={p.isGranted} onChange={(v) => void handlePermission(p.permission, v)} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ModulesPage() {
  const [tab, setTab] = useState<'module' | 'catalogue' | 'role'>('module');
  const [visitedTabs, setVisitedTabs] = useState<Set<'module' | 'catalogue' | 'role'>>(() => new Set(['module']));

  const selectTab = (next: 'module' | 'catalogue' | 'role') => {
    setTab(next);
    setVisitedTabs((previous) => new Set(previous).add(next));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a' }}>Modules & Access</h1>
          <p style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>Control what each company can use and who can access what</p>
        </div>
        {/* Tab switcher */}
        <div style={{ display: 'flex', border: '1.5px solid #e2e8f0', borderRadius: '9px', overflow: 'hidden', backgroundColor: 'white' }}>
          {([
            { key: 'module',    label: 'Module Access',    Icon: Layers },
            { key: 'catalogue', label: 'Module Catalogue', Icon: BookOpen },
            { key: 'role',      label: 'Role Permissions', Icon: Shield },
          ] as const).map(({ key, label, Icon }) => (
            <button key={key} onClick={() => selectTab(key)} style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '8px 18px', border: 'none', cursor: 'pointer',
              fontSize: '13px', fontWeight: 600, fontFamily: 'Inter, sans-serif',
              backgroundColor: tab === key ? '#0d7470' : 'white',
              color: tab === key ? 'white' : '#64748b',
              transition: 'all 0.15s',
            }}>
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div style={{ minHeight: 420 }}>
        {visitedTabs.has('module') && <div style={{ display: tab === 'module' ? 'block' : 'none' }}><ModuleAccessTab /></div>}
        {visitedTabs.has('catalogue') && <div style={{ display: tab === 'catalogue' ? 'block' : 'none' }}><ModuleCatalogueTab /></div>}
        {visitedTabs.has('role') && <div style={{ display: tab === 'role' ? 'block' : 'none' }}><RolePermissionsTab /></div>}
      </div>

      {/* Quick Actions */}
      <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '18px 22px' }}>
        <p style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '14px' }}>QUICK ACTIONS</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
          {quickActions.map((q) => (
            <button key={q.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', padding: '18px 12px', borderRadius: '10px', border: '1px solid #e2e8f0', backgroundColor: 'white', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}
              onMouseEnter={(e) => { const el = e.currentTarget as HTMLElement; el.style.backgroundColor = '#f8fafc'; el.style.borderColor = '#0d7470'; }}
              onMouseLeave={(e) => { const el = e.currentTarget as HTMLElement; el.style.backgroundColor = 'white'; el.style.borderColor = '#e2e8f0'; }}
            >
              <q.icon size={22} color="#0d7470" />
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#374151' }}>{q.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
