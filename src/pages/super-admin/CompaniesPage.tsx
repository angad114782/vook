import { ResponsiveTable } from '../../components/data/ResponsiveDataView';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { companiesApi, type Company } from '../../api/companies';
import { type PlanData } from '../../api/subscriptions';
import { extractError } from '../../utils/errorUtils';
import { getPlanBadge } from '../../utils/planColors';
import { useSaCompanies, useSaPlans } from '../../hooks/queries/useSaQueries';
import { useDeleteCompany } from '../../hooks/mutations/useSaMutations';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import AppDialog from '../../components/ui/AppDialog';
import AppDrawer from '../../components/ui/AppDrawer';
import {
  Building2, TrendingUp, Clock, AlertTriangle, Search,
  Pencil, Trash2, Loader2, ChevronLeft, ChevronRight,
} from 'lucide-react';

// Section.

const statusMeta: Record<string, { label: string; bg: string; color: string }> = {
  ACTIVE:    { label: 'Active',    bg: '#dcfce7', color: '#15803d' },
  TRIAL:     { label: 'Trial',     bg: '#fef9c3', color: '#a16207' },
  GRACE_PERIOD: { label: 'Grace Period', bg: '#ffedd5', color: '#c2410c' },
  EXPIRED:   { label: 'Expired',   bg: '#fee2e2', color: '#b91c1c' },
  SUSPENDED: { label: 'Suspended', bg: '#f1f5f9', color: '#475569' },
};

const avatarColors = [
  { bg: '#eef2ff', color: '#6366f1' }, { bg: '#f5f3ff', color: '#8b5cf6' },
  { bg: '#f0f9ff', color: '#0ea5e9' }, { bg: '#f0fdf4', color: '#10b981' },
  { bg: '#fffbeb', color: '#f59e0b' }, { bg: '#fdf4ff', color: '#ec4899' },
];

const getAvatarColor = (name?: string) => avatarColors[(name ?? 'C').charCodeAt(0) % avatarColors.length];
const initials = (name?: string) => (name ?? 'Company').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();

const isExpiringSoon = (dateStr?: string) => {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  return d > new Date() && d < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
};

const fmtDate = (dateStr?: string) => {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

// Section.

interface ModalProps {
  company: Company;
  onClose: () => void;
  onSave: () => void;
}

function CompanyModal({ company, onClose, onSave }: ModalProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: company.name,
    industry: company.industry ?? '',
    email: company.email ?? '',
    phone: company.phone ?? '',
    address: company.address ?? '',
  });

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.name.trim()) { setError('Company name is required'); return; }
    setSaving(true);
    setError('');
    try {
      await companiesApi.update(company.id, {
        name: form.name.trim(),
        industry: form.industry.trim() || undefined,
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        address: form.address.trim() || undefined,
      });
      onSave();
    } catch (reason) {
      setError(extractError(reason, 'Failed to update company'));
    } finally {
      setSaving(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '9px 12px', border: '1.5px solid #e2e8f0',
    borderRadius: '8px', fontSize: '13px', color: '#0f172a', outline: 'none',
    fontFamily: 'Inter, sans-serif', backgroundColor: 'white',
  };
  const labelStyle: React.CSSProperties = { display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '5px' };

  return (
    <AppDrawer open onOpenChange={(open) => { if (!open) onClose(); }} title="Edit company" description="Update company contact information." placement="responsive" size="md" contentClassName="company-drawer__body">
        <form onSubmit={handleSubmit} className="company-drawer__form">
          {error && <div role="alert" style={{ padding: '10px 14px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#dc2626', fontSize: '13px' }}>{error}</div>}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div><label style={labelStyle}>Company Name *</label><input required style={inputStyle} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></div>
            <div><label style={labelStyle}>Industry</label><input style={inputStyle} value={form.industry} onChange={(event) => setForm({ ...form, industry: event.target.value })} /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div><label style={labelStyle}>Email</label><input type="email" style={inputStyle} value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></div>
            <div><label style={labelStyle}>Phone</label><input style={inputStyle} value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></div>
          </div>
          <div><label style={labelStyle}>Address</label><input style={inputStyle} value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} /></div>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', paddingTop: '4px' }}>
            <button type="button" onClick={onClose} style={{ padding: '9px 20px', border: '1.5px solid #e2e8f0', borderRadius: '8px', backgroundColor: 'white', fontSize: '13px', fontWeight: 600, cursor: 'pointer', color: '#374151', fontFamily: 'Inter, sans-serif' }}>Cancel</button>
            <button type="submit" disabled={saving} style={{ padding: '9px 24px', backgroundColor: saving ? '#7ab8b6' : '#0d7470', border: 'none', borderRadius: '8px', color: 'white', fontSize: '13px', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontFamily: 'Inter, sans-serif' }}>
              {saving && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />} Save Changes
            </button>
          </div>
        </form>
    </AppDrawer>
  );
}

