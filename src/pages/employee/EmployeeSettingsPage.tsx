import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { useAuthStore } from '../../store/authStore';
import { employeeApi } from '../../api/employee';
import { accountApi } from '../../api/account';
import { extractError } from '../../utils/errorUtils';
import { useMyProfile } from '../../hooks/queries/useEmployeeQueries';

type Tab = 'Profile' | 'Bank Details' | 'Security';
const TABS: Tab[] = ['Profile', 'Bank Details', 'Security'];

const avatarColors = [
  { bg: '#eef2ff', color: '#6366f1' }, { bg: '#f0fdf4', color: '#10b981' },
  { bg: '#fffbeb', color: '#f59e0b' }, { bg: '#fdf4ff', color: '#ec4899' },
];
const getAv = (name?: string) => avatarColors[(name ?? 'E').charCodeAt(0) % avatarColors.length]!;
const initials = (name?: string) => (name ?? 'Employee').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();

interface Profile {
  employeeId: string; department: string | null; designation: string | null;
  shiftTiming: string | null; joiningDate: string | null; employmentType: string;
  accountHolder: string | null; bankName: string | null; branchName: string | null;
  // The employee profile endpoint populates the account relation as `userId`.
  // Keep `user` as an optional compatibility field for any legacy payloads.
  user?: { name: string; email: string } | null;
  userId?: { name: string; email: string } | null;
}

const fieldStyle: React.CSSProperties = { width: '100%', padding: '8px 12px', border: '1.5px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', outline: 'none', fontFamily: 'Inter, sans-serif', color: '#374151', backgroundColor: '#f8fafc', boxSizing: 'border-box' };
const readonlyStyle: React.CSSProperties = { ...fieldStyle, backgroundColor: '#f1f5f9', color: '#94a3b8' };
const labelStyle: React.CSSProperties = { fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '4px', display: 'block' };

export default function EmployeeSettingsPage() {
  const { user, setUser } = useAuthStore();
  const [tab,       setTab]       = useState<Tab>('Profile');
  const [editName,  setEditName]  = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [formInit,  setFormInit]  = useState(false);
  const [pwForm,    setPwForm]    = useState({ current: '', next: '', confirm: '' });

  const { data: profileRaw } = useMyProfile();
  const profile = profileRaw as Profile | null | undefined;
  const profileUser = profile?.user ?? profile?.userId ?? user ?? null;

  useEffect(() => {
    if (profileUser && !formInit) {
      setEditName(profileUser.name ?? '');
      setEditEmail(profileUser.email ?? '');
      setFormInit(true);
    }
  }, [profileUser, formInit]);

  const name = user?.name ?? 'Employee';
  const av   = getAv(name);

  const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a' }}>Settings</h1>
        <p style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>Manage your profile, bank details, and account security</p>
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '540px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: av.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: av.color, fontWeight: 800, fontSize: '20px', flexShrink: 0 }}>{initials(name)}</div>
                <div>
                  <p style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>{name}</p>
                  <p style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>{user?.email}</p>
                  <p style={{ fontSize: '11px', color: '#0d7470', fontWeight: 600, marginTop: '3px' }}>{profile?.designation ?? '—'} · {profile?.department ?? '—'}</p>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div><label style={labelStyle}>Full Name</label><input value={editName} onChange={(e) => setEditName(e.target.value)} style={fieldStyle} /></div>
                <div><label style={labelStyle}>Email Address</label><input value={editEmail} onChange={(e) => setEditEmail(e.target.value)} style={fieldStyle} /></div>
                <div><label style={labelStyle}>Employee ID</label><input value={profile?.employeeId ?? '—'} readOnly style={readonlyStyle} /></div>
                <div><label style={labelStyle}>Employment Type</label><input value={profile?.employmentType ?? '—'} readOnly style={readonlyStyle} /></div>
                <div><label style={labelStyle}>Department</label><input value={profile?.department ?? '—'} readOnly style={readonlyStyle} /></div>
                <div><label style={labelStyle}>Designation</label><input value={profile?.designation ?? '—'} readOnly style={readonlyStyle} /></div>
                <div><label style={labelStyle}>Shift Timing</label><input value={profile?.shiftTiming ?? '—'} readOnly style={readonlyStyle} /></div>
                <div><label style={labelStyle}>Joining Date</label><input value={fmtDate(profile?.joiningDate ?? null)} readOnly style={readonlyStyle} /></div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button onClick={async () => {
                  try {
                    await employeeApi.updateProfile({ name: editName, email: editEmail });
                    setUser({ name: editName, email: editEmail });
                    toast.success('Profile saved successfully');
                  } catch (err) {
                    toast.error(extractError(err, 'Failed to save profile'));
                  }
                }} style={{ padding: '9px 20px', backgroundColor: '#0d7470', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>Save Changes</button>
              </div>
            </div>
          )}

          {/* ─── Bank Details ─── */}
          {tab === 'Bank Details' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '540px' }}>
              <div style={{ padding: '14px 18px', backgroundColor: '#fffbeb', borderRadius: '8px', border: '1px solid #fde68a', fontSize: '12px', color: '#92400e' }}>
                Bank details are read-only. Contact HR to update your bank information.
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div style={{ gridColumn: '1 / -1' }}><label style={labelStyle}>Account Holder Name</label><input value={profile?.accountHolder ?? '—'} readOnly style={readonlyStyle} /></div>
                <div><label style={labelStyle}>Bank Name</label><input value={profile?.bankName ?? '—'} readOnly style={readonlyStyle} /></div>
                <div><label style={labelStyle}>Branch Name</label><input value={profile?.branchName ?? '—'} readOnly style={readonlyStyle} /></div>
                <div><label style={labelStyle}>Account Number</label><input value={profile?.accountHolder ? '••••••••' : '—'} readOnly style={readonlyStyle} /></div>
                <div><label style={labelStyle}>IFSC Code</label><input value="—" readOnly style={readonlyStyle} /></div>
              </div>
            </div>
          )}

          {/* ─── Security ─── */}
          {tab === 'Security' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '440px' }}>
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '20px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', marginBottom: '14px' }}>Change Password</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div><label style={labelStyle}>Current Password</label><input type="password" value={pwForm.current} onChange={(e) => setPwForm((p) => ({ ...p, current: e.target.value }))} placeholder="Enter current password" style={fieldStyle} /></div>
                  <div><label style={labelStyle}>New Password</label><input type="password" value={pwForm.next} onChange={(e) => setPwForm((p) => ({ ...p, next: e.target.value }))} placeholder="Min 8 characters" style={fieldStyle} /></div>
                  <div><label style={labelStyle}>Confirm New Password</label><input type="password" value={pwForm.confirm} onChange={(e) => setPwForm((p) => ({ ...p, confirm: e.target.value }))} placeholder="Re-enter new password" style={fieldStyle} /></div>
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
                <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', marginBottom: '4px' }}>Current Session</h3>
                <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '12px' }}>You are currently logged in as {user?.name}</p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0' }}>
                  <div>
                    <p style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>This browser session</p>
                    <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '1px' }}>{user?.email}</p>
                  </div>
                  <span style={{ padding: '3px 8px', borderRadius: '20px', fontSize: '10px', fontWeight: 600, backgroundColor: '#f0fdf4', color: '#16a34a' }}>Active</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
