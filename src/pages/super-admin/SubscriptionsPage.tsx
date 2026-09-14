import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { subscriptionsApi, type Subscription, type PlanData } from '../../api/subscriptions';
import { type Company } from '../../api/companies';
import { useSaSubscriptions, useSaPlans, useSaCompanies } from '../../hooks/queries/useSaQueries';
import { qk } from '../../lib/queryKeys';
import { extractError } from '../../utils/errorUtils';
import { getPlanBadge } from '../../utils/planColors';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { toast } from 'sonner';
import PlanBuilderModal from '../../components/subscriptions/PlanBuilderModal';
import PlanAssignmentModal from '../../components/subscriptions/PlanAssignmentModal';
import {
  IndianRupee, Users, Clock, AlertTriangle,
  Search, Check, X, Loader2, ChevronLeft, ChevronRight,
  Plus, Pencil, Trash2,
  BarChart3,
  FileText,
  Shield,
  Download,
} from 'lucide-react';

// ── helpers ──────────────────────────────────────────────────────────────────

const quickActions = [
  { icon: Download, label: 'Download Payroll' },
  { icon: Shield, label: 'Manage Roles' },
  { icon: FileText, label: 'Download Summary' },
  { icon: BarChart3, label: 'View Reports' },
]; 
const avatarColors = [
  { bg: '#eef2ff', color: '#6366f1' }, { bg: '#f5f3ff', color: '#8b5cf6' },
  { bg: '#f0f9ff', color: '#0ea5e9' }, { bg: '#f0fdf4', color: '#10b981' },
  { bg: '#fffbeb', color: '#f59e0b' }, { bg: '#fdf4ff', color: '#ec4899' },
];
const getAvatarColor = (name?: string) => avatarColors[(name ?? 'S').charCodeAt(0) % avatarColors.length];
const initials = (name?: string) => (name ?? 'Subscription').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
const fmtINR = (n: number) => `₹${n.toLocaleString('en-IN')}`;
const isExpiringSoon = (d: string) => { const dt = new Date(d); return dt > new Date() && dt < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); };

// ── Create Plan Modal ─────────────────────────────────────────────────────────

