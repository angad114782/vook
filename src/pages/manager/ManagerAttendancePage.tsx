import { useState } from 'react';
import { type AttendanceRecord } from '../../api/hr';
import { Loader2, Search } from 'lucide-react';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import PaginationBar from '../../components/data/Pagination';
import { useHrAttendance } from '../../hooks/queries/useHrQueries';
import { useQuery } from '@tanstack/react-query';
import { hrApi } from '../../api/hr';

interface AttendanceData {
  stats: { totalWorkforce: number; presentToday: number; absent: number; lateArrivals: number; onLeave?: number };
  departments: { department: string; present: number; total: number }[];
}

function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div style={{ flex: 1, height: '6px', borderRadius: '3px', backgroundColor: '#f1f5f9', overflow: 'hidden' }}>
      <div style={{ width: `${pct}%`, height: '100%', borderRadius: '3px', backgroundColor: color, transition: 'width 0.4s' }} />
    </div>
  );
}

export default function ManagerAttendancePage() {
  const [tab, setTab] = useState<'overview' | 'records'>('overview');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [monthFilter, setMonthFilter] = useState(String(new Date().getMonth() + 1));
  const [yearFilter, setYearFilter] = useState(String(new Date().getFullYear()));
  const debouncedSearch = useDebouncedValue(search, 500);

  const { data: overviewData, isLoading: loading } = useHrAttendance();

  const recordsParams: Record<string, string> = { page: String(page), limit: '20', month: monthFilter, year: yearFilter };
  if (debouncedSearch) recordsParams.search = debouncedSearch;

  const { data: recordsData, isLoading: recordsLoading } = useQuery({
    queryKey: ['mgr', 'attendance', recordsParams],
    queryFn: () => hrApi.getAttendanceRecords(recordsParams).then((r) => r.data),
    enabled: tab === 'records',
  });

  const records: AttendanceRecord[] = recordsData?.records ?? [];
  const pagination = recordsData?.pagination ?? { total: 0, page: 1, limit: 20, totalPages: 1 };

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px', gap: '10px', color: '#64748b' }}>
      <Loader2 size={24} style={{ animation: 'spin 1s linear infinite' }} />
      <span style={{ fontSize: '14px' }}>Loading attendance data...</span>
    </div>
  );

  const data = overviewData as AttendanceData | undefined;
  const s = data?.stats ?? { totalWorkforce: 0, presentToday: 0, absent: 0, lateArrivals: 0, onLeave: 0 };
  const deps = data?.departments ?? [];
  const total = s.totalWorkforce || 1;

  const STAT_CARDS = [
    { label: 'Present Today',   value: s.presentToday,  sub: `${Math.round((s.presentToday / total) * 100)}% attendance rate`, color: '#16a34a', bg: '#f0fdf4' },
    { label: 'Absent Today',    value: s.absent,        sub: `${Math.round((s.absent / total) * 100)}% absence rate`,           color: '#dc2626', bg: '#fef2f2' },
    { label: 'Late Arrivals',   value: s.lateArrivals,  sub: 'Checked in after 9:30 AM',                                        color: '#ea580c', bg: '#fff7ed' },
    { label: 'On Leave',        value: s.onLeave ?? 0,  sub: 'Approved leaves today',                                            color: '#7c3aed', bg: '#f5f3ff' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a' }}>Attendance</h1>
        <p style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>Monitor team attendance and punctuality</p>
      </div>

      <div style={{ display: 'flex', backgroundColor: 'white', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '4px', gap: '2px', width: 'fit-content' }}>
        {(['overview', 'records'] as const).map((key) => (
          <button key={key} onClick={() => setTab(key)} style={{ padding: '8px 18px', border: 'none', borderRadius: '7px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, fontFamily: 'Inter, sans-serif', backgroundColor: tab === key ? '#0d7470' : 'transparent', color: tab === key ? 'white' : '#64748b' }}>
            {key === 'overview' ? 'Overview' : 'Daily Records'}
          </button>
        ))}
      </div>

      {tab === 'overview' ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
            {STAT_CARDS.map(({ label, value, sub, color }) => (
              <div key={label} style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '18px 20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <p style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>{label}</p>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: color }} />
                </div>
                <p style={{ fontSize: '28px', fontWeight: 800, color, lineHeight: 1 }}>{value}</p>
                <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '6px' }}>{sub}</p>
              </div>
            ))}
          </div>

          <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>Department-wise Attendance</h3>
              <p style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>Present vs total by department</p>
            </div>
            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {deps.map((d) => {
                const pct = d.total > 0 ? Math.round((d.present / d.total) * 100) : 0;
                const color = pct >= 80 ? '#16a34a' : pct >= 60 ? '#ea580c' : '#dc2626';
                return (
                  <div key={d.department}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>{d.department}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '12px', color: '#64748b' }}>{d.present}/{d.total}</span>
                        <span style={{ fontSize: '12px', fontWeight: 700, color }}>{pct}%</span>
                      </div>
                    </div>
                    <ProgressBar value={d.present} max={d.total} color={color} />
                  </div>
                );
              })}
              {deps.length === 0 && <p style={{ fontSize: '13px', color: '#94a3b8', textAlign: 'center', padding: '20px 0' }}>No department data available</p>}
            </div>
          </div>
        </>
      ) : (
        <>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ position: 'relative' }}>
              <Search size={13} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search employee..." style={{ paddingLeft: '32px', paddingRight: '10px', paddingTop: '7px', paddingBottom: '7px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '12px', outline: 'none', fontFamily: 'Inter, sans-serif', color: '#374151', width: '220px' }} />
            </div>
            <select value={monthFilter} onChange={(e) => { setMonthFilter(e.target.value); setPage(1); }} style={{ padding: '7px 10px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '12px' }}>
              {Array.from({ length: 12 }, (_, i) => String(i + 1)).map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
            <select value={yearFilter} onChange={(e) => { setYearFilter(e.target.value); setPage(1); }} style={{ padding: '7px 10px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '12px' }}>
              {[String(new Date().getFullYear() - 1), String(new Date().getFullYear()), String(new Date().getFullYear() + 1)].map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>

          <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
            {recordsLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '50px' }}><Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} color="#0d7470" /></div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc' }}>
                    {['Date', 'Employee', 'Department', 'Check In', 'Check Out', 'Status'].map((h) => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', borderBottom: '1px solid #f1f5f9' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {records.map((r, i) => (
                    <tr key={r.id} style={{ borderBottom: i < records.length - 1 ? '1px solid #f8fafc' : 'none' }}>
                      <td style={{ padding: '10px 14px', fontSize: '12px', color: '#374151' }}>{new Date(r.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</td>
                      <td style={{ padding: '10px 14px', fontSize: '12px', color: '#0f172a', fontWeight: 600 }}>{r.employeeId.userId.name}</td>
                      <td style={{ padding: '10px 14px', fontSize: '12px', color: '#374151' }}>{r.employeeId.department ?? '—'}</td>
                      <td style={{ padding: '10px 14px', fontSize: '12px', color: '#374151' }}>{r.checkIn ?? '—'}</td>
                      <td style={{ padding: '10px 14px', fontSize: '12px', color: '#374151' }}>{r.checkOut ?? '—'}</td>
                      <td style={{ padding: '10px 14px', fontSize: '12px', color: '#374151' }}>{r.status}</td>
                    </tr>
                  ))}
                  {records.length === 0 && <tr><td colSpan={6} style={{ padding: '40px', textAlign: 'center', fontSize: '13px', color: '#94a3b8' }}>No attendance records found</td></tr>}
                </tbody>
              </table>
            )}
          </div>
          <PaginationBar page={pagination.page} totalPages={pagination.totalPages} total={pagination.total} limit={pagination.limit} onPageChange={(p) => setPage(p)} />
        </>
      )}
    </div>
  );
}
