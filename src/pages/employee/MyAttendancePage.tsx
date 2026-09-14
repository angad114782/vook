import { useState } from 'react';
import { type AttendanceRecord, type TodayAttendance } from '../../api/employee';
import { Loader2, LogIn, LogOut } from 'lucide-react';
import { useMyAttendance, useTodayAttendance } from '../../hooks/queries/useEmployeeQueries';
import { useCheckIn, useCheckOut } from '../../hooks/mutations/useEmployeeMutations';
import { toast } from 'sonner';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const STATUS_STYLE: Record<string, { bg: string; color: string; dot: string }> = {
  Present:  { bg: '#f0fdf4', color: '#15803d', dot: '#16a34a' },
  Late:     { bg: '#fff7ed', color: '#c2410c', dot: '#ea580c' },
  Absent:   { bg: '#fef2f2', color: '#b91c1c', dot: '#dc2626' },
  Leave:    { bg: '#eff6ff', color: '#1d4ed8', dot: '#2563eb' },
  Weekend:  { bg: '#f8fafc', color: '#94a3b8', dot: '#cbd5e1' },
  Upcoming: { bg: '#f8fafc', color: '#94a3b8', dot: '#e2e8f0' },
};

export default function MyAttendancePage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year,  setYear]  = useState(now.getFullYear());
  const [view,  setView]  = useState<'table' | 'summary'>('table');

  const { data: todayData, isLoading: todayLoading } = useTodayAttendance();
  const { data: attData,   isLoading: loading       } = useMyAttendance({ month: String(month), year: String(year) });
  const checkIn  = useCheckIn();
  const checkOut = useCheckOut();

  const today   = (todayData as { record?: TodayAttendance } | undefined)?.record ?? null;
  const records = ((attData as { records?: AttendanceRecord[] } | undefined)?.records ?? []) as AttendanceRecord[];
  const stats   = ((attData as { stats?: { present: number; late: number; absent: number; totalHours: number; workingDays: number } } | undefined)?.stats) ?? { present: 0, late: 0, absent: 0, totalHours: 0, workingDays: 0 };
  const actionLoading = checkIn.isPending || checkOut.isPending;

  const locate = () => new Promise<{ latitude: number; longitude: number; accuracyMeters: number } | undefined>((resolve) => {
    if (!navigator.geolocation) { resolve(undefined); return; }
    navigator.geolocation.getCurrentPosition((position) => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude, accuracyMeters: position.coords.accuracy }), () => resolve(undefined), { enableHighAccuracy: true, timeout: 10_000, maximumAge: 30_000 });
  });
  const handleCheckIn = async () => checkIn.mutate(await locate(), { onError: (error: any) => toast.error(error.response?.data?.message ?? 'Check-in failed.') });
  const handleCheckOut = async () => checkOut.mutate(await locate(), { onError: (error: any) => toast.error(error.response?.data?.message ?? 'Check-out failed.') });

  const attendancePct = stats.workingDays > 0 ? Math.round((stats.present + stats.late) / stats.workingDays * 100) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a' }}>My Attendance</h1>
          <p style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>Track your daily check-in, check-out, and working hours</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <select value={month} onChange={(e) => setMonth(Number(e.target.value))} style={{ padding: '7px 12px', border: '1.5px solid #e2e8f0', borderRadius: '8px', fontSize: '12px', color: '#374151', backgroundColor: 'white', cursor: 'pointer', outline: 'none', fontFamily: 'Inter, sans-serif' }}>
            {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
          <select value={year} onChange={(e) => setYear(Number(e.target.value))} style={{ padding: '7px 12px', border: '1.5px solid #e2e8f0', borderRadius: '8px', fontSize: '12px', color: '#374151', backgroundColor: 'white', cursor: 'pointer', outline: 'none', fontFamily: 'Inter, sans-serif' }}>
            <option>2026</option><option>2025</option>
          </select>
        </div>
      </div>

      {/* Today check-in/out card */}
      <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
        <div>
          <p style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>Today — {now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          {todayLoading ? (
            <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>Loading...</p>
          ) : today ? (
            <div style={{ display: 'flex', gap: '16px', marginTop: '6px' }}>
              <span style={{ fontSize: '12px', color: '#64748b' }}>
                Check In: <strong style={{ color: '#0f172a' }}>{today.checkIn ?? '—'}</strong>
              </span>
              <span style={{ fontSize: '12px', color: '#64748b' }}>
                Check Out: <strong style={{ color: '#0f172a' }}>{today.checkOut ?? '—'}</strong>
              </span>
              <span style={{ padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: 600, backgroundColor: today.status === 'Present' ? '#f0fdf4' : today.status === 'Late' ? '#fff7ed' : '#fef2f2', color: today.status === 'Present' ? '#15803d' : today.status === 'Late' ? '#c2410c' : '#b91c1c' }}>{today.status}</span>
            </div>
          ) : (
            <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>No check-in recorded yet</p>
          )}
        </div>
        <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
          <button
            onClick={handleCheckIn}
            disabled={actionLoading || !!today?.checkIn}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 16px', backgroundColor: today?.checkIn ? '#f1f5f9' : '#0d7470', color: today?.checkIn ? '#94a3b8' : 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: today?.checkIn || actionLoading ? 'not-allowed' : 'pointer', fontFamily: 'Inter, sans-serif' }}
          >
            {actionLoading ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <LogIn size={14} />}
            Check In
          </button>
          <button
            onClick={handleCheckOut}
            disabled={actionLoading || !today?.checkIn || !!today?.checkOut}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 16px', backgroundColor: (!today?.checkIn || today?.checkOut) ? '#f1f5f9' : '#dc2626', color: (!today?.checkIn || today?.checkOut) ? '#94a3b8' : 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: (!today?.checkIn || today?.checkOut || actionLoading) ? 'not-allowed' : 'pointer', fontFamily: 'Inter, sans-serif' }}
          >
            <LogOut size={14} />
            Check Out
          </button>
        </div>
      </div>

      {/* Stats cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px' }}>
        {[
          { label: 'Working Days', value: stats.workingDays, color: '#374151',  bg: '#f8fafc' },
          { label: 'Present',      value: stats.present,     color: '#15803d', bg: '#f0fdf4' },
          { label: 'Late',         value: stats.late,        color: '#c2410c', bg: '#fff7ed' },
          { label: 'Absent',       value: stats.absent,      color: '#b91c1c', bg: '#fef2f2' },
          { label: 'Hours Logged', value: `${stats.totalHours}h`, color: '#1d4ed8', bg: '#eff6ff' },
        ].map(({ label, value, color, bg }) => (
          <div key={label} style={{ backgroundColor: bg, borderRadius: '10px', padding: '14px 16px', textAlign: 'center' }}>
            <p style={{ fontSize: '22px', fontWeight: 800, color }}>{value}</p>
            <p style={{ fontSize: '11px', color: '#64748b', marginTop: '3px' }}>{label}</p>
          </div>
        ))}
      </div>

      {/* Attendance rate bar */}
      <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '16px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#374151' }}>Attendance Rate — {MONTHS[month - 1]} {year}</span>
          <span style={{ fontSize: '15px', fontWeight: 800, color: attendancePct >= 90 ? '#16a34a' : attendancePct >= 75 ? '#ea580c' : '#dc2626' }}>{attendancePct}%</span>
        </div>
        <div style={{ height: '10px', backgroundColor: '#f1f5f9', borderRadius: '5px', overflow: 'hidden' }}>
          <div style={{ width: `${attendancePct}%`, height: '100%', backgroundColor: attendancePct >= 90 ? '#16a34a' : attendancePct >= 75 ? '#ea580c' : '#dc2626', borderRadius: '5px', transition: 'width 0.4s ease' }} />
        </div>
      </div>

      {/* Records table */}
      <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>Daily Records</h3>
          <div style={{ display: 'flex', gap: '4px' }}>
            {(['table', 'summary'] as const).map((v) => (
              <button key={v} onClick={() => setView(v)} style={{ padding: '5px 12px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: 600, fontFamily: 'Inter, sans-serif', backgroundColor: view === v ? '#0d7470' : '#f1f5f9', color: view === v ? 'white' : '#64748b' }}>{v === 'table' ? 'Table' : 'Summary'}</button>
            ))}
          </div>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}><Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} color="#0d7470" /></div>
        ) : view === 'table' ? (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc' }}>
                  {['Date', 'Day', 'Status', 'Check In', 'Check Out', 'Hours', 'OT'].map((h) => (
                    <th key={h} style={{ textAlign: 'left', padding: '10px 16px', fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.4px', borderBottom: '1px solid #f1f5f9', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {records.map((r, i) => {
                  const sm = STATUS_STYLE[r.status] ?? STATUS_STYLE['Upcoming']!;
                  return (
                    <tr key={i} style={{ borderBottom: i < records.length - 1 ? '1px solid #f8fafc' : 'none', opacity: r.status === 'Upcoming' ? 0.5 : 1 }}>
                      <td style={{ padding: '10px 16px', fontSize: '13px', fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap' }}>{r.date}</td>
                      <td style={{ padding: '10px 16px', fontSize: '12px', color: '#64748b' }}>{r.day}</td>
                      <td style={{ padding: '10px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: sm.dot, flexShrink: 0 }} />
                          <span style={{ padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: 600, backgroundColor: sm.bg, color: sm.color }}>{r.status}</span>
                        </div>
                      </td>
                      <td style={{ padding: '10px 16px', fontSize: '12px', color: '#374151' }}>{r.checkIn}</td>
                      <td style={{ padding: '10px 16px', fontSize: '12px', color: '#374151' }}>{r.checkOut}</td>
                      <td style={{ padding: '10px 16px', fontSize: '12px', fontWeight: 600, color: '#0f172a' }}>{r.hours}</td>
                      <td style={{ padding: '10px 16px', fontSize: '12px', color: r.ot !== '—' ? '#ea580c' : '#94a3b8', fontWeight: r.ot !== '—' ? 600 : 400 }}>{r.ot}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ padding: '20px', display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px' }}>
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <div key={d} style={{ textAlign: 'center', padding: '6px', fontSize: '10px', fontWeight: 700, color: '#94a3b8' }}>{d}</div>
            ))}
            {/* offset based on first record's day */}
            {records.length > 0 && Array.from({ length: ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(records[0]!.day) }).map((_, i) => (
              <div key={`blank-${i}`} />
            ))}
            {records.map((r, i) => {
              const sm = STATUS_STYLE[r.status] ?? STATUS_STYLE['Upcoming']!;
              return (
                <div key={i} title={`${r.date}: ${r.status}`} style={{ textAlign: 'center', padding: '8px 4px', borderRadius: '6px', backgroundColor: sm.bg, cursor: 'default' }}>
                  <p style={{ fontSize: '12px', fontWeight: 700, color: sm.color }}>{i + 1}</p>
                  <p style={{ fontSize: '9px', color: sm.color, marginTop: '2px' }}>{r.status === 'Weekend' ? 'WE' : r.status === 'Upcoming' ? '—' : r.status.slice(0, 2)}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
