import { useState } from 'react';
import { toast } from 'sonner';
import { useAuthStore } from '../../store/authStore';
import { accountApi } from '../../api/account';
import { extractError } from '../../utils/errorUtils';

type Tab = 'Profile' | 'Notifications' | 'Security';
const TABS: Tab[] = ['Profile', 'Notifications', 'Security'];

const avatarColors = [
  { bg: '#eef2ff', color: '#6366f1' }, { bg: '#f0fdf4', color: '#10b981' },
  { bg: '#fffbeb', color: '#f59e0b' }, { bg: '#fdf4ff', color: '#ec4899' },
];
const getAv = (name?: string) => avatarColors[(name ?? 'F').charCodeAt(0) % avatarColors.length]!;
const initials = (name?: string) => (name ?? 'User').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();

const NOTIF_GROUPS = [
  {
    group: 'Payroll',
    items: [
      { label: 'Payroll Processing',     desc: 'Alerts when payroll runs are initiated or completed', key: 'payrollProcessing' },
      { label: 'Payroll Errors',          desc: 'Notifications for failed or errored payroll entries',  key: 'payrollErrors' },
      { label: 'Salary Revision Alerts',  desc: 'When an employee salary structure is revised',         key: 'salaryRevision' },
    ],
  },
  {
    group: 'Expenses',
    items: [
      { label: 'Expense Approvals',  desc: 'When expense claims require your review or action',    key: 'expenseApprovals' },
      { label: 'Expense Submitted',  desc: 'Notify when employees submit new expense claims',      key: 'expenseSubmitted' },
    ],
  },
  {
    group: 'Compliance & Reports',
    items: [
      { label: 'Tax Deadlines',         desc: 'Reminders for upcoming TDS, GST, or compliance dates', key: 'taxDeadlines' },
      { label: 'Daily Digest',          desc: 'End-of-day summary of financial activity',             key: 'dailyDigest' },
      { label: 'Weekly Reports',        desc: 'Automated weekly finance summary every Monday',        key: 'weeklyReports' },
    ],
  },
];

const fieldStyle: React.CSSProperties = { width: '100%', padding: '8px 12px', border: '1.5px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', outline: 'none', fontFamily: 'Inter, sans-serif', color: '#374151', backgroundColor: '#f8fafc', boxSizing: 'border-box' };
const labelStyle: React.CSSProperties = { fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '4px', display: 'block' };