// ─── View Modal ──────────────────────────────────────────────────────────────
function ViewModal({ company, plans, onClose, onEdit }: { company: Company; plans: PlanData[]; onClose: () => void; onEdit: () => void }) {
  const av = getAvatarColor(company.name);
  const pm = getPlanBadge(company.plan, plans);
  const sm = statusMeta[company.status];
  const row = (label: string, value: string) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f8fafc' }}>
      <span style={{ fontSize: '13px', color: '#64748b' }}>{label}</span>
      <span style={{ fontSize: '13px', color: '#0f172a', fontWeight: 500 }}>{value}</span>
    </div>
  );

  return (
    <AppDrawer open onOpenChange={(open) => { if (!open) onClose(); }} title={company.name} description={`${company.companyCode} · ${company.industry ?? 'Company details'}`} placement="responsive" size="sm" contentClassName="company-drawer__body">
        <div style={{ padding: '4px 0 8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <div style={{ width: '42px', height: '42px', borderRadius: '11px', backgroundColor: av.bg, display: 'grid', placeItems: 'center', color: av.color, fontWeight: 800, fontSize: '14px' }}>{initials(company.name)}</div>
            <div><strong style={{ color: '#0f172a', fontSize: '14px' }}>{company.name}</strong><p style={{ color: '#64748b', fontSize: '12px', marginTop: '2px' }}>{company.industry ?? '—'}</p></div>
          </div>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
            <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 600, backgroundColor: pm?.bg, color: pm?.color, border: `1px solid ${pm?.border}` }}>{pm?.label}</span>
            <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 600, backgroundColor: sm?.bg, color: sm?.color }}>{sm?.label}</span>
          </div>
          {row('Email', company.email ?? '—')}
          {row('Phone', company.phone ?? '—')}
          {row('Address', company.address ?? '—')}
          {row('Max Users', String(company.maxUsers))}
          {row('Active Users', String(company.userCount))}
          {row('Plan Expiry', fmtDate(company.planExpiry))}
          {row('Created On', fmtDate(company.createdAt))}
        </div>

        <div className="company-drawer__footer">
          <button onClick={onClose} style={{ padding: '8px 18px', border: '1.5px solid #e2e8f0', borderRadius: '8px', backgroundColor: 'white', fontSize: '13px', fontWeight: 600, cursor: 'pointer', color: '#374151', fontFamily: 'Inter, sans-serif' }}>Close</button>
          <button onClick={onEdit} style={{ padding: '8px 18px', backgroundColor: '#0d7470', border: 'none', borderRadius: '8px', color: 'white', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>Edit Company</button>
        </div>
    </AppDrawer>
  );
}

// Section.

