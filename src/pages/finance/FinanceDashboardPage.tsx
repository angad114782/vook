import { useNavigate } from 'react-router-dom';
import { UserCheck, UserX, Receipt, DollarSign, Loader2 } from 'lucide-react';
import { useFinanceAttendance, useFinanceExpenses } from '../../hooks/queries/useFinanceQueries';

interface DashStats {
  presentToday: number;
  absentToday: number;
  pendingExpenses: number;
  totalPayroll: number;
  expensesByCategory: { label: string; value: number }[];
  recentExpenses: { label: string; amount: number; type: string; status: string }[];
}

const STATUS_COLOR: Record<string, { color: string; bg: string }> = {
  Approved:  { color: '#16a34a', bg: '#f0fdf4' },
  Pending:   { color: '#ea580c', bg: '#fff7ed' },
  Rejected:  { color: '#dc2626', bg: '#fef2f2' },
  Processed: { color: '#16a34a', bg: '#f0fdf4' },
};

function HBarChart({ bars }: { bars: { label: string; value: number }[] }) {
  const max = Math.max(...bars.map((b) => b.value), 1);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {bars.map((b) => (
        <div key={b.label} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '11px', color: '#64748b', width: '72px', flexShrink: 0, textAlign: 'right' }}>{b.label}</span>
          <div style={{ flex: 1, height: '14px', backgroundColor: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{ width: `${(b.value / max) * 100}%`, height: '100%', backgroundColor: '#0d7470', borderRadius: '4px' }} />
          </div>
          <span style={{ fontSize: '10px', color: '#94a3b8', width: '60px' }}>{b.value > 0 ? `₹${(b.value / 1000).toFixed(0)}k` : '—'}</span>
        </div>
      ))}
      {bars.length === 0 && <p style={{ fontSize: '12px', color: '#94a3b8', textAlign: 'center', padding: '12px' }}>No expense data</p>}
    </div>
  );
}

export default function FinanceDashboardPage() {
  const navigate = useNavigate();

  const { data: attData, isLoading: attLoading } = useFinanceAttendance();
  const { data: expData, isLoading: expLoading } = useFinanceExpenses({ limit: '10', sort: 'createdAt' });

  const loading = attLoading || expLoading;

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
        <Loader2 size={22} style={{ animation: 'spin 1s linear infinite' }} color="#0d7470" />
      </div>
    );
  }

  const att = attData?.stats;
  const expenses = expData?.expenses ?? [];

  const categoryMap: Record<string, number> = {};
  expenses.forEach((e) => {
    categoryMap[e.category] = (categoryMap[e.category] ?? 0) + e.amount;
  });
  const expensesByCategory = Object.entries(categoryMap)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  const s: DashStats = {
    presentToday:      att?.presentToday ?? 0,
    absentToday:       att?.absent ?? 0,
    pendingExpenses:   expData?.stats?.pending ?? 0,
    totalPayroll:      0,
    expensesByCategory,
    recentExpenses: expenses.slice(0, 5).map((e) => ({
      label:  `${e.category} – ${e.employee?.user?.name ?? 'Employee'}`,
      amount: e.amount,
      type:   'Expense',
      status: e.status,
    })),
  };

  const STAT_CARDS = [
    { label: 'Present Today',  value: s.presentToday,    icon: UserCheck, iconBg: '#f0fdf4', iconColor: '#16a34a' },
    { label: 'Absent Today',   value: s.absentToday,     icon: UserX,     iconBg: '#fef2f2', iconColor: '#dc2626' },
    { label: 'Pending Expenses', value: s.pendingExpenses, icon: Receipt,  iconBg: '#fff7ed', iconColor: '#ea580c' },
    { label: 'Total Payroll',  value: s.totalPayroll,    icon: DollarSign,iconBg: '#eff6ff', iconColor: '#2563eb' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a' }}>Dashboard</h1>
        <p style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>Overview of today's attendance and financial status</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
        {STAT_CARDS.map(({ label, value, icon: Icon, iconBg, iconColor }) => (
          <div key={label} style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '16px 18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
              <p style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.3px' }}>{label}</p>
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={15} color={iconColor} />
              </div>
            </div>
            <p style={{ fontSize: '26px', fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>{value}</p>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '18px 20px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', marginBottom: '4px' }}>Expense Breakdown</h3>
          <p style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '16px' }}>By category (recent expenses)</p>
          <HBarChart bars={s.expensesByCategory} />
        </div>
        <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '18px 20px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', marginBottom: '4px' }}>Expense Status</h3>
          <p style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '16px' }}>Current snapshot</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
            {[
              { label: 'Pending',  value: s.pendingExpenses, color: '#ea580c', bg: '#fff7ed' },
            ].map(({ label, value, color, bg }) => (
              <div key={label} style={{ textAlign: 'center', padding: '14px 10px', borderRadius: '10px', backgroundColor: bg }}>
                <p style={{ fontSize: '24px', fontWeight: 800, color }}>{value}</p>
                <p style={{ fontSize: '10px', color: '#64748b', marginTop: '4px', fontWeight: 600 }}>{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>Recent Expenses</h3>
            <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>Latest expense submissions</p>
          </div>
          <button onClick={() => navigate('/finance/expenses')} style={{ fontSize: '12px', color: '#0d7470', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }}>View All →</button>
        </div>
        <div>
          {s.recentExpenses.length === 0 && (
            <p style={{ padding: '24px', textAlign: 'center', fontSize: '13px', color: '#94a3b8' }}>No recent expenses</p>
          )}
          {s.recentExpenses.map((t, i) => {
            const sc = STATUS_COLOR[t.status] ?? { color: '#64748b', bg: '#f8fafc' };
            return (
              <div key={i} style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: i < s.recentExpenses.length - 1 ? '1px solid #f8fafc' : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '34px', height: '34px', borderRadius: '8px', backgroundColor: sc.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Receipt size={14} color={sc.color} />
                  </div>
                  <div>
                    <p style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>{t.label}</p>
                    <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '1px' }}>{t.type}</p>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>₹{t.amount.toLocaleString('en-IN')}</p>
                  <span style={{ padding: '2px 8px', borderRadius: '20px', fontSize: '10px', fontWeight: 700, backgroundColor: sc.bg, color: sc.color }}>{t.status}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