export default function FinanceSettingsPage() {
  const { user, setUser } = useAuthStore();
  const [tab, setTab] = useState<Tab>('Profile');
  const [notifs, setNotifs] = useState<Record<string, boolean>>({
    payrollProcessing: true, payrollErrors: true, salaryRevision: false,
    expenseApprovals: true, expenseSubmitted: false,
    taxDeadlines: true, dailyDigest: true, weeklyReports: false,
  });
  const [show2FA] = useState(false);
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' });
  const [editName,  setEditName]  = useState(user?.name ?? '');
  const [editEmail, setEditEmail] = useState(user?.email ?? '');
  const name = user?.name ?? 'Finance Admin';
  const av = getAv(name);

  const toggle = (k: string) => setNotifs((p) => ({ ...p, [k]: !p[k] }));

  const Toggle = ({ k }: { k: string }) => (
    <button onClick={() => toggle(k)} style={{ width: '40px', height: '22px', borderRadius: '11px', border: 'none', cursor: 'pointer', backgroundColor: notifs[k] ? '#0d7470' : '#e2e8f0', position: 'relative', flexShrink: 0, transition: 'background-color 0.2s' }}>
      <div style={{ position: 'absolute', top: '3px', left: notifs[k] ? '20px' : '3px', width: '16px', height: '16px', borderRadius: '50%', backgroundColor: 'white', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
    </button>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a' }}>Settings</h1>
        <p style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>Manage your profile, notifications, and account security</p>
      </div>

      <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        <div style={{ padding: '4px', display: 'flex', gap: '2px', borderBottom: '1px solid #f1f5f9', backgroundColor: '#f8fafc' }}>
          {TABS.map((t) => (
            <button key={t} onClick={() => setTab(t)} style={{ padding: '8px 18px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 600, fontFamily: 'Inter, sans-serif', backgroundColor: tab === t ? '#0d7470' : 'transparent', color: tab === t ? 'white' : '#64748b', transition: 'all 0.15s' }}>{t}</button>
          ))}
        </div>

        <div style={{ padding: '24px' }}>
          {/* ─── Profile ─── */}
          {tab === 'Profile' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '520px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: av.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: av.color, fontWeight: 800, fontSize: '20px', flexShrink: 0 }}>{initials(name)}</div>
                <div>
                  <p style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>{name}</p>
                  <p style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>{user?.email}</p>
                  <button style={{ marginTop: '6px', fontSize: '11px', color: '#0d7470', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Change Photo</button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div><label style={labelStyle}>Full Name</label><input value={editName} onChange={(e) => setEditName(e.target.value)} style={fieldStyle} /></div>
                <div><label style={labelStyle}>Email Address</label><input value={editEmail} onChange={(e) => setEditEmail(e.target.value)} style={fieldStyle} /></div>
                <div><label style={labelStyle}>Role</label><input value="Finance Admin" readOnly style={{ ...fieldStyle, backgroundColor: '#f1f5f9', color: '#94a3b8' }} /></div>
                <div><label style={labelStyle}>Employee ID</label><input value="—" readOnly style={{ ...fieldStyle, backgroundColor: '#f1f5f9', color: '#94a3b8' }} /></div>
                <div><label style={labelStyle}>Department</label><input value="—" readOnly style={{ ...fieldStyle, backgroundColor: '#f1f5f9', color: '#94a3b8' }} /></div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button onClick={async () => {
                  try {
                    await accountApi.updateProfile({ name: editName, email: editEmail });
                    setUser({ name: editName, email: editEmail });
                    toast.success('Profile saved successfully');
                  } catch (err) {
                    toast.error(extractError(err, 'Failed to save profile'));
                  }
                }} style={{ padding: '9px 20px', backgroundColor: '#0d7470', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>Save Changes</button>
              </div>
            </div>
          )}

          {/* ─── Notifications ─── */}
          {tab === 'Notifications' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '560px' }}>
              {NOTIF_GROUPS.map(({ group, items }) => (
                <div key={group}>
                  <p style={{ fontSize: '12px', fontWeight: 800, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>{group}</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', borderRadius: '10px', overflow: 'hidden', border: '1px solid #f1f5f9' }}>
                    {items.map(({ label, desc, key }) => (
                      <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', backgroundColor: 'white', gap: '12px' }}>
                        <div>
                          <p style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>{label}</p>
                          <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>{desc}</p>
                        </div>
                        <Toggle k={key} />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ─── Security ─── */}
          {tab === 'Security' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '480px' }}>
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '20px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', marginBottom: '14px' }}>Change Password</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div>
                    <label style={labelStyle}>Current Password</label>
                    <input type="password" value={pwForm.current} onChange={(e) => setPwForm((p) => ({ ...p, current: e.target.value }))} placeholder="Enter current password" style={fieldStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>New Password</label>
                    <input type="password" value={pwForm.next} onChange={(e) => setPwForm((p) => ({ ...p, next: e.target.value }))} placeholder="Min 8 characters" style={fieldStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Confirm New Password</label>
                    <input type="password" value={pwForm.confirm} onChange={(e) => setPwForm((p) => ({ ...p, confirm: e.target.value }))} placeholder="Re-enter new password" style={fieldStyle} />
                  </div>
                  <button onClick={async () => {
                    if (pwForm.next !== pwForm.confirm) { toast.error('Passwords do not match'); return; }
                    if (pwForm.next.length < 8) { toast.error('New password must be at least 8 characters'); return; }
                    try {
                      await accountApi.changePassword(pwForm.current, pwForm.next);
                      toast.success('Password updated successfully');
                      setPwForm({ current: '', next: '', confirm: '' });
                    } catch (err) {
                      toast.error(extractError(err, 'Failed to update password'));
                    }
                  }} style={{ alignSelf: 'flex-end', padding: '9px 20px', backgroundColor: '#0d7470', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>Update Password</button>
                </div>
              </div>

              <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>Two-Factor Authentication</h3>
                    <p style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>Add an extra layer of security to your account</p>
                  </div>
                  <Toggle k="__2fa__" />
                </div>
                {show2FA && (
                  <div style={{ marginTop: '14px', padding: '12px', backgroundColor: '#f0fdf4', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
                    <p style={{ fontSize: '12px', color: '#16a34a', fontWeight: 600 }}>2FA is enabled. Use your authenticator app to generate codes.</p>
                  </div>
                )}
              </div>

              <div style={{ border: '1px solid #fef2f2', borderRadius: '10px', padding: '20px', backgroundColor: '#fef2f2' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#dc2626', marginBottom: '6px' }}>Danger Zone</h3>
                <p style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '12px' }}>These actions are irreversible. Proceed with caution.</p>
                <button style={{ padding: '8px 16px', backgroundColor: 'white', color: '#dc2626', border: '1.5px solid #dc2626', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>Deactivate Account</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