export default function CompaniesPage() {
  const qc = useQueryClient();
  const [search,      setSearch]      = useState('');
  const [planFilter,  setPlanFilter]  = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [modal,       setModal]       = useState<'edit' | 'view' | null>(null);
  const [selected,    setSelected]    = useState<Company | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Company | null>(null);
  const [page,        setPage]        = useState(1);
  const debouncedSearch = useDebouncedValue(search, 500);

  const params: Record<string, string> = { page: String(page), limit: '8' };
  if (debouncedSearch.trim().length >= 2) params.search = debouncedSearch.trim();
  if (planFilter !== 'ALL') params.plan = planFilter;
  if (statusFilter !== 'ALL') params.status = statusFilter;

  const { data: compData, isLoading: loading } = useSaCompanies(params);
  const { data: plans = [] } = useSaPlans();
  const deleteCompany = useDeleteCompany();

  const companies  = (compData?.companies  ?? []) as Company[];
  const stats      = compData?.stats       ?? { total: 0, active: 0, trial: 0, expiringSoon: 0 };
  const pagination = compData?.pagination  ?? { total: 0, page: 1, totalPages: 1 };

  const handleDelete = () => {
    if (!deleteConfirm) return;
    deleteCompany.mutate(deleteConfirm.id, {
      onSuccess: () => setDeleteConfirm(null),
      onError: () => setDeleteConfirm(null),
    });
  };

  const statsRow = [
    { label: 'Total Companies', value: stats.total, icon: Building2,     iconBg: '#eff6ff', iconColor: '#3b82f6' },
    { label: 'Active',          value: stats.active, icon: TrendingUp,    iconBg: '#f0fdf4', iconColor: '#16a34a' },
    { label: 'On Trial',        value: stats.trial,  icon: Clock,         iconBg: '#fffbeb', iconColor: '#d97706' },
    { label: 'Expiring Soon',   value: stats.expiringSoon, icon: AlertTriangle, iconBg: '#fef2f2', iconColor: '#dc2626' },
  ];

  const selectStyle: React.CSSProperties = {
    padding: '8px 12px', border: '1.5px solid #e2e8f0', borderRadius: '8px',
    fontSize: '13px', color: '#374151', backgroundColor: 'white',
    cursor: 'pointer', outline: 'none', fontFamily: 'Inter, sans-serif',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a' }}>Companies</h1>
          <p style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>Manage your platform and monitor client companies</p>
        </div>
      </div>

      {/* Stats */}
      <div className="responsive-stat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px' }}>
        {statsRow.map((s) => (
          <div key={s.label} className="responsive-stat-card" style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '6px' }}>{s.label}</p>
              <p style={{ fontSize: '26px', fontWeight: 800, color: '#0f172a' }}>{s.value}</p>
            </div>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: s.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <s.icon size={19} color={s.iconColor} />
            </div>
          </div>
        ))}
      </div>

      {/* Table Card */}
      <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>

        {/* Filters */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: '1', minWidth: '220px' }}>
            <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search by company name, email or industry..."
              style={{ width: '100%', paddingLeft: '36px', paddingRight: '12px', paddingTop: '8px', paddingBottom: '8px', border: '1.5px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', outline: 'none', fontFamily: 'Inter, sans-serif', color: '#374151', backgroundColor: '#f8fafc' }}
            />
          </div>
          <select value={planFilter} onChange={(e) => { setPlanFilter(e.target.value); setPage(1); }} style={selectStyle}>
            <option value="ALL">All Plans</option>
            {plans.map((p) => (
              <option key={p.type} value={p.type}>{p.name}</option>
            ))}
          </select>
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} style={selectStyle}>
            <option value="ALL">All Status</option>
            <option value="ACTIVE">Active</option>
            <option value="TRIAL">Trial</option>
            <option value="GRACE_PERIOD">Grace Period</option>
            <option value="EXPIRED">Expired</option>
            <option value="SUSPENDED">Suspended</option>
          </select>
        </div>

        {/* Table */}
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px', gap: '10px', color: '#64748b' }}>
            <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
            <span style={{ fontSize: '14px' }}>Loading companies...</span>
          </div>
        ) : companies.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 24px' }}>
            <Building2 size={40} color="#e2e8f0" style={{ margin: '0 auto 12px' }} />
            <p style={{ fontSize: '14px', fontWeight: 600, color: '#94a3b8' }}>No companies found</p>
            <p style={{ fontSize: '13px', color: '#cbd5e1', marginTop: '4px' }}>Try changing the filters or wait for a company to sign up online.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <ResponsiveTable mobileRowClick style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc' }}>
                  {['Company', 'Plan', 'Users', 'Status', 'Expiry', 'Created On', 'Actions'].map((h) => (
                    <th key={h} style={{ textAlign: 'left', padding: '10px 20px', fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.4px', borderBottom: '1px solid #f1f5f9', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {companies.map((c, i) => {
                  const av = getAvatarColor(c.name);
                  const pm = getPlanBadge(c.plan, plans);
                  const sm = statusMeta[c.status];
                  const expWarn = isExpiringSoon(c.planExpiry);
                  return (
                    <tr key={c.id} onClick={() => { setSelected(c); setModal('view'); }} style={{ borderBottom: i < companies.length - 1 ? '1px solid #f8fafc' : 'none', cursor: 'pointer' }}>
                      <td style={{ padding: '13px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '11px' }}>
                          <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: av.bg, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: av.color, fontWeight: 700, fontSize: '12px' }}>
                            {initials(c.name)}
                          </div>
                          <div>
                            <p style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap' }}>{c.name}</p>
                            <p style={{ fontSize: '11px', color: '#64748b' }}>{c.companyCode} · {c.industry ?? '—'}</p>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '13px 20px' }}>
                        <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 600, backgroundColor: pm?.bg, color: pm?.color, border: `1px solid ${pm?.border}`, whiteSpace: 'nowrap' }}>{pm?.label}</span>
                      </td>
                      <td style={{ padding: '13px 20px', fontSize: '13px', color: '#374151', fontWeight: 500 }}>
                        {c.userCount} / {c.maxUsers}
                      </td>
                      <td style={{ padding: '13px 20px' }}>
                        <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 600, backgroundColor: sm?.bg, color: sm?.color }}>{sm?.label}</span>
                      </td>
                      <td style={{ padding: '13px 20px' }}>
                        <p style={{ fontSize: '13px', color: expWarn ? '#dc2626' : '#374151', fontWeight: expWarn ? 600 : 400, whiteSpace: 'nowrap' }}>{fmtDate(c.planExpiry)}</p>
                        {expWarn && <p style={{ fontSize: '11px', color: '#dc2626' }}>Expiring soon</p>}
                      </td>
                      <td style={{ padding: '13px 20px', fontSize: '13px', color: '#64748b', whiteSpace: 'nowrap' }}>{fmtDate(c.createdAt)}</td>
                      <td style={{ padding: '13px 20px' }}>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button onClick={(e) => { e.stopPropagation(); setSelected(c); setModal('edit'); }} title="Edit" style={{ width: '30px', height: '30px', border: '1px solid #e2e8f0', borderRadius: '7px', backgroundColor: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}><Pencil size={14} /></button>
                          <button onClick={(e) => { e.stopPropagation(); setDeleteConfirm(c); }} title="Delete" style={{ width: '30px', height: '30px', border: '1px solid #fee2e2', borderRadius: '7px', backgroundColor: '#fef2f2', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#dc2626' }}><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </ResponsiveTable>
          </div>
        )}

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderTop: '1px solid #f1f5f9' }}>
            <span style={{ fontSize: '13px', color: '#64748b' }}>
              Showing {(pagination.page - 1) * 8 + 1}–{Math.min(pagination.page * 8, pagination.total)} of {pagination.total} companies
            </span>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button disabled={page === 1} onClick={() => setPage((p) => p - 1)} style={{ width: '32px', height: '32px', border: '1px solid #e2e8f0', borderRadius: '7px', backgroundColor: page === 1 ? '#f8fafc' : 'white', cursor: page === 1 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: page === 1 ? '#cbd5e1' : '#374151' }}><ChevronLeft size={15} /></button>
              {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((p) => (
                <button key={p} onClick={() => setPage(p)} style={{ width: '32px', height: '32px', border: '1px solid #e2e8f0', borderRadius: '7px', backgroundColor: p === page ? '#0d7470' : 'white', color: p === page ? 'white' : '#374151', cursor: 'pointer', fontSize: '13px', fontWeight: p === page ? 700 : 400 }}>{p}</button>
              ))}
              <button disabled={page === pagination.totalPages} onClick={() => setPage((p) => p + 1)} style={{ width: '32px', height: '32px', border: '1px solid #e2e8f0', borderRadius: '7px', backgroundColor: page === pagination.totalPages ? '#f8fafc' : 'white', cursor: page === pagination.totalPages ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: page === pagination.totalPages ? '#cbd5e1' : '#374151' }}><ChevronRight size={15} /></button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {modal === 'edit' && selected && (
        <CompanyModal
          company={selected}
          onClose={() => setModal(null)}
          onSave={() => {
            setModal(null);
            void qc.invalidateQueries({ queryKey: ['sa', 'companies'] });
          }}
        />
      )}

      {modal === 'view' && selected && (
        <ViewModal
          company={selected}
          plans={plans}
          onClose={() => setModal(null)}
          onEdit={() => setModal('edit')}
        />
      )}

      {/* Delete Confirm */}
      {deleteConfirm && (
        <AppDialog className="action-confirm-dialog" open onOpenChange={(open) => { if (!open) setDeleteConfirm(null); }} title="Archive company?" description="The company will be hidden from lists and its subscription deactivated. Data is preserved." footer={<>
          <button onClick={() => setDeleteConfirm(null)} className="admin-button admin-button--secondary">Cancel</button>
          <button onClick={handleDelete} className="admin-button admin-button--danger">Archive</button>
        </>}>
            <div className="action-confirm-dialog__icon" aria-hidden="true">
              <Trash2 size={20} />
            </div>
            <p className="action-confirm-dialog__message">
              Are you sure you want to archive <strong>{deleteConfirm.name}</strong>? The company will be hidden from all lists and its subscription deactivated. Data is preserved and not permanently deleted.
            </p>
        </AppDialog>
      )}
    </div>
  );
}
