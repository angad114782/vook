import { useState } from 'react';
import { type AttendanceRecord } from '../../api/hr';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import PaginationBar from '../../components/data/Pagination';
import { Loader2, Search } from 'lucide-react';
import { useHrAttendance, useAttendanceRecords } from '../../hooks/queries/useHrQueries';

const STATUS_META: Record<string, { bg: string; color: string }> = {
  Present: { bg: '#f0fdf4', color: '#16a34a' },
  Late:    { bg: '#fff7ed', color: '#ea580c' },
  Absent:  { bg: '#fef2f2', color: '#dc2626' },
  Leave:   { bg: '#eff6ff', color: '#2563eb' },
  Holiday: { bg: '#f5f3ff', color: '#7c3aed' },
};

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
const fmtTime = (t: string | null) => t ?? '—';

export default function CAAttendancePage() {
  const [tab, setTab] = useState<'overview' | 'departments' | 'records'>('overview');

  // Records filters
  const [page, setPage]               = useState(1);
  const [search, setSearch]           = useState('');
  const [monthFilter, setMonthFilter] = useState(String(new Date().getMonth() + 1));
  const [yearFilter, setYearFilter]   = useState(String(new Date().getFullYear()));
  const debouncedSearch = useDebouncedValue(search, 500);

  const { data: overviewData, isLoading: overviewLoading } = useHrAttendance();

  const recordsParams: Record<string, string> = { page: String(page), limit: '20', month: monthFilter, year: yearFilter };
  if (debouncedSearch) recordsParams.search = debouncedSearch;

  const { data: recordsData, isLoading: recordsLoading } = useAttendanceRecords(
    tab === 'records' ? recordsParams : undefined,
  );

  const s    = overviewData?.stats;
  const deps = (overviewData as any)?.departments ?? [];

  const records    = recordsData?.records    ?? [];
  const pagination = recordsData?.pagination ?? { total: 0, page: 1, limit: 20, totalPages: 1 };

  const STAT_CARDS = [
    { label: 'Total Workforce', value: s?.totalWorkforce ?? 0, sub: `${(s as any)?.perm ?? 0} Perm | ${(s as any)?.cont ?? 0} Cont`, color: '#3b82f6' },
    { label: 'Present Today',   value: s?.presentToday ?? 0,   sub: `${(s as any)?.presentPct ?? 0}% of total`,              color: '#0d7470'  },
    { label: 'Absent Today',    value: s?.absent ?? 0,          sub: `${(s as any)?.absentPct ?? 0}% of total`,               color: '#ea580c'  },
    { label: 'Late Arrivals',   value: s?.lateArrivals ?? 0,    sub: 'Checked in after 09:00',                                color: '#d97706'  },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div>
        <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a' }}>Attendance</h1>
        <p style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>Monitor daily attendance across departments</p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', backgroundColor: '#f1f5f9', borderRadius: '8px', padding: '3px', width: 'fit-content' }}>
        {(['overview', 'departments', 'records'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} style={{ padding: '6px 14px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 600, fontFamily: 'Inter, sans-serif', backgroundColor: tab === t ? 'white' : 'transparent', color: tab === t ? '#0d4a47' : '#64748b', boxShadow: tab === t ? '0 1px 4px rgba(0,0,0,0.08)' : 'none' }}>
            {t === 'overview' ? 'Overview' : t === 'departments' ? 'By Department' : 'Daily Records'}
          </button>
        ))}
      </div>

      {/* ── Overview ── */}
      {tab === 'overview' && (
        <>
          {overviewLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '80px', gap: '10px', color: '#64748b' }}>
              <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} /><span style={{ fontSize: '14px' }}>Loading...</span>
            </div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                {STAT_CARDS.map(({ label, value, sub, color }) => (
                  <div key={label} style={{ backgroundColor: 'white', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '14px 16px' }}>
                    <p style={{ fontSize: '28px', fontWeight: 800, color, lineHeight: 1 }}>{value.toLocaleString()}</p>
                    <p style={{ fontSize: '11px', fontWeight: 600, color: '#374151', marginTop: '4px' }}>{label}</p>
                    <p style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>{sub}</p>
                  </div>
                ))}
              </div>

              {deps.length === 0 ? (
                <div style={{ backgroundColor: 'white', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '40px', textAlign: 'center' }}>
                  <p style={{ fontSize: '14px', fontWeight: 600, color: '#94a3b8' }}>No attendance records for today yet</p>
                  <p style={{ fontSize: '12px', color: '#cbd5e1', marginTop: '4px' }}>Records appear once employees check in or HR logs attendance</p>
                </div>
              ) : (
                <div style={{ backgroundColor: 'white', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '16px 18px' }}>
                  <h3 style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', marginBottom: '16px' }}>Department Summary — Today</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {deps.map((d: { department: string; present: number; total: number; percentage: number }) => (
                      <div key={d.department}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                          <span style={{ fontSize: '13px', fontWeight: 500, color: '#0f172a' }}>{d.department}</span>
                          <div style={{ display: 'flex', gap: '12px' }}>
                            <span style={{ fontSize: '12px', color: '#64748b' }}>{d.present}/{d.total} present</span>
                            <span style={{ fontSize: '13px', fontWeight: 700, color: '#0d7470' }}>{d.percentage}%</span>
                          </div>
                        </div>
                        <div style={{ height: '6px', backgroundColor: '#f1f5f9', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${d.percentage}%`, backgroundColor: d.percentage >= 90 ? '#0d7470' : d.percentage >= 75 ? '#d97706' : '#ea580c', borderRadius: '3px', transition: 'width 0.5s ease' }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* ── By Department ── */}
      {tab === 'departments' && (
        <div style={{ backgroundColor: 'white', borderRadius: '10px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid #e2e8f0' }}>
            <h3 style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>Attendance by Department — Today</h3>
          </div>
          {overviewLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}><Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} color="#0d7470" /></div>
          ) : deps.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center' }}>
              <p style={{ fontSize: '13px', color: '#94a3b8' }}>No department data available for today</p>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc' }}>
                  {['Department', 'Total', 'Present', 'Absent', 'Rate'].map((h) => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid #e2e8f0' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {deps.map((d: { department: string; total: number; present: number; percentage: number }, idx: number) => {
                  const absent = d.total - d.present;
                  return (
                    <tr key={d.department} style={{ backgroundColor: idx % 2 === 0 ? 'white' : '#fafafa' }}>
                      <td style={{ padding: '11px 16px', fontSize: '12px', fontWeight: 600, color: '#0f172a', borderBottom: '1px solid #f1f5f9' }}>{d.department}</td>
                      <td style={{ padding: '11px 16px', fontSize: '12px', color: '#374151', borderBottom: '1px solid #f1f5f9' }}>{d.total}</td>
                      <td style={{ padding: '11px 16px', fontSize: '12px', color: '#0d7470', fontWeight: 600, borderBottom: '1px solid #f1f5f9' }}>{d.present}</td>
                      <td style={{ padding: '11px 16px', fontSize: '12px', color: '#ea580c', fontWeight: 600, borderBottom: '1px solid #f1f5f9' }}>{absent}</td>
                      <td style={{ padding: '11px 16px', borderBottom: '1px solid #f1f5f9' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ flex: 1, height: '6px', backgroundColor: '#e2e8f0', borderRadius: '3px' }}>
                            <div style={{ width: `${d.percentage}%`, height: '100%', backgroundColor: d.percentage >= 90 ? '#0d7470' : d.percentage >= 75 ? '#d97706' : '#ea580c', borderRadius: '3px' }} />
                          </div>
                          <span style={{ fontSize: '11px', fontWeight: 700, color: '#374151', minWidth: '34px' }}>{d.percentage}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Daily Records ── */}
      {tab === 'records' && (
        <div style={{ backgroundColor: 'white', borderRadius: '10px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
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
              <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /><span style={{ fontSize: '13px' }}>Loading records...</span>
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
                    {['Date', 'Employee', 'Department', 'Check In', 'Check Out', 'Status', 'Source'].map((h) => (
                      <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px', borderBottom: '1px solid #f1f5f9', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {records.map((r: AttendanceRecord, i: number) => {
                    const sm  = STATUS_META[r.status] ?? STATUS_META['Present']!;
                    const emp = r.employeeId;
                    return (
                      <tr key={r.id} style={{ borderBottom: i < records.length - 1 ? '1px solid #f8fafc' : 'none' }}>
                        <td style={{ padding: '11px 16px', fontSize: '12px', fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap' }}>{fmtDate(r.date)}</td>
                        <td style={{ padding: '11px 16px' }}>
                          <p style={{ fontSize: '12px', fontWeight: 600, color: '#0f172a' }}>{emp?.userId?.name ?? '—'}</p>
                          <p style={{ fontSize: '10px', color: '#94a3b8' }}>{emp?.employeeId ?? ''}</p>
                        </td>
                        <td style={{ padding: '11px 16px', fontSize: '12px', color: '#64748b' }}>{emp?.department ?? '—'}</td>
                        <td style={{ padding: '11px 16px', fontSize: '12px', color: '#374151' }}>{fmtTime(r.checkIn)}</td>
                        <td style={{ padding: '11px 16px', fontSize: '12px', color: '#374151' }}>{fmtTime(r.checkOut)}</td>
                        <td style={{ padding: '11px 16px' }}>
                          <span style={{ padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: 600, backgroundColor: sm.bg, color: sm.color }}>{r.status}</span>
                        </td>
                        <td style={{ padding: '11px 16px', fontSize: '11px', color: '#94a3b8' }}>{r.source}</td>
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