export function LegacyCreatePlanModal({ onClose, onSave }: { onClose: () => void; onSave: () => void }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState('');
  const [price, setPrice] = useState('');
  const [maxUsers, setMaxUsers] = useState('');
  const [featureInput, setFeatureInput] = useState('');
  const [features, setFeatures] = useState<string[]>([]);

  const addFeature = () => {
    const f = featureInput.trim();
    if (f && !features.includes(f)) setFeatures((prev) => [...prev, f]);
    setFeatureInput('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !type.trim() || !price || !maxUsers) {
      setError('All fields are required');
      return;
    }
    setSaving(true); setError('');
    try {
      await subscriptionsApi.createPlan({
        name: name.trim(),
        type: type.trim(),
        price: Number(price),
        maxUsers: Number(maxUsers),
        features,
      });
      onSave();
    } catch (err) {
      setError(extractError(err, 'Failed to create plan'));
    } finally { setSaving(false); }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '9px 12px', border: '1.5px solid #e2e8f0',
    borderRadius: '8px', fontSize: '13px', outline: 'none', fontFamily: 'Inter, sans-serif',
    color: '#0f172a', backgroundColor: 'white', boxSizing: 'border-box',
  };

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '24px' }}>
      <div style={{ backgroundColor: 'white', borderRadius: '16px', width: '100%', maxWidth: '480px', boxShadow: '0 20px 60px rgba(0,0,0,0.15)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid #f1f5f9' }}>
          <div>
            <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>Create Plan</h2>
            <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>Define a new subscription plan</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {error && <div style={{ padding: '10px 14px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#dc2626', fontSize: '13px' }}>{error}</div>}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>Plan Name *</label>
              <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Starter" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>Plan Type (key) *</label>
              <input style={inputStyle} value={type} onChange={(e) => setType(e.target.value)} placeholder="e.g. STARTER" />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>Price (₹/month) *</label>
              <input type="number" min="0" style={inputStyle} value={price} onChange={(e) => setPrice(e.target.value)} placeholder="e.g. 999" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>Max Users *</label>
              <input type="number" min="1" style={inputStyle} value={maxUsers} onChange={(e) => setMaxUsers(e.target.value)} placeholder="e.g. 50" />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>Features</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                style={{ ...inputStyle, flex: 1 }}
                value={featureInput}
                onChange={(e) => setFeatureInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addFeature(); } }}
                placeholder="Type a feature and press Enter"
              />
              <button type="button" onClick={addFeature} style={{ padding: '9px 14px', backgroundColor: '#f1f5f9', border: '1.5px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, color: '#374151', fontFamily: 'Inter, sans-serif' }}>Add</button>
            </div>
            {features.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                {features.map((f) => (
                  <span key={f} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 10px', backgroundColor: '#f0fafa', border: '1px solid #b2dfdc', borderRadius: '20px', fontSize: '12px', color: '#0d7470' }}>
                    {f}
                    <button type="button" onClick={() => setFeatures((prev) => prev.filter((x) => x !== f))} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 1, color: '#0d7470' }}><X size={11} /></button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', paddingTop: '4px' }}>
            <button type="button" onClick={onClose} style={{ padding: '9px 20px', border: '1.5px solid #e2e8f0', borderRadius: '8px', backgroundColor: 'white', fontSize: '13px', fontWeight: 600, cursor: 'pointer', color: '#374151', fontFamily: 'Inter, sans-serif' }}>Cancel</button>
            <button type="submit" disabled={saving} style={{ padding: '9px 24px', backgroundColor: saving ? '#7ab8b6' : '#0d7470', border: 'none', borderRadius: '8px', color: 'white', fontSize: '13px', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontFamily: 'Inter, sans-serif' }}>
              {saving && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
              Create Plan
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Edit Plan Modal ───────────────────────────────────────────────────────────

export function LegacyEditPlanModal({ plan, onClose, onSave }: { plan: PlanData; onClose: () => void; onSave: () => void }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [name, setName] = useState(plan.name);
  const [price, setPrice] = useState(String(plan.price));
  const [maxUsers, setMaxUsers] = useState(String(plan.maxUsers));
  const [featureInput, setFeatureInput] = useState('');
  const [features, setFeatures] = useState<string[]>(plan.features);

  const addFeature = () => {
    const f = featureInput.trim();
    if (f && !features.includes(f)) setFeatures((prev) => [...prev, f]);
    setFeatureInput('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !price || !maxUsers) { setError('All fields are required'); return; }
    setSaving(true); setError('');
    try {
      await subscriptionsApi.updatePlan(plan.id, {
        draftRevision: plan.draftRevision ?? 0,
        name: name.trim(),
        price: Number(price),
        maxUsers: Number(maxUsers),
        features,
      });
      onSave();
    } catch (err) {
      setError(extractError(err, 'Failed to update plan'));
    } finally { setSaving(false); }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '9px 12px', border: '1.5px solid #e2e8f0',
    borderRadius: '8px', fontSize: '13px', outline: 'none', fontFamily: 'Inter, sans-serif',
    color: '#0f172a', backgroundColor: 'white', boxSizing: 'border-box',
  };

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '24px' }}>
      <div style={{ backgroundColor: 'white', borderRadius: '16px', width: '100%', maxWidth: '480px', boxShadow: '0 20px 60px rgba(0,0,0,0.15)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid #f1f5f9' }}>
          <div>
            <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>Edit Plan</h2>
            <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
              Plan type <strong style={{ color: '#0d7470' }}>{plan.type}</strong> cannot be changed
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {error && <div style={{ padding: '10px 14px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#dc2626', fontSize: '13px' }}>{error}</div>}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>Plan Name *</label>
              <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Starter" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>Plan Type (key)</label>
              <input disabled value={plan.type} style={{ ...inputStyle, backgroundColor: '#f8fafc', color: '#94a3b8', cursor: 'not-allowed' }} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>Price (₹/month) *</label>
              <input type="number" min="0" style={inputStyle} value={price} onChange={(e) => setPrice(e.target.value)} placeholder="e.g. 999" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>Max Users *</label>
              <input type="number" min="1" style={inputStyle} value={maxUsers} onChange={(e) => setMaxUsers(e.target.value)} placeholder="e.g. 50" />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>Features</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                style={{ ...inputStyle, flex: 1 }}
                value={featureInput}
                onChange={(e) => setFeatureInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addFeature(); } }}
                placeholder="Type a feature and press Enter"
              />
              <button type="button" onClick={addFeature} style={{ padding: '9px 14px', backgroundColor: '#f1f5f9', border: '1.5px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, color: '#374151', fontFamily: 'Inter, sans-serif' }}>Add</button>
            </div>
            {features.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                {features.map((f) => (
                  <span key={f} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 10px', backgroundColor: '#f0fafa', border: '1px solid #b2dfdc', borderRadius: '20px', fontSize: '12px', color: '#0d7470' }}>
                    {f}
                    <button type="button" onClick={() => setFeatures((prev) => prev.filter((x) => x !== f))} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 1, color: '#0d7470' }}><X size={11} /></button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', paddingTop: '4px' }}>
            <button type="button" onClick={onClose} style={{ padding: '9px 20px', border: '1.5px solid #e2e8f0', borderRadius: '8px', backgroundColor: 'white', fontSize: '13px', fontWeight: 600, cursor: 'pointer', color: '#374151', fontFamily: 'Inter, sans-serif' }}>Cancel</button>
            <button type="submit" disabled={saving} style={{ padding: '9px 24px', backgroundColor: saving ? '#7ab8b6' : '#0d7470', border: 'none', borderRadius: '8px', color: 'white', fontSize: '13px', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontFamily: 'Inter, sans-serif' }}>
              {saving && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Delete Plan Confirm Modal ──────────────────────────────────────────────────

function DeletePlanConfirmModal({ plan, onClose, onSave }: { plan: PlanData; onClose: () => void; onSave: () => void }) {
  const [deleting, setDeleting] = useState(false);
  const [blocked, setBlocked] = useState<{ activeCount: number; latestExpiry: string } | null>(null);

  const handleConfirm = async () => {
    setDeleting(true);
    try {
      await subscriptionsApi.deletePlan(plan.id, 'Deactivated from the plan management screen');
      onSave();
    } catch (err: any) {
      if (err?.response?.status === 409) {
        setBlocked({
          activeCount: err.response.data.activeCount,
          latestExpiry: err.response.data.latestExpiry,
        });
      }
    } finally { setDeleting(false); }
  };

  const fmtD = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '24px' }}>
      <div style={{ backgroundColor: 'white', borderRadius: '16px', width: '100%', maxWidth: '420px', boxShadow: '0 20px 60px rgba(0,0,0,0.15)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid #f1f5f9' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>Deactivate Plan</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={20} /></button>
        </div>
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {blocked ? (
            <div style={{ padding: '16px', backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: '10px' }}>
              <p style={{ fontSize: '13px', fontWeight: 700, color: '#92400e', marginBottom: '6px' }}>Cannot deactivate yet</p>
              <p style={{ fontSize: '13px', color: '#78350f', lineHeight: '1.6' }}>
                The <strong>{plan.name}</strong> plan is assigned to <strong>{blocked.activeCount}</strong> active subscription(s).
                It can be deactivated after <strong>{fmtD(blocked.latestExpiry)}</strong> when all subscriptions expire.
              </p>
            </div>
          ) : (
            <p style={{ fontSize: '14px', color: '#374151', lineHeight: '1.6' }}>
              Are you sure you want to deactivate the <strong>{plan.name}</strong> plan? It will no longer be visible or assignable to companies.
            </p>
          )}
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button onClick={onClose} style={{ padding: '9px 20px', border: '1.5px solid #e2e8f0', borderRadius: '8px', backgroundColor: 'white', fontSize: '13px', fontWeight: 600, cursor: 'pointer', color: '#374151', fontFamily: 'Inter, sans-serif' }}>
              {blocked ? 'Close' : 'Cancel'}
            </button>
            {!blocked && (
              <button onClick={handleConfirm} disabled={deleting} style={{ padding: '9px 24px', backgroundColor: deleting ? '#fca5a5' : '#dc2626', border: 'none', borderRadius: '8px', color: 'white', fontSize: '13px', fontWeight: 600, cursor: deleting ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontFamily: 'Inter, sans-serif' }}>
                {deleting && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
                Deactivate
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Assign Plan Modal ─────────────────────────────────────────────────────────

export function LegacyAssignModal({ plans, companies, defaultPlan, onClose, onSave }: {
  plans: PlanData[]; companies: Company[]; defaultPlan?: string; onClose: () => void; onSave: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [plan, setPlan] = useState(defaultPlan || plans[0]?.type || '');
  const [billing, setBilling] = useState('Monthly');
  const [months, setMonths] = useState(12);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) { setError('Please select a company'); return; }
    const selected = plans.find((item) => item.type === plan)?.currentVersionId;
    if (!selected) { setError('Publish this plan before assigning it.'); return; }
    setSaving(true); setError('');
    try {
      await subscriptionsApi.assign({ companyId, planVersionId: selected.id, billingCycle: billing === 'Annual' ? 'Annual' : 'Monthly', months, reason: 'Legacy assignment dialog' });
      onSave();
    } catch (err) { setError(extractError(err, 'Failed to assign plan')); }
    finally { setSaving(false); }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '9px 12px', border: '1.5px solid #e2e8f0',
    borderRadius: '8px', fontSize: '13px', outline: 'none', fontFamily: 'Inter, sans-serif',
    color: '#0f172a', backgroundColor: 'white', cursor: 'pointer',
  };

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '24px' }}>
      <div style={{ backgroundColor: 'white', borderRadius: '16px', width: '100%', maxWidth: '480px', boxShadow: '0 20px 60px rgba(0,0,0,0.15)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid #f1f5f9' }}>
          <div>
            <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>Assign Plan</h2>
            <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>Assign a subscription plan to a company</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {error && <div style={{ padding: '10px 14px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#dc2626', fontSize: '13px' }}>{error}</div>}

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>Company *</label>
            <select style={inputStyle} value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
              <option value="">Select a company...</option>
              {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '8px' }}>Plan</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
              {plans.map((p) => (
                <button key={p.type} type="button" onClick={() => setPlan(p.type)} style={{
                  padding: '12px 10px', border: `2px solid ${plan === p.type ? '#0d7470' : '#e2e8f0'}`,
                  borderRadius: '10px', backgroundColor: plan === p.type ? '#f0fafa' : 'white',
                  cursor: 'pointer', textAlign: 'center', transition: 'all 0.15s',
                }}>
                  <p style={{ fontSize: '13px', fontWeight: 700, color: plan === p.type ? '#0d7470' : '#374151' }}>{p.name}</p>
                  <p style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>₹{p.price.toLocaleString('en-IN')}/mo</p>
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>Billing Cycle</label>
              <select style={inputStyle} value={billing} onChange={(e) => setBilling(e.target.value)}>
                <option value="Monthly">Monthly</option>
                <option value="Quarterly">Quarterly</option>
                <option value="Annual">Annual</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>Duration (months)</label>
              <select style={inputStyle} value={months} onChange={(e) => setMonths(parseInt(e.target.value))}>
                {[1, 3, 6, 12, 24].map((m) => <option key={m} value={m}>{m} {m === 1 ? 'month' : 'months'}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', paddingTop: '4px' }}>
            <button type="button" onClick={onClose} style={{ padding: '9px 20px', border: '1.5px solid #e2e8f0', borderRadius: '8px', backgroundColor: 'white', fontSize: '13px', fontWeight: 600, cursor: 'pointer', color: '#374151', fontFamily: 'Inter, sans-serif' }}>Cancel</button>
            <button type="submit" disabled={saving} style={{ padding: '9px 24px', backgroundColor: saving ? '#7ab8b6' : '#0d7470', border: 'none', borderRadius: '8px', color: 'white', fontSize: '13px', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontFamily: 'Inter, sans-serif' }}>
              {saving && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
              Assign Plan
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Edit Modal ────────────────────────────────────────────────────────────────

function EditModal({ sub, onClose, onSave }: { sub: Subscription; onClose: () => void; onSave: () => void }) {
  const [saving, setSaving] = useState(false);
  const [billing, setBilling] = useState(sub.billingCycle);
  const [paymentConfirmed, setPaymentConfirmed] = useState(true);
  const [reason, setReason] = useState('Manual renewal reviewed by Super Admin');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await subscriptionsApi.renew(sub.id, { billingCycle: billing, paymentConfirmed, reason });
      onSave();
    } catch { /* ignore */ }
    finally { setSaving(false); }
  };

  const inputStyle: React.CSSProperties = { width: '100%', padding: '9px 12px', border: '1.5px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', outline: 'none', fontFamily: 'Inter, sans-serif', color: '#0f172a', backgroundColor: 'white', cursor: 'pointer' };

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ backgroundColor: 'white', borderRadius: '16px', width: '100%', maxWidth: '420px', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid #f1f5f9' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>Record renewal outcome</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>Company</label>
            <input disabled value={sub.company.name} style={{ ...inputStyle, backgroundColor: '#f8fafc', color: '#64748b', cursor: 'not-allowed' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>Billing Cycle</label>
              <select style={inputStyle} value={billing} onChange={(e) => setBilling(e.target.value)}>
                <option value="Monthly">Monthly</option>
                <option value="Quarterly">Quarterly</option>
                <option value="Annual">Annual</option>
              </select>
            </div>
            <div><label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>Payment result</label><select style={inputStyle} value={paymentConfirmed ? 'confirmed' : 'failed'} onChange={(e) => setPaymentConfirmed(e.target.value === 'confirmed')}><option value="confirmed">Payment confirmed</option><option value="failed">Payment failed</option></select></div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '8px' }}>Reason</label>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} required rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
          </div>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', paddingTop: '4px' }}>
            <button type="button" onClick={onClose} style={{ padding: '9px 20px', border: '1.5px solid #e2e8f0', borderRadius: '8px', backgroundColor: 'white', fontSize: '13px', fontWeight: 600, cursor: 'pointer', color: '#374151', fontFamily: 'Inter, sans-serif' }}>Cancel</button>
            <button type="submit" disabled={saving} style={{ padding: '9px 24px', backgroundColor: '#0d7470', border: 'none', borderRadius: '8px', color: 'white', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif', display: 'flex', alignItems: 'center', gap: '6px' }}>
              {saving && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
              Record outcome
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function SubscriptionsPage() {
  const qc = useQueryClient();
  const [tab,             setTab]             = useState<'overview' | 'plans'>('overview');
  const [search,          setSearch]          = useState('');
  const [planFilter,      setPlanFilter]      = useState('ALL');
  const [billingFilter,   setBillingFilter]   = useState('ALL');
  const [statusFilter,    setStatusFilter]    = useState('ALL');
  const [page,            setPage]            = useState(1);
  const [showAssign,      setShowAssign]      = useState<string | boolean>(false);
  const [showCreatePlan,  setShowCreatePlan]  = useState(false);
  const [editSub,         setEditSub]         = useState<Subscription | null>(null);
  const [editPlan,        setEditPlan]        = useState<PlanData | null>(null);
  const [deletePlanTarget, setDeletePlanTarget] = useState<PlanData | null>(null);
  const debouncedSearch = useDebouncedValue(search, 500);

  const subParams: Record<string, string> = { page: String(page), limit: '8' };
  if (debouncedSearch.trim().length >= 2) subParams.search = debouncedSearch.trim();
  if (planFilter !== 'ALL') subParams.plan = planFilter;
  if (billingFilter !== 'ALL') subParams.billingCycle = billingFilter;
  if (statusFilter !== 'ALL') subParams.status = statusFilter;

  const { data: subData,   isLoading: loading } = useSaSubscriptions(subParams);
  const { data: plans = []                     } = useSaPlans();
  const { data: compData                       } = useSaCompanies({ limit: '100' });

  const subscriptions = (subData?.subscriptions ?? []) as Subscription[];
  const stats         = subData?.stats         ?? { monthlyRevenue: 0, active: 0, trial: 0, expiringSoon: 0 };
  const pagination    = subData?.pagination    ?? { total: 0, page: 1, totalPages: 1 };
  const allCompanies  = (compData?.companies   ?? []) as Company[];

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['sa', 'subscriptions'] });
    void qc.invalidateQueries({ queryKey: ['sa', 'plans'] });
    void qc.invalidateQueries({ queryKey: ['sa', 'companies'] });
    void qc.invalidateQueries({ queryKey: qk.sa.activity() });
  };
  const publishPlan = async (plan: PlanData) => {
    try {
      await subscriptionsApi.publishPlan(plan.id, 'Commercial package reviewed and published by Super Admin', plan.draftRevision ?? 0);
      toast.success(`${plan.name} published as a new immutable version.`);
      refresh();
    } catch (error) { toast.error(extractError(error, 'The plan could not be published.')); }
  };

  const statsRow = [
    { label: 'Monthly Revenue',      value: fmtINR(stats.monthlyRevenue), icon: IndianRupee,   iconBg: '#f0fdf4', iconColor: '#22c55e' },
    { label: 'Active Subscriptions', value: String(stats.active),          icon: Users,         iconBg: '#eff6ff', iconColor: '#3b82f6' },
    { label: 'On Trial',             value: String(stats.trial),           icon: Clock,         iconBg: '#fffbeb', iconColor: '#d97706' },
    { label: 'Expiring Soon',        value: String(stats.expiringSoon),    icon: AlertTriangle, iconBg: '#fef2f2', iconColor: '#dc2626' },
  ];

  const selectStyle: React.CSSProperties = { padding: '8px 12px', border: '1.5px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', color: '#374151', backgroundColor: 'white', cursor: 'pointer', outline: 'none', fontFamily: 'Inter, sans-serif' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a' }}>Plan & subscriptions</h1>
          <p style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>Manage company billing, plan versions, and access from one workspace</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => setShowCreatePlan(true)} style={{ padding: '9px 18px', border: '1.5px solid #0d7470', borderRadius: '8px', backgroundColor: 'white', color: '#0d7470', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
            + Create Plan
          </button>
          <button onClick={() => setShowAssign(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 18px', backgroundColor: '#0d7470', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
            <Plus size={15} /> Assign Plan
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px' }}>
        {statsRow.map((s) => (
          <div key={s.label} style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '6px' }}>{s.label}</p>
              <p style={{ fontSize: s.label === 'Monthly Revenue' ? '18px' : '26px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.3px' }}>{s.value}</p>
            </div>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: s.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <s.icon size={19} color={s.iconColor} />
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        <div style={{ display: 'flex', borderBottom: '1px solid #f1f5f9' }}>
          {(['overview', 'plans'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: '14px 24px', fontSize: '13px', fontWeight: 600,
              border: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif',
              backgroundColor: tab === t ? '#0d7470' : 'transparent',
              color: tab === t ? 'white' : '#64748b',
              borderBottom: tab === t ? '2px solid #0d7470' : '2px solid transparent',
              transition: 'all 0.15s',
            }}>
              {t === 'overview' ? 'Company overview' : 'Plans & access'}
            </button>
          ))}
        </div>

        {/* ── Tab 1: Company Overview ── */}
        {tab === 'overview' && (
          <>
            {/* Filters */}
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
                <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search by company name..." style={{ width: '100%', paddingLeft: '36px', paddingRight: '12px', paddingTop: '8px', paddingBottom: '8px', border: '1.5px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', outline: 'none', fontFamily: 'Inter, sans-serif', color: '#374151', backgroundColor: '#f8fafc' }} />
              </div>
              <select value={planFilter} onChange={(e) => { setPlanFilter(e.target.value); setPage(1); }} style={selectStyle}>
                <option value="ALL">All Plans</option>
                {plans.map((p) => (
                  <option key={p.type} value={p.type}>{p.name}</option>
                ))}
              </select>
              <select value={billingFilter} onChange={(e) => { setBillingFilter(e.target.value); setPage(1); }} style={selectStyle}>
                <option value="ALL">All Billing</option>
                <option value="Monthly">Monthly</option>
                <option value="Quarterly">Quarterly</option>
                <option value="Yearly">Yearly</option>
              </select>
              <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} style={selectStyle}>
                <option value="ALL">All Status</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </div>

            {/* Table */}
            {loading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px', gap: '10px', color: '#64748b' }}>
                <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
                <span style={{ fontSize: '14px' }}>Loading subscriptions...</span>
              </div>
            ) : subscriptions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 24px' }}>
                <IndianRupee size={40} color="#e2e8f0" style={{ margin: '0 auto 12px' }} />
                <p style={{ fontSize: '14px', fontWeight: 600, color: '#94a3b8' }}>No subscriptions found</p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8fafc' }}>
                      {['Company', 'Plan', 'Billing Cycle', 'Start Date', 'Expiry', 'Status', 'Actions'].map((h) => (
                        <th key={h} style={{ textAlign: 'left', padding: '10px 20px', fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.4px', borderBottom: '1px solid #f1f5f9', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {subscriptions.map((s, i) => {
                      const companyName = s.company?.name ?? 'Unknown Company';
                      const av = getAvatarColor(companyName);
                      const pm = getPlanBadge(s.plan, plans);
                      const expWarn = isExpiringSoon(s.endDate);
                      return (
                        <tr key={s.id} style={{ borderBottom: i < subscriptions.length - 1 ? '1px solid #f8fafc' : 'none' }}>
                          <td style={{ padding: '13px 20px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <div style={{ width: '34px', height: '34px', borderRadius: '9px', backgroundColor: av.bg, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: av.color, fontWeight: 700, fontSize: '11px' }}>
                                {initials(companyName)}
                              </div>
                              <div>
                                <p style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap' }}>{companyName}</p>
                                <p style={{ fontSize: '11px', color: '#94a3b8' }}>{s.company?.industry ?? '—'}</p>
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: '13px 20px' }}>
                            <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 600, backgroundColor: pm.bg, color: pm.color, border: `1px solid ${pm.border}` }}>{pm.label}</span>
                          </td>
                          <td style={{ padding: '13px 20px', fontSize: '13px', color: '#374151' }}>{s.billingCycle}</td>
                          <td style={{ padding: '13px 20px', fontSize: '13px', color: '#374151', whiteSpace: 'nowrap' }}>{fmtDate(s.startDate)}</td>
                          <td style={{ padding: '13px 20px' }}>
                            <p style={{ fontSize: '13px', color: expWarn ? '#dc2626' : '#374151', fontWeight: expWarn ? 600 : 400, whiteSpace: 'nowrap' }}>{fmtDate(s.endDate)}</p>
                            {expWarn && <p style={{ fontSize: '11px', color: '#dc2626' }}>Expiring soon</p>}
                          </td>
                          <td style={{ padding: '13px 20px' }}>
                            <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 600, backgroundColor: s.isActive ? '#dcfce7' : '#fee2e2', color: s.isActive ? '#15803d' : '#b91c1c' }}>
                              {s.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td style={{ padding: '13px 20px' }}>
                            <button onClick={() => setEditSub(s)} style={{ width: '30px', height: '30px', border: '1px solid #e2e8f0', borderRadius: '7px', backgroundColor: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
                              <Pencil size={14} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderTop: '1px solid #f1f5f9' }}>
                <span style={{ fontSize: '13px', color: '#64748b' }}>Showing {(page - 1) * 8 + 1}–{Math.min(page * 8, pagination.total)} of {pagination.total}</span>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button disabled={page === 1} onClick={() => setPage((p) => p - 1)} style={{ width: '32px', height: '32px', border: '1px solid #e2e8f0', borderRadius: '7px', backgroundColor: page === 1 ? '#f8fafc' : 'white', cursor: page === 1 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: page === 1 ? '#cbd5e1' : '#374151' }}><ChevronLeft size={15} /></button>
                  {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((p) => (
                    <button key={p} onClick={() => setPage(p)} style={{ width: '32px', height: '32px', border: '1px solid #e2e8f0', borderRadius: '7px', backgroundColor: p === page ? '#0d7470' : 'white', color: p === page ? 'white' : '#374151', cursor: 'pointer', fontSize: '13px', fontWeight: p === page ? 700 : 400 }}>{p}</button>
                  ))}
                  <button disabled={page === pagination.totalPages} onClick={() => setPage((p) => p + 1)} style={{ width: '32px', height: '32px', border: '1px solid #e2e8f0', borderRadius: '7px', backgroundColor: page === pagination.totalPages ? '#f8fafc' : 'white', cursor: page === pagination.totalPages ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: page === pagination.totalPages ? '#cbd5e1' : '#374151' }}><ChevronRight size={15} /></button>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── Tab 2: My Plans ── */}
        {tab === 'plans' && (
          <div style={{ padding: '24px' }}>
            <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', marginBottom: '4px' }}>Available Plans</h2>
            <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '20px' }}>Choose a plan that fits your company's needs</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
              {plans.map((p, idx) => {
                const highlight = idx === Math.floor(plans.length / 2);
                const pb = getPlanBadge(p.type, plans);
                return (
                  <div key={p.type} style={{
                    border: `2px solid ${highlight ? '#0d7470' : '#e2e8f0'}`,
                    borderRadius: '14px', padding: '24px', position: 'relative',
                    backgroundColor: highlight ? '#f0fafa' : 'white',
                  }}>
                    {highlight && (
                      <div style={{ position: 'absolute', top: '-12px', left: '50%', transform: 'translateX(-50%)', backgroundColor: '#0d7470', color: 'white', fontSize: '11px', fontWeight: 700, padding: '3px 12px', borderRadius: '20px' }}>
                        POPULAR
                      </div>
                    )}
                    <div style={{ position: 'absolute', top: '12px', right: '12px', display: 'flex', gap: '4px' }}>
                      {(p.status === 'DRAFT' || p.hasUnpublishedChanges) && <button
                        onClick={() => void publishPlan(p)}
                        title="Publish immutable version"
                        aria-label={`Publish ${p.name}`}
                        style={{ width: '28px', height: '28px', border: '1px solid #9dd4ce', borderRadius: '7px', backgroundColor: '#eff9f7', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0d7470' }}
                      ><Check size={13} /></button>}
                      <button
                        onClick={() => setEditPlan(p)}
                        title="Edit plan"
                        style={{ width: '28px', height: '28px', border: '1px solid #e2e8f0', borderRadius: '7px', backgroundColor: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}
                      ><Pencil size={13} /></button>
                      <button
                        onClick={() => setDeletePlanTarget(p)}
                        title="Deactivate plan"
                        style={{ width: '28px', height: '28px', border: '1px solid #fecaca', borderRadius: '7px', backgroundColor: '#fff5f5', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#dc2626' }}
                      ><Trash2 size={13} /></button>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', marginBottom: '4px' }}>
                      <span style={{ fontSize: '28px', fontWeight: 800, color: '#0f172a' }}>₹{p.price.toLocaleString('en-IN')}</span>
                      <span style={{ fontSize: '13px', color: '#64748b', marginBottom: '4px' }}>/mo</span>
                    </div>
                    <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, marginBottom: '12px', backgroundColor: pb.bg, color: pb.color, border: `1px solid ${pb.border}` }}>
                      {pb.label}
                    </span>
                    <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '14px' }}>
                      User Limit: <strong>{p.maxUsers >= 999999 ? 'Unlimited' : p.maxUsers}</strong>
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
                      {p.features.map((f) => (
                        <div key={f} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: '16px', height: '16px', borderRadius: '50%', backgroundColor: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <Check size={10} color="#15803d" />
                          </div>
                          <span style={{ fontSize: '12px', color: '#374151' }}>{f}</span>
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={() => setShowAssign(p.type)}
                      style={{
                        width: '100%', padding: '10px', border: `2px solid ${highlight ? '#0d7470' : '#e2e8f0'}`,
                        borderRadius: '9px', backgroundColor: highlight ? '#0d7470' : 'white',
                        color: highlight ? 'white' : '#374151',
                        fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                      }}
                    >
                      Assign to Company
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {showCreatePlan && (
        <PlanBuilderModal onClose={() => setShowCreatePlan(false)} onSave={() => { setShowCreatePlan(false); setTab('plans'); refresh(); }} />
      )}
      {showAssign && (
        <PlanAssignmentModal plans={plans} companies={allCompanies} defaultPlan={typeof showAssign === 'string' ? showAssign : undefined} onClose={() => setShowAssign(false)} onSave={() => { setShowAssign(false); refresh(); }} />
      )}
      {editSub && (
        <EditModal sub={editSub} onClose={() => setEditSub(null)} onSave={() => { setEditSub(null); refresh(); }} />
      )}
      {editPlan && (
        <PlanBuilderModal plan={editPlan} onClose={() => setEditPlan(null)} onSave={() => { setEditPlan(null); refresh(); }} />
      )}
      {deletePlanTarget && (
        <DeletePlanConfirmModal plan={deletePlanTarget} onClose={() => setDeletePlanTarget(null)} onSave={() => { setDeletePlanTarget(null); refresh(); }} />
      )}


       {/* Quick Actions */}
      <div style={{
        backgroundColor: 'white', borderRadius: '12px',
        border: '1px solid #e2e8f0', padding: '18px 22px',
      }}>
        <p style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '14px' }}>
          QUICK ACTIONS
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
          {quickActions.map((q) => (
            <button key={q.label} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px',
              padding: '18px 12px', borderRadius: '10px',
              border: '1px solid #e2e8f0', backgroundColor: 'white',
              cursor: 'pointer', fontFamily: 'Inter, sans-serif', transition: 'all 0.15s',
            }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#f8fafc'; (e.currentTarget as HTMLElement).style.borderColor = '#0d7470'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'white'; (e.currentTarget as HTMLElement).style.borderColor = '#e2e8f0'; }}
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
