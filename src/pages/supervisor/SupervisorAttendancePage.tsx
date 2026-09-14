import { useState, useMemo } from 'react';
import type { AttendanceRecord } from '../../api/hr';
import type { Pagination } from '../../api/hr';
import PaginationBar from '../../components/data/Pagination';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { Loader2, Search, Download } from 'lucide-react';
import { useSupAttendanceSummary, useSupAttendance } from '../../hooks/queries/useSupQueries';

interface AttendanceData {
  stats: { totalWorkforce: number; presentToday: number; absent: number; lateArrivals: number; onLeave?: number };
  departments: { department: string; present: number; total: number }[];
}

const STATUS_META: Record<string, { bg: string; color: string }> = {
  Present: { bg: '#f0fdf4', color: '#16a34a' },
  Late:    { bg: '#fff7ed', color: '#ea580c' },
  Absent:  { bg: '#fef2f2', color: '#dc2626' },
  Leave:   { bg: '#eff6ff', color: '#2563eb' },
  Holiday: { bg: '#f5f3ff', color: '#7c3aed' },
};

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
const fmtTime = (t: string | null) => t ? t : '—';

function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div style={{ flex: 1, height: '6px', borderRadius: '3px', backgroundColor: '#f1f5f9', overflow: 'hidden' }}>
      <div style={{ width: `${pct}%`, height: '100%', borderRadius: '3px', backgroundColor: color }} />
    </div>
  );
}

