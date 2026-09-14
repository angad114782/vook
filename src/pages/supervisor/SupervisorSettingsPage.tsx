import { useState } from 'react';
import { toast } from 'sonner';
import { Save, Shield, Bell, User, Loader2 } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { accountApi } from '../../api/account';
import { extractError } from '../../utils/errorUtils';

type Tab = 'profile' | 'notifications' | 'security';

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div onClick={() => onChange(!on)} style={{ width: '44px', height: '24px', borderRadius: '12px', backgroundColor: on ? '#0d7470' : '#e2e8f0', position: 'relative', cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0 }}>
      <div style={{ position: 'absolute', top: '3px', left: on ? '23px' : '3px', width: '18px', height: '18px', borderRadius: '50%', backgroundColor: 'white', boxShadow: '0 1px 4px rgba(0,0,0,0.2)', transition: 'left 0.2s' }} />
    </div>
  );
}

const inputStyle: React.CSSProperties = { width: '100%', padding: '9px 12px', border: '1.5px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', outline: 'none', fontFamily: 'Inter, sans-serif', color: '#0f172a', backgroundColor: 'white' };
const labelStyle: React.CSSProperties = { fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '5px', display: 'block' };

export default function SupervisorSettingsPage() {
  const { user, setUser } = useAuthStore();
  const [tab, setTab] = useState<Tab>('profile');
  const [saving, setSaving] = useState(false);

  const [profile, setProfile] = useState({ name: user?.name ?? '', email: user?.email ?? '', phone: '', department: 'Assembly' });
  const [notifs, setNotifs] = useState({ attendanceAlerts: true, shiftAlerts: true, overtimeAlerts: false, approvalReminders: true });
  const [security, setSecurity] = useState({ twoFA: false, sessionTimeout: true });
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' });
  const [pwSaving, setPwSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await accountApi.updateProfile({ name: profile.name, email: profile.email });
      setUser({ name: profile.name, email: profile.email });
      toast.success('Settings saved successfully');
    } catch (err) {
      toast.error(extractError(err, 'Failed to save settings'));
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async () => {
    if (pwForm.next !== pwForm.confirm) { toast.error('Passwords do not match'); return; }
    if (pwForm.next.length < 8) { toast.error('New password must be at least 8 characters'); return; }
    setPwSaving(true);
    try {
      await accountApi.changePassword(pwForm.current, pwForm.next);
      toast.success('Password updated successfully');
      setPwForm({ current: '', next: '', confirm: '' });
    } catch (err) {
      toast.error(extractError(err, 'Failed to update password'));
    } finally {
      setPwSaving(false);
    }
  };

  const TABS: { key: Tab; label: string; icon: React.ComponentType<{ size?: number }> }[] = [
    { key: 'profile',       label: 'Profile',       icon: User   },
    { key: 'notifications', label: 'Notifications', icon: Bell   },
    { key: 'security',      label: 'Security',      icon: Shield },
  ];

  const SaveBtn = ({ label }: { label: string }) => (
    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
      <button onClick={() => void handleSave()} disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '9px 22px', backgroundColor: '#0d7470', border: 'none', borderRadius: '8px', color: 'white', fontSize: '13px', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'Inter, sans-serif', opacity: saving ? 0.8 : 1 }}>
        {saving ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={13} />}
        {label}
      </button>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a' }}>Settings</h1>
        <p style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>Manage your account and application preferences</p>
      </div>

      <div style={{ display: 'flex', backgroundColor: 'white', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '4px', gap: '2px', width: 'fit-content' }}>
        {TABS.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)} style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '8px 20px', border: 'none', borderRadius: '7px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, fontFamily: 'Inter, sans-serif', backgroundColor: tab === key ? '#0d7470' : 'transparent', color: tab === key ? 'white' : '#64748b', transition: 'all 0.15s' }}>
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {tab === 'profile' && (
        <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '22px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', marginBottom: '4px' }}>Personal Information</h3>
          <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '20px' }}>Update your personal details</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: '#0d7470', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 800, fontSize: '18px' }}>
              {(user?.name ?? 'S').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()}
            </div>
            <div>
              <button style={{ padding: '6px 14px', border: '1.5px solid #0d7470', borderRadius: '7px', backgroundColor: 'white', color: '#0d7470', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>Change Photo</button>
              <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>JPG, PNG up to 2MB</p>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div><label style={labelStyle}>First Name</label><input value={profile.name.split(' ')[0] ?? ''} onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value + ' ' + (p.name.split(' ').slice(1).join(' ') || '') }))} style={inputStyle} /></div>
            <div><label style={labelStyle}>Last Name</label><input value={profile.name.split(' ').slice(1).join(' ')} onChange={(e) => setProfile((p) => ({ ...p, name: (p.name.split(' ')[0] ?? '') + ' ' + e.target.value }))} style={inputStyle} /></div>
            <div><label style={labelStyle}>Email</label><input value={profile.email} type="email" onChange={(e) => setProfile((p) => ({ ...p, email: e.target.value }))} style={inputStyle} /></div>
            <div><label style={labelStyle}>Phone Number</label><input value={profile.phone} onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))} placeholder="+91 XXXXX XXXXX" style={inputStyle} /></div>
            <div><label style={labelStyle}>Role</label><input value="Supervisor" disabled style={{ ...inputStyle, backgroundColor: '#f8fafc', color: '#64748b' }} /></div>
            <div><label style={labelStyle}>Department</label><input value={profile.department} onChange={(e) => setProfile((p) => ({ ...p, department: e.target.value }))} style={inputStyle} /></div>
          </div>
          <SaveBtn label="Save Changes" />
        </div>
      )}

      {tab === 'notifications' && (
        <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '22px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', marginBottom: '4px' }}>Notification Preferences</h3>
          <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '20px' }}>Choose which alerts to receive</p>
          {[
            { key: 'attendanceAlerts' as const,  label: 'Attendance Alerts',    desc: 'Alerts for late arrivals and absences in your team' },
            { key: 'shiftAlerts' as const,       label: 'Shift Change Alerts',  desc: 'Notifications when shift assignments change' },
            { key: 'overtimeAlerts' as const,    label: 'Overtime Alerts',      desc: 'Alerts when employees exceed scheduled hours' },
            { key: 'approvalReminders' as const, label: 'Approval Reminders',   desc: 'Reminders for pending approval requests' },
          ].map((n) => (
            <div key={n.key} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', padding: '14px 0', borderBottom: '1px solid #f8fafc' }}>
              <div><p style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>{n.label}</p><p style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>{n.desc}</p></div>
              <Toggle on={notifs[n.key]} onChange={(v) => setNotifs((p) => ({ ...p, [n.key]: v }))} />
            </div>
          ))}
          <SaveBtn label="Save Preferences" />
        </div>
      )}

      {tab === 'security' && (
        <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '22px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', marginBottom: '4px' }}>Change Password</h3>
          <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '16px' }}>Keep your account secure</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
            <div><label style={labelStyle}>Old Password</label><input type="password" value={pwForm.current} onChange={(e) => setPwForm((p) => ({ ...p, current: e.target.value }))} placeholder="••••••••" style={inputStyle} /></div>
            <div><label style={labelStyle}>New Password</label><input type="password" value={pwForm.next} onChange={(e) => setPwForm((p) => ({ ...p, next: e.target.value }))} placeholder="••••••••" style={inputStyle} /></div>
            <div><label style={labelStyle}>Confirm New Password</label><input type="password" value={pwForm.confirm} onChange={(e) => setPwForm((p) => ({ ...p, confirm: e.target.value }))} placeholder="••••••••" style={inputStyle} /></div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginBottom: '24px' }}>
            <button onClick={() => setPwForm({ current: '', next: '', confirm: '' })} style={{ padding: '8px 18px', border: '1.5px solid #e2e8f0', borderRadius: '8px', backgroundColor: 'white', color: '#374151', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>Cancel</button>
            <button onClick={() => void handlePasswordChange()} disabled={pwSaving} style={{ padding: '8px 18px', backgroundColor: '#0d7470', border: 'none', borderRadius: '8px', color: 'white', fontSize: '13px', fontWeight: 600, cursor: pwSaving ? 'not-allowed' : 'pointer', fontFamily: 'Inter, sans-serif', display: 'flex', alignItems: 'center', gap: '6px', opacity: pwSaving ? 0.8 : 1 }}>
              {pwSaving && <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />}
              Update Password
            </button>
          </div>
          <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', marginBottom: '14px' }}>Two-Factor Authentication</h3>
          {[
            { key: 'twoFA' as const,          label: 'Enable 2FA',           desc: 'Add an extra layer of security to your account' },
            { key: 'sessionTimeout' as const, label: 'Auto Session Timeout', desc: 'Automatically log out after inactivity' },
          ].map((s) => (
            <div key={s.key} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', padding: '14px 0', borderBottom: '1px solid #f8fafc' }}>
              <div><p style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>{s.label}</p><p style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>{s.desc}</p></div>
              <Toggle on={security[s.key]} onChange={(v) => setSecurity((p) => ({ ...p, [s.key]: v }))} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
