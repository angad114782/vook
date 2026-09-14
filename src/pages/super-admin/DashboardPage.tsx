import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import {
  Building2, IndianRupee, Users, AlertTriangle,
  ArrowUpRight, Activity, AlertCircle, Loader2,
  Download, Shield, FileText, BarChart3,
} from 'lucide-react';
import { type Company } from '../../api/companies';
import { type ActivityLog } from '../../api/activity';
import { getPlanBadge } from '../../utils/planColors';
import { useSaCompanies, useSaActivity, useSaPlans, useSaRevenueTrend } from '../../hooks/queries/useSaQueries';

const ini = (name?: string) => (name ?? 'System').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
const avatarBg = ['#eef2ff', '#f5f3ff', '#f0f9ff', '#f0fdf4', '#fffbeb', '#fdf4ff'];
const avatarColor = ['#6366f1', '#8b5cf6', '#0ea5e9', '#10b981', '#f59e0b', '#ec4899'];
const getAv = (name: string) => {
  const i = (name ?? 'A').charCodeAt(0) % avatarBg.length;
  return { bg: avatarBg[i]!, color: avatarColor[i]! };
};
const timeAgo = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};
const fmtDate = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

export default function DashboardPage() {
  const navigate = useNavigate();

  const { data: compData,   isLoading: compLoading  } = useSaCompanies({ limit: '6', page: '1' });
  const { data: plans = [], isLoading: plansLoading } = useSaPlans();
  const { data: actData,    isLoading: actLoading   } = useSaActivity({ limit: '5' });
  const { data: revenueTrend = [] } = useSaRevenueTrend();

  const companies   = useMemo(() => (compData?.companies ?? []) as Company[], [compData?.companies]);
  const rawStats    = compData?.stats       ?? { total: 0, active: 0, trial: 0, expiringSoon: 0 };
  const activities  = (actData?.logs        ?? []) as ActivityLog[];
  const loading     = compLoading || plansLoading || actLoading;

  const planPriceMap = useMemo(
    () => Object.fromEntries(plans.map((p) => [p.type.toUpperCase(), p.price])),
    [plans],
  );
  const mrr = useMemo(
    () => companies.reduce((sum, c) => sum + (planPriceMap[c.plan.toUpperCase()] ?? 0), 0),
    [companies, planPriceMap],
  );

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
        <Loader2 size={22} style={{ animation: 'spin 1s linear infinite' }} color="#0d7470" />
      </div>
    );
  }

  const STAT_CARDS = [
    { label: 'Total Companies',  value: String(rawStats.total),         sub: 'Registered on platform',    icon: Building2,   iconBg: '#eff6ff', iconColor: '#3b82f6' },
    { label: 'Monthly Revenue',  value: `₹${mrr.toLocaleString('en-IN')}`,     sub: 'From active subscriptions', icon: IndianRupee, iconBg: '#f0fdf4', iconColor: '#22c55e' },
    { label: 'Active Companies', value: String(rawStats.active),        sub: 'Across platform',            icon: Users,       iconBg: '#faf5ff', iconColor: '#a855f7' },
    { label: 'Expiring Soon',    value: String(rawStats.expiringSoon),  sub: 'Within 30 days',             icon: AlertTriangle,iconBg: '#fff7ed', iconColor: '#f97316' },
  ];

  const ALERTS = [
    ...(rawStats.expiringSoon > 0 ? [{ type: 'warning', text: `${rawStats.expiringSoon} subscription(s) expiring in 30 days`, color: '#f59e0b', bg: '#fffbeb' }] : []),
    ...(rawStats.trial > 0 ? [{ type: 'info', text: `${rawStats.trial} company/companies on trial plan`, color: '#3b82f6', bg: '#eff6ff' }] : []),
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a' }}>Dashboard</h1>
        <p style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>Manage your platform and monitor client companies</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
        {STAT_CARDS.map((s) => (
          <div key={s.label} style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '18px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div>
                <p style={{ fontSize: '12px', color: '#64748b', fontWeight: 500, marginBottom: '6px' }}>{s.label}</p>
                <p style={{ fontSize: '22px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.5px' }}>{s.value}</p>
              </div>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: s.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <s.icon size={17} color={s.iconColor} />
              </div>
            </div>
            <p style={{ fontSize: '11px', color: '#94a3b8' }}>{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Revenue Trend Chart */}
      <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '20px 22px', outline: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>Revenue Trend (Last 6 Months)</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '22px', height: '2px', backgroundColor: '#0d7470', borderRadius: '1px' }} />
            <span style={{ fontSize: '11px', color: '#0d7470', fontWeight: 600 }}>Revenue (₹)</span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={220} style={{ outline: 'none' }}>
          <LineChart data={revenueTrend} margin={{ top: 8, right: 16, bottom: 0, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 11, fill: '#94a3b8', fontFamily: 'Inter, sans-serif' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#94a3b8', fontFamily: 'Inter, sans-serif' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) => v >= 1000 ? `₹${(v / 1000).toFixed(0)}k` : `₹${v}`}
              width={55}
            />
            <Tooltip
              formatter={(v) => [`₹${Number(v ?? 0).toLocaleString('en-IN')}`, 'Revenue']}
              contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px', fontFamily: 'Inter, sans-serif' }}
            />
            <Line
              type="monotone"
              dataKey="revenue"
              stroke="#0d7470"
              strokeWidth={2}
              dot={{ r: 5, fill: 'white', stroke: '#0d7470', strokeWidth: 2 }}
              activeDot={{ r: 6, fill: '#0d7470' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        {/* Alerts */}
        <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <AlertTriangle size={16} color="#f59e0b" />
            <h2 style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>Alerts & Issues</h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {ALERTS.length === 0 && (
              <p style={{ fontSize: '12px', color: '#94a3b8', textAlign: 'center', padding: '16px' }}>No alerts — all good!</p>
            )}
            {ALERTS.map((a, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '10px 12px', borderRadius: '8px', backgroundColor: a.bg, border: `1px solid ${a.color}22` }}>
                <AlertCircle size={15} color={a.color} style={{ flexShrink: 0, marginTop: '1px' }} />
                <p style={{ fontSize: '12px', color: '#374151', fontWeight: 500 }}>{a.text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <Activity size={16} color="#0d7470" />
            <h2 style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>Recent Activity</h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {activities.length === 0 && (
              <p style={{ fontSize: '12px', color: '#94a3b8', textAlign: 'center', padding: '16px' }}>No recent activity</p>
            )}
            {activities.map((a, i) => {
              const name = a.user?.name ?? 'System';
              const av = getAv(name);
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: av.bg, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: av.color }}>
                    {ini(name)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: '13px', color: '#0f172a', fontWeight: 500 }}>{a.action}</p>
                    <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>{name} · {timeAgo(a.createdAt)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Companies Overview */}
      <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px', borderBottom: '1px solid #f1f5f9' }}>
          <div>
            <h2 style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>Companies Overview</h2>
            <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>Recent client companies</p>
          </div>
          <button onClick={() => navigate('/super-admin/companies')} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', fontWeight: 600, color: '#0d7470', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
            View All <ArrowUpRight size={14} />
          </button>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: '#f8fafc' }}>
              {['Company', 'Plan', 'Users', 'Status', 'Expiry', ''].map((h) => (
                <th key={h} style={{ textAlign: 'left', padding: '10px 22px', fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.4px', borderBottom: '1px solid #f1f5f9' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {companies.length === 0 && (
              <tr><td colSpan={6} style={{ padding: '24px', textAlign: 'center', fontSize: '13px', color: '#94a3b8' }}>No companies yet</td></tr>
            )}
            {companies.map((c, i) => {
              const av = getAv(c.name);
              const ps = getPlanBadge(c.plan, plans);
              const now = Date.now();
              const expMs = c.planExpiry ? new Date(c.planExpiry).getTime() : 0;
              const daysLeft = c.planExpiry ? Math.ceil((expMs - now) / 86400000) : null;
              const expired = daysLeft !== null && daysLeft <= 0;
              const warn    = daysLeft !== null && daysLeft > 0 && daysLeft <= 30;
              return (
                <tr key={c.id} style={{ borderBottom: i < companies.length - 1 ? '1px solid #f8fafc' : 'none' }}>
                  <td style={{ padding: '13px 22px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '11px' }}>
                      <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: av.bg, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: av.color, fontWeight: 700, fontSize: '12px' }}>{ini(c.name)}</div>
                      <div>
                        <p style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>{c.name}</p>
                        <p style={{ fontSize: '11px', color: '#94a3b8' }}>{c.industry ?? '—'}</p>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '13px 22px' }}>
                    <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 600, backgroundColor: ps.bg, color: ps.color, border: `1px solid ${ps.border}` }}>{ps.label}</span>
                  </td>
                  <td style={{ padding: '13px 22px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Users size={13} color="#94a3b8" />
                      <span style={{ fontSize: '13px', color: '#374151', fontWeight: 500 }}>{c.userCount}</span>
                    </div>
                  </td>
                  <td style={{ padding: '13px 22px' }}>
                    <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 600, backgroundColor: c.status === 'ACTIVE' ? '#dcfce7' : c.status === 'TRIAL' ? '#fef9c3' : '#f1f5f9', color: c.status === 'ACTIVE' ? '#15803d' : c.status === 'TRIAL' ? '#854d0e' : '#64748b' }}>
                      {c.status}
                    </span>
                  </td>
                  <td style={{ padding: '13px 22px' }}>
                    <p style={{ fontSize: '13px', color: expired ? '#dc2626' : warn ? '#d97706' : '#374151', fontWeight: (expired || warn) ? 600 : 400 }}>
                      {expired ? 'Expired' : fmtDate(c.planExpiry ?? null)}
                    </p>
                    {warn && <p style={{ fontSize: '11px', color: '#d97706', marginTop: '1px' }}>{daysLeft} days left</p>}
                  </td>
                  <td style={{ padding: '13px 22px' }}>
                    <button onClick={() => navigate(`/super-admin/companies`)} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', fontWeight: 600, color: '#0d7470', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
                      View <ArrowUpRight size={13} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Quick Actions */}
      <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '18px 22px' }}>
        <p style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '14px' }}>QUICK ACTIONS</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
          {[
            { icon: Download, label: 'Download Payroll',  path: '/super-admin/companies' },
            { icon: Shield,   label: 'Manage Roles',      path: '/super-admin/companies' },
            { icon: FileText, label: 'Download Summary',  path: '/super-admin/subscriptions' },
            { icon: BarChart3,label: 'View Reports',      path: '/super-admin/activity' },
          ].map(({ icon: Icon, label, path }) => (
            <button key={label} onClick={() => navigate(path)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', padding: '18px 12px', borderRadius: '10px', border: '1px solid #e2e8f0', backgroundColor: 'white', cursor: 'pointer', fontFamily: 'Inter, sans-serif', transition: 'all 0.15s' }}
              onMouseEnter={(e) => { const el = e.currentTarget as HTMLElement; el.style.backgroundColor = '#f8fafc'; el.style.borderColor = '#0d7470'; }}
              onMouseLeave={(e) => { const el = e.currentTarget as HTMLElement; el.style.backgroundColor = 'white'; el.style.borderColor = '#e2e8f0'; }}>
              <Icon size={22} color="#0d7470" />
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#374151' }}>{label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