export default function SupervisorAttendancePage() {
  const [tab, setTab] = useState<'overview' | 'records'>('overview');

  // Records state
  const [page, setPage]               = useState(1);
  const [search, setSearch]           = useState('');
  const [monthFilter, setMonthFilter] = useState(String(new Date().getMonth() + 1));
  const [yearFilter, setYearFilter]   = useState(String(new Date().getFullYear()));
  const debouncedSearch = useDebouncedValue(search, 500);

  const { data: overviewRaw, isLoading: overviewLoading } = useSupAttendanceSummary();

  const recordsParams = useMemo(() => {
    const p: Record<string, string> = { page: String(page), limit: '20', month: monthFilter, year: yearFilter };
    if (debouncedSearch) p.search = debouncedSearch;
    return p;
  }, [page, debouncedSearch, monthFilter, yearFilter]);

  const { data: recordsData, isLoading: recordsLoading } = useSupAttendance(
    tab === 'records' ? recordsParams : undefined
  );

  const overview = overviewRaw as AttendanceData | undefined;
  const records: AttendanceRecord[]  = recordsData?.records ?? [];
  const pagination: Pagination = recordsData?.pagination ?? { total: 0, page: 1, limit: 20, totalPages: 1 };

  const s    = overview?.stats ?? { totalWorkforce: 0, presentToday: 0, absent: 0, lateArrivals: 0, onLeave: 0 };
  const deps = overview?.departments ?? [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a' }}>Attendance</h1>
          <p style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>Track and manage team attendance</p>
        </div>
        <button style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', border: '1.5px solid #e2e8f0', borderRadius: '8px', backgroundColor: 'white', color: '#374151', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
          <Download size={13} /> Export
        </button>
      </div>

      {/* Tab switcher */}
      <div style={{ display: 'flex', backgroundColor: 'white', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '4px', gap: '2px', width: 'fit-content' }}>
        {[['overview', 'Overview'], ['records', 'Daily Records']].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key as 'overview' | 'records')} style={{ padding: '8px 18px', border: 'none', borderRadius: '7px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, fontFamily: 'Inter, sans-serif', backgroundColor: tab === key ? '#0d7470' : 'transparent', color: tab === key ? 'white' : '#64748b', transition: 'all 0.15s' }}>{label}</button>
        ))}
      </div>

      {/* ── Overview Tab ── */}
      {tab === 'overview' && (
        <>
          {overviewLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '60px', gap: '10px', color: '#64748b' }}><Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} /></div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
                {[
                  { label: 'Present Today', value: s.presentToday,  color: '#16a34a' },
                  { label: 'Absent Today',  value: s.absent,        color: '#dc2626' },
                  { label: 'Late Arrivals', value: s.lateArrivals,  color: '#ea580c' },
                  { label: 'On Leave',      value: s.onLeave ?? 0,  color: '#7c3aed' },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '18px 20px' }}>
                    <p style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>{label}</p>
                    <p style={{ fontSize: '28px', fontWeight: 800, color, marginTop: '6px', lineHeight: 1 }}>{value}</p>
                  </div>
                ))}
              </div>

              <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>Department-wise Attendance</h3>
                </div>
                <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {deps.map((d) => {
                    const pct = d.total > 0 ? Math.round((d.present / d.total) * 100) : 0;
                    const color = pct >= 80 ? '#16a34a' : pct >= 60 ? '#ea580c' : '#dc2626';
                    return (
                      <div key={d.department}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                          <span style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>{d.department}</span>
                          <div style={{ display: 'flex', gap: '12px' }}>
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
          )}
        </>
      )}

      {/* ── Records Tab ── */}
      {tab === 'records' && (
        <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1, maxWidth: '280px' }}>
              <Search size={13} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search employee..." style={{ width: '100%', paddingLeft: '32px', paddingRight: '10px', paddingTop: '6px', paddingBottom: '6px', border: '1.5px solid #e2e8f0', borderRadius: '8px', fontSize: '12px', outline: 'none', fontFamily: 'Inter, sans-serif', color: '#374151', backgroundColor: '#f8fafc' }} />
            </div>
            <select value={monthFilter} onChange={(e) => { setMonthFilter(e.target.value); setPage(1); }} style={{ padding: '6px 10px', border: '1.5px solid #e2e8f0', borderRadius: '8px', fontSize: '12px', color: '#374151', backgroundColor: 'white', cursor: 'pointer', outline: 'none', fontFamily: 'Inter, sans-serif' }}>
              {MONTHS.map((m, i) => <option key={m} value={String(i + 1)}>{m}</option>)}
            </select>
            <select value={yearFilter} onChange={(e) => { setYearFilter(e.target.value); setPage(1); }} style={{ padding: '6px 10px', border: '1.5px solid #e2e8f0', borderRadius: '8px', fontSize: '12px', color: '#374151', backgroundColor: 'white', cursor: 'pointer', outline: 'none', fontFamily: 'Inter, sans-serif' }}>
              <option>2026</option><option>2025</option>
            </select>
          </div>

          {recordsLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '60px', gap: '10px', color: '#64748b' }}>
              <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} /><span style={{ fontSize: '14px' }}>Loading...</span>
            </div>
          ) : records.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 24px' }}>
              <p style={{ fontSize: '14px', fontWeight: 600, color: '#94a3b8' }}>No records found for this period</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc' }}>
                    {['Date', 'Employee', 'Department', 'Check In', 'Check Out', 'Status'].map((h) => (
                      <th key={h} style={{ textAlign: 'left', padding: '10px 16px', fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.4px', borderBottom: '1px solid #f1f5f9', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {records.map((r, i) => {
                    const sm = STATUS_META[r.status] ?? STATUS_META['Present']!;
                    const emp = r.employeeId;
                    return (
                      <tr key={r.id} style={{ borderBottom: i < records.length - 1 ? '1px solid #f8fafc' : 'none' }}>
                        <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap' }}>{fmtDate(r.date)}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <p style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>{emp?.userId?.name ?? '—'}</p>
                          <p style={{ fontSize: '11px', color: '#94a3b8' }}>{emp?.employeeId ?? ''}</p>
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: '12px', color: '#64748b' }}>{emp?.department ?? '—'}</td>
                        <td style={{ padding: '12px 16px', fontSize: '13px', color: '#374151' }}>{fmtTime(r.checkIn)}</td>
                        <td style={{ padding: '12px 16px', fontSize: '13px', color: '#374151' }}>{fmtTime(r.checkOut)}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ padding: '3px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: 600, backgroundColor: sm.bg, color: sm.color }}>{r.status}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <PaginationBar page={pagination.page} totalPages={pagination.totalPages} total={pagination.total} limit={20} onPageChange={(p) => setPage(p)} />
        </div>
      )}
    </div>
  );
}
