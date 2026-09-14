import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, UserCheck, UserX, ClipboardList, X, ChevronDown, Send, Loader2 } from 'lucide-react';
import { useSupAttendanceSummary, useSupApprovals } from '../../hooks/queries/useSupQueries';

interface DashData {
  totalWorkforce: number;
  presentToday: number;
  absentToday: number;
  pendingApprovals: number;
  pendingLeaves: number;
  depts: { department: string; total: number; present: number; percentage: number }[];
}

const ISSUE_CATS = ['Attendance Issue', 'Workforce Shortage Issue', 'Logistics/Rotations Issue', 'Shift Assignment Issue', 'System Error Issue', 'Others'];
const PRIORITIES = ['Low', 'Medium', 'High', 'Critical'];

function HelpModal({ onClose }: { onClose: () => void }) {
  const [category,    setCategory]    = useState('');
  const [subject,     setSubject]     = useState('');
  const [description, setDescription] = useState('');
  const [priority,    setPriority]    = useState('');

  const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 10px', border: '1.5px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', outline: 'none', fontFamily: 'Inter, sans-serif', color: '#0f172a', backgroundColor: 'white' };

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '24px' }}>
      <div style={{ backgroundColor: 'white', borderRadius: '16px', width: '100%', maxWidth: '440px', boxShadow: '0 20px 60px rgba(0,0,0,0.15)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 22px', borderBottom: '1px solid #f1f5f9' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>Help & Support</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={18} /></button>
        </div>
        <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '5px', display: 'block' }}>Issue Category</label>
            <div style={{ position: 'relative' }}>
              <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ ...inputStyle, appearance: 'none', paddingRight: '28px' }}>
                <option value="">Select</option>
                {ISSUE_CATS.map((c) => <option key={c}>{c}</option>)}
              </select>
              <ChevronDown size={13} style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }} />
            </div>
          </div>
          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '5px', display: 'block' }}>Subject</label>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Unable to fulfill Packaging Morning Shift" style={inputStyle} />
          </div>
          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '5px', display: 'block' }}>Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe the issue in detail" rows={3} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }} />
          </div>
          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '5px', display: 'block' }}>Priority</label>
            <div style={{ position: 'relative' }}>
              <select value={priority} onChange={(e) => setPriority(e.target.value)} style={{ ...inputStyle, appearance: 'none', paddingRight: '28px' }}>
                <option value="">Select</option>
                {PRIORITIES.map((p) => <option key={p}>{p}</option>)}
              </select>
              <ChevronDown size={13} style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }} />
            </div>
          </div>
          <div style={{ border: '2px dashed #e2e8f0', borderRadius: '10px', padding: '16px', textAlign: 'center', backgroundColor: '#f8fafc' }}>
            <p style={{ fontSize: '12px', color: '#64748b' }}>Upload screenshot or document</p>
            <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>Max. JPG, PDF up to 5MB</p>
          </div>
        </div>
        <div style={{ padding: '12px 22px', borderTop: '1px solid #f1f5f9', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '8px 18px', border: '1.5px solid #e2e8f0', borderRadius: '8px', backgroundColor: 'white', color: '#374151', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>Cancel</button>
          <button onClick={onClose} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 20px', backgroundColor: '#0d7470', border: 'none', borderRadius: '8px', color: 'white', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
            <Send size={13} /> Submit
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SupervisorDashboardPage() {
  const navigate = useNavigate();
  const [showHelp, setShowHelp] = useState(false);

  const { data: attData, isLoading: attLoading } = useSupAttendanceSummary();
  const { data: appData, isLoading: appLoading } = useSupApprovals({ limit: '1' });

  const loading = attLoading || appLoading;

  const att = attData?.stats;
  const d: DashData | null = att ? {
    totalWorkforce:   att.totalWorkforce,
    presentToday:     att.presentToday,
    absentToday:      att.absent,
    pendingApprovals: appData?.stats?.pending ?? 0,
    pendingLeaves:    appData?.stats?.pending ?? 0,
    depts:            (attData?.departments ?? []).slice(0, 4),
  } : null;

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
        <Loader2 size={22} style={{ animation: 'spin 1s linear infinite' }} color="#0d7470" />
      </div>
    );
  }

  const STAT_CARDS = [
    { label: 'Total Workforce',   value: d?.totalWorkforce ?? 0,   icon: Users,         iconBg: '#f0f9ff', iconColor: '#0ea5e9' },
    { label: 'Present Today',     value: d?.presentToday ?? 0,     icon: UserCheck,     iconBg: '#f0fdf4', iconColor: '#16a34a' },
    { label: 'Absent Today',      value: d?.absentToday ?? 0,      icon: UserX,         iconBg: '#fef2f2', iconColor: '#dc2626' },
    { label: 'Pending Approvals', value: d?.pendingApprovals ?? 0, icon: ClipboardList, iconBg: '#eff6ff', iconColor: '#2563eb' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a' }}>Dashboard</h1>
          <p style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>Track team attendance and workforce status</p>
        </div>
        <button onClick={() => setShowHelp(true)} style={{ padding: '8px 16px', border: '1.5px solid #0d7470', borderRadius: '8px', backgroundColor: 'white', color: '#0d7470', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
          Help & Support
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
        {STAT_CARDS.map(({ label, value, icon: Icon, iconBg, iconColor }) => (
          <div key={label} style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '18px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
              <p style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>{label}</p>
              <div style={{ width: '34px', height: '34px', borderRadius: '9px', backgroundColor: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={16} color={iconColor} />
              </div>
            </div>
            <p style={{ fontSize: '28px', fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>{value}</p>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        {/* Attendance by Department */}
        <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '18px 20px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', marginBottom: '16px' }}>Attendance by Department</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {(d?.depts ?? []).length === 0 && (
              <p style={{ fontSize: '12px', color: '#94a3b8', textAlign: 'center', padding: '16px' }}>No attendance data</p>
            )}
            {(d?.depts ?? []).map((dept) => (
              <div key={dept.department}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>{dept.department}</span>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <span style={{ fontSize: '12px', color: '#16a34a', fontWeight: 600 }}>● {dept.present} Present</span>
                    <span style={{ fontSize: '12px', color: '#dc2626', fontWeight: 600 }}>● {dept.total - dept.present} Absent</span>
                  </div>
                </div>
                <div style={{ height: '6px', borderRadius: '3px', backgroundColor: '#f1f5f9', overflow: 'hidden' }}>
                  <div style={{ width: `${dept.percentage}%`, height: '100%', borderRadius: '3px', backgroundColor: '#0d7470', transition: 'width 0.4s' }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Pending Actions */}
        <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>Pending Actions</h3>
            <p style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>Items requiring your attention</p>
          </div>
          <div style={{ padding: '12px 0' }}>
            {[
              { label: 'Approve Leave Requests',  count: d?.pendingLeaves ?? 0 },
              { label: 'Review Approval Requests', count: d?.pendingApprovals ?? 0 },
            ].map((p, i) => (
              <div key={i} style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', borderBottom: i === 0 ? '1px solid #f8fafc' : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#f59e0b', flexShrink: 0 }} />
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>{p.label}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#ea580c', backgroundColor: '#fff7ed', padding: '2px 8px', borderRadius: '20px' }}>{p.count} pending</span>
                  <button onClick={() => navigate('/supervisor/approvals')} style={{ padding: '5px 14px', backgroundColor: '#0d7470', border: 'none', borderRadius: '7px', color: 'white', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>Review</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
    </div>
  );
}
