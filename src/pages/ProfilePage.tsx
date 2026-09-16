import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  BadgeCheck,
  Camera,
  Check,
  ChevronRight,
  Clock3,
  KeyRound,
  Laptop,
  Loader2,
  Mail,
  MonitorSmartphone,
  Palette,
  RotateCcw,
  ShieldCheck,
  ShieldOff,
  Smartphone,
  Trash2,
  UserRound,
  UsersRound,
} from 'lucide-react';
import { accountApi } from '../api/account';
import { useAccess } from '../hooks/queries/useAccess';
import { useAuthStore } from '../store/authStore';
import './profilePage.css';

type RoleKey = 'SUPER_ADMIN' | 'COMPANY_ADMIN' | 'HR' | 'FINANCE' | 'MANAGER' | 'SUPERVISOR' | 'EMPLOYEE';
type PreferenceKey = 'security' | 'approvals' | 'attendance' | 'payroll' | 'digest' | 'shifts' | 'platform';

interface RoleMeta {
  label: string;
  eyebrow: string;
  summary: string;
  workspace: string;
  capabilities: string[];
  preferences: Array<{ key: PreferenceKey; label: string; description: string }>;
}

const roleMeta: Record<RoleKey, RoleMeta> = {
  SUPER_ADMIN: {
    label: 'Super Admin', eyebrow: 'Platform control plane', workspace: 'All companies',
    summary: 'You manage the VOOK platform, tenant health, and global security controls.',
    capabilities: ['All companies', 'Plans & billing', 'Audit & security'],
    preferences: [
      { key: 'platform', label: 'Platform incidents', description: 'Critical service and tenant health alerts' },
      { key: 'security', label: 'Security events', description: 'Sign-in, access, and audit activity' },
      { key: 'digest', label: 'Operations digest', description: 'A concise daily platform summary' },
    ],
  },
  COMPANY_ADMIN: {
    label: 'Company Admin', eyebrow: 'Company workspace', workspace: 'Your organization',
    summary: 'You oversee people, access, workflows, and the operating setup for your company.',
    capabilities: ['People & organization', 'Roles & scopes', 'Plan & modules'],
    preferences: [
      { key: 'approvals', label: 'Approval reminders', description: 'Requests waiting for your decision' },
      { key: 'payroll', label: 'Payroll updates', description: 'Payroll runs, exceptions, and publishing' },
      { key: 'digest', label: 'Company digest', description: 'A daily summary of important activity' },
    ],
  },
  HR: {
    label: 'Human Resources', eyebrow: 'People operations', workspace: 'Your organization',
    summary: 'You keep employee records, attendance, leave, payroll, and policies moving.',
    capabilities: ['Employee records', 'Leave & attendance', 'Policies & payroll'],
    preferences: [
      { key: 'approvals', label: 'Approval reminders', description: 'Leave and workflow decisions' },
      { key: 'attendance', label: 'Attendance alerts', description: 'Late arrivals, absences, and exceptions' },
      { key: 'payroll', label: 'Payroll updates', description: 'Processing and salary revision alerts' },
    ],
  },
  FINANCE: {
    label: 'Finance', eyebrow: 'Finance workspace', workspace: 'Your organization',
    summary: 'You manage payroll operations, expenses, payslips, and financial reporting.',
    capabilities: ['Payroll operations', 'Expenses & payouts', 'Reports & analytics'],
    preferences: [
      { key: 'payroll', label: 'Payroll updates', description: 'Runs, calculations, and payslips' },
      { key: 'approvals', label: 'Expense approvals', description: 'Reimbursements waiting for review' },
      { key: 'digest', label: 'Finance digest', description: 'A daily summary of finance activity' },
    ],
  },
  MANAGER: {
    label: 'Manager', eyebrow: 'Team workspace', workspace: 'Your team',
    summary: 'You lead your team through workforce planning, attendance, approvals, and reporting.',
    capabilities: ['Team workforce', 'Approvals', 'Team reports'],
    preferences: [
      { key: 'approvals', label: 'Approval reminders', description: 'Requests waiting for your decision' },
      { key: 'attendance', label: 'Team attendance', description: 'Late arrivals and absence alerts' },
      { key: 'digest', label: 'Weekly summary', description: 'A concise view of team activity' },
    ],
  },
  SUPERVISOR: {
    label: 'Supervisor', eyebrow: 'Team operations', workspace: 'Your team',
    summary: 'You coordinate daily operations, shifts, attendance, and team-level approvals.',
    capabilities: ['Workforce operations', 'Shift management', 'Team approvals'],
    preferences: [
      { key: 'shifts', label: 'Shift changes', description: 'Assignment and roster updates' },
      { key: 'attendance', label: 'Attendance alerts', description: 'Late arrivals and absence alerts' },
      { key: 'approvals', label: 'Approval reminders', description: 'Requests waiting for your decision' },
    ],
  },
  EMPLOYEE: {
    label: 'Employee', eyebrow: 'My workspace', workspace: 'Your organization',
    summary: 'Keep your personal details current and stay in control of your account security.',
    capabilities: ['Attendance & leave', 'Payslips & expenses', 'Personal records'],
    preferences: [
      { key: 'attendance', label: 'Attendance updates', description: 'Check-in, exceptions, and regularization updates' },
      { key: 'payroll', label: 'Payslip alerts', description: 'Know when a new payslip is ready' },
      { key: 'digest', label: 'Monthly summary', description: 'A concise view of your work records' },
    ],
  },
};

interface EmployeeSnapshot {
  employeeId?: string;
  department?: string | null;
  designation?: string | null;
  employmentType?: string | null;
  shiftTiming?: string | null;
  joiningDate?: string | null;
  status?: string | null;
}

interface ProfileResponse {
  name?: string;
  email?: string;
  avatar?: string | null;
  employee?: EmployeeSnapshot | null;
}

interface Session {
  _id?: string;
  id?: string;
  device?: string;
  ip?: string;
  ipAddress?: string;
  lastSeenAt?: string;
  createdAt?: string;
  userAgent?: string;
  current?: boolean;
}

interface TwoFactorStatus {
  enabled?: boolean;
  required?: boolean;
  enrollmentRequired?: boolean;
}

interface TwoFactorSetup {
  secret?: string;
  otpauthUrl?: string;
  otpauthUri?: string;
  qrCodeDataUrl?: string;
}

const defaultPreferenceState = (options: RoleMeta['preferences']) => Object.fromEntries(options.map(({ key }) => [key, true])) as Record<PreferenceKey, boolean>;

const formatRole = (role?: string) => role?.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase()) ?? 'User';
const formatDate = (value?: string | null) => value ? new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Not provided';
const sessionId = (session: Session, index: number) => session._id ?? session.id ?? `session-${index}`;

export default function ProfilePage() {
  const navigate = useNavigate();
  const { user, setUser, logout } = useAuthStore();
  const access = useAccess();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const role = (user?.role ?? 'EMPLOYEE') as RoleKey;
  const meta = roleMeta[role] ?? roleMeta.EMPLOYEE;
  const preferenceStorageKey = `vook-profile-preferences-${user?.id ?? 'user'}`;

  const [profile, setProfile] = useState({ name: user?.name ?? '', email: user?.email ?? '' });
  const [avatarDraft, setAvatarDraft] = useState<string | null>(user?.avatar ?? null);
  const [profileLoading, setProfileLoading] = useState(role === 'EMPLOYEE');
  const [profileSaving, setProfileSaving] = useState(false);
  const [employee, setEmployee] = useState<EmployeeSnapshot | null>(null);
  const [passwords, setPasswords] = useState({ current: '', next: '', confirm: '' });
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [twoFactor, setTwoFactor] = useState<TwoFactorStatus>({ enabled: Boolean(user?.twoFactorEnabled) });
  const [twoFactorSetup, setTwoFactorSetup] = useState<TwoFactorSetup | null>(null);
  const [twoFactorOtp, setTwoFactorOtp] = useState('');
  const [securityBusy, setSecurityBusy] = useState(false);
  const [preferences, setPreferences] = useState<Record<PreferenceKey, boolean>>(() => {
    const defaults = defaultPreferenceState(meta.preferences);
    try {
      const saved = JSON.parse(localStorage.getItem(preferenceStorageKey) ?? '{}') as Record<PreferenceKey, boolean>;
      return { ...defaults, ...saved };
    } catch {
      return defaults;
    }
  });

  useEffect(() => {
    let active = true;
    if (role !== 'EMPLOYEE') {
      setProfileLoading(false);
      return () => { active = false; };
    }

    void accountApi.getProfile<ProfileResponse>()
      .then(({ data }) => {
        if (!active) return;
        setEmployee(data.employee ?? null);
        setProfile((current) => ({ name: data.name ?? current.name, email: data.email ?? current.email }));
        if (data.avatar !== undefined) setAvatarDraft(data.avatar ?? null);
      })
      .catch(() => undefined)
      .finally(() => { if (active) setProfileLoading(false); });

    return () => { active = false; };
  }, [role]);

  useEffect(() => {
    let active = true;
    void accountApi.getSessions<Session>()
      .then(({ data }) => { if (active) setSessions(data.sessions ?? []); })
      .catch(() => { if (active) setSessions([]); })
      .finally(() => { if (active) setSessionsLoading(false); });
    void accountApi.getTwoFactorStatus<TwoFactorStatus>()
      .then(({ data }) => { if (active) setTwoFactor((current) => ({ ...current, ...data })); })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  const enabledModules = useMemo(() => (access.data?.modules ?? []).filter((module) => module.isEnabled).map((module) => module.name).slice(0, 8), [access.data?.modules]);
  const assignedRoles = useMemo(() => (access.data?.roles ?? []).map((item) => formatRole(item.role)).filter(Boolean), [access.data?.roles]);

  const handleAvatarChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Choose a JPG, PNG, WEBP, or GIF image.'); return; }
    if (file.size > 2 * 1024 * 1024) { toast.error('Profile photos must be 2MB or smaller.'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') setAvatarDraft(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleProfileSave = async (event: FormEvent) => {
    event.preventDefault();
    if (!profile.name.trim()) { toast.error('Enter your name.'); return; }
    setProfileSaving(true);
    try {
      await accountApi.updateProfile({
        name: profile.name.trim(),
        email: profile.email.trim(),
        ...(avatarDraft !== (user?.avatar ?? null) ? { avatar: avatarDraft } : {}),
      });
      setUser({ name: profile.name.trim(), email: profile.email.trim(), avatar: avatarDraft });
      toast.success('Profile updated successfully.');
    } catch (error: any) {
      toast.error(error.response?.data?.message ?? 'Unable to update your profile.');
    } finally {
      setProfileSaving(false);
    }
  };

  const handlePasswordSave = async (event: FormEvent) => {
    event.preventDefault();
    if (passwords.next.length < 8) { toast.error('New password must be at least 8 characters.'); return; }
    if (passwords.next !== passwords.confirm) { toast.error('New passwords do not match.'); return; }
    setPasswordSaving(true);
    try {
      await accountApi.changePassword(passwords.current, passwords.next);
      setPasswords({ current: '', next: '', confirm: '' });
      toast.success('Password updated successfully.');
    } catch (error: any) {
      toast.error(error.response?.data?.message ?? 'Unable to update your password.');
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleTwoFactorSetup = async () => {
    setSecurityBusy(true);
    try {
      const { data } = await accountApi.setupTwoFactor<TwoFactorSetup>();
      setTwoFactorSetup(data);
    } catch (error: any) {
      toast.error(error.response?.data?.message ?? 'Unable to start two-factor setup.');
    } finally {
      setSecurityBusy(false);
    }
  };

  const handleTwoFactorVerify = async () => {
    if (twoFactorOtp.length !== 6) { toast.error('Enter the 6-digit authenticator code.'); return; }
    setSecurityBusy(true);
    try {
      await accountApi.verifyTwoFactor(twoFactorOtp);
      setTwoFactor({ ...twoFactor, enabled: true });
      setUser({ twoFactorEnabled: true });
      setTwoFactorSetup(null);
      setTwoFactorOtp('');
      toast.success('Two-factor authentication is enabled.');
    } catch (error: any) {
      toast.error(error.response?.data?.message ?? 'Verification failed.');
    } finally {
      setSecurityBusy(false);
    }
  };

  const handleTwoFactorDisable = async () => {
    if (twoFactor.required) {
      toast.error('Two-factor authentication is required for this account.');
      return;
    }
    if (!window.confirm('Turn off two-factor authentication for this account?')) return;
    setSecurityBusy(true);
    try {
      await accountApi.disableTwoFactor();
      setTwoFactor((current) => ({ ...current, enabled: false }));
      setUser({ twoFactorEnabled: false });
      setTwoFactorSetup(null);
      setTwoFactorOtp('');
      toast.success('Two-factor authentication is off.');
    } catch (error: any) {
      toast.error(error.response?.data?.message ?? 'Unable to turn off two-factor authentication.');
    } finally {
      setSecurityBusy(false);
    }
  };

  const handleRevokeAll = async () => {
    if (!window.confirm('Sign out every active session, including this one?')) return;
    setSecurityBusy(true);
    try {
      await accountApi.revokeAllSessions();
      await logout();
      navigate('/login', { replace: true });
    } catch (error: any) {
      toast.error(error.response?.data?.message ?? 'Unable to revoke sessions.');
    } finally {
      setSecurityBusy(false);
    }
  };

  const savePreferences = () => {
    localStorage.setItem(preferenceStorageKey, JSON.stringify(preferences));
    toast.success('Notification preferences saved.');
  };

  if (!user) return null;

  return (
    <div className="profile-page">
      <header className="profile-page__header">
        <div>
          <p className="profile-page__eyebrow">ACCOUNT / {meta.label.toUpperCase()}</p>
          <h1>Profile</h1>
          <p>Keep your identity, access context, and account security in one place.</p>
        </div>
        <div className="profile-page__header-status"><span className="profile-status-dot" /> Account active <ChevronRight size={14} /></div>
      </header>

      <div className="profile-layout">
        <aside className="profile-identity" aria-labelledby="profile-identity-title">
        <p className="profile-hero__kicker">{meta.eyebrow}</p>
        <button type="button" className="profile-avatar-upload" onClick={() => fileInputRef.current?.click()} aria-label="Choose profile photo">
          {avatarDraft
            ? <img src={avatarDraft} alt={`${profile.name || 'User'} profile preview`} />
            : <span className="profile-avatar-placeholder"><UserRound size={36} aria-hidden="true" /></span>}
          <span className="profile-avatar-upload__action" aria-hidden="true"><Camera size={13} /></span>
        </button>
        <input ref={fileInputRef} className="profile-visually-hidden" type="file" accept="image/*" onChange={handleAvatarChange} />
        <div className="profile-identity__copy">
          <h2 id="profile-identity-title">{profile.name || 'Your profile'}</h2>
          <p><Mail size={14} /> <span>{profile.email}</span></p>
        </div>
        <div className="profile-identity__photo-meta">
          <span>JPG, PNG, WEBP or GIF · max 2MB</span>
          {avatarDraft && <button type="button" className="profile-text-button profile-text-button--danger" onClick={() => setAvatarDraft(null)}><Trash2 size={14} /> Remove photo</button>}
        </div>
        <div className="profile-identity__facts">
          <div><span>Role</span><strong>{meta.label}</strong></div>
          <div><span>Workspace</span><strong>{meta.workspace}</strong></div>
          <div><span>Company</span><strong>{user.company?.name ?? 'VOOK platform'}</strong></div>
        </div>
        </aside>

        <div className="profile-content">
          <main className="profile-main">
          <section className="profile-card profile-card--personal">
            <div className="profile-card__header"><div><p className="profile-card__eyebrow">IDENTITY</p><h2>Personal information</h2><p>Use an email address you can access for account notices and verification.</p></div><UserRound size={19} /></div>
            <form className="profile-form" onSubmit={(event) => void handleProfileSave(event)}>
              <div className="profile-form__grid">
                <label className="profile-field"><span>Full name</span><input value={profile.name} onChange={(event) => setProfile({ ...profile, name: event.target.value })} autoComplete="name" required /></label>
                <label className="profile-field"><span>Email address</span><input value={profile.email} onChange={(event) => setProfile({ ...profile, email: event.target.value })} type="email" autoComplete="email" required /><small>Email changes may require verification.</small></label>
                <label className="profile-field"><span>Role</span><input value={formatRole(user.role)} readOnly className="is-readonly" /></label>
                <label className="profile-field"><span>Company</span><input value={user.company?.name ?? 'VOOK platform'} readOnly className="is-readonly" /></label>
              </div>
              <div className="profile-form__footer"><span>Last saved changes apply across every VOOK workspace.</span><button type="submit" className="profile-button profile-button--primary" disabled={profileSaving}>{profileSaving ? <Loader2 size={15} className="profile-spin" /> : <Check size={15} />} Save profile</button></div>
            </form>
          </section>

          {role === 'EMPLOYEE' && (
            <section className="profile-card profile-card--employment">
              <div className="profile-card__header"><div><p className="profile-card__eyebrow">EMPLOYMENT RECORD</p><h2>Your work details</h2><p>These details come from People Operations and are read-only here.</p></div><UsersRound size={19} /></div>
              {profileLoading ? <div className="profile-loading"><Loader2 size={18} className="profile-spin" /> Loading employment record…</div> : <div className="profile-detail-grid">
                <div><span>Employee ID</span><strong>{employee?.employeeId ?? 'Not provided'}</strong></div>
                <div><span>Department</span><strong>{employee?.department ?? 'Not provided'}</strong></div>
                <div><span>Designation</span><strong>{employee?.designation ?? 'Not provided'}</strong></div>
                <div><span>Employment type</span><strong>{employee?.employmentType ?? 'Not provided'}</strong></div>
                <div><span>Shift timing</span><strong>{employee?.shiftTiming ?? 'Not provided'}</strong></div>
                <div><span>Joining date</span><strong>{formatDate(employee?.joiningDate)}</strong></div>
              </div>}
              <div className="profile-note"><BadgeCheck size={15} /> Need to change employment details? Contact your HR team.</div>
            </section>
          )}

          <section className="profile-card profile-card--password">
            <div className="profile-card__header"><div><p className="profile-card__eyebrow">CREDENTIALS</p><h2>Change password</h2><p>Confirm your current password before choosing a new one.</p></div><KeyRound size={19} /></div>
            <form className="profile-form" onSubmit={(event) => void handlePasswordSave(event)}>
              <div className="profile-form__grid profile-form__grid--password">
                <label className="profile-field"><span>Current password</span><input value={passwords.current} onChange={(event) => setPasswords({ ...passwords, current: event.target.value })} type="password" autoComplete="current-password" required /></label>
                <label className="profile-field"><span>New password</span><input value={passwords.next} onChange={(event) => setPasswords({ ...passwords, next: event.target.value })} type="password" minLength={8} autoComplete="new-password" required /><small>At least 8 characters.</small></label>
                <label className="profile-field"><span>Confirm new password</span><input value={passwords.confirm} onChange={(event) => setPasswords({ ...passwords, confirm: event.target.value })} type="password" minLength={8} autoComplete="new-password" required /></label>
              </div>
              <div className="profile-form__footer"><span>Your current session stays active after the update.</span><button type="submit" className="profile-button profile-button--primary" disabled={passwordSaving}>{passwordSaving ? <Loader2 size={15} className="profile-spin" /> : <KeyRound size={15} />} Update password</button></div>
            </form>
          </section>

          <section className="profile-card profile-card--security">
            <div className="profile-card__header"><div><p className="profile-card__eyebrow">EXTRA PROTECTION</p><h2>Two-factor authentication</h2><p>Use an authenticator app for a stronger sign-in.</p></div><ShieldCheck size={19} /></div>
            <div className={`profile-security-status${twoFactor.enabled ? ' is-enabled' : ''}`}><span className="profile-security-status__icon">{twoFactor.enabled ? <Check size={16} /> : <ShieldCheck size={16} />}</span><div><strong>{twoFactor.enabled ? 'Two-factor authentication is on' : 'Two-factor authentication is off'}</strong><small>{twoFactor.enabled ? (twoFactor.required ? 'Required for this account and used at every sign-in.' : 'Your account asks for a verification code at sign-in.') : 'Recommended for every account, especially roles with access to payroll or employee data.'}</small></div>{twoFactor.enabled ? <button type="button" className="profile-button profile-button--danger" onClick={() => void handleTwoFactorDisable()} disabled={securityBusy || twoFactor.required} title={twoFactor.required ? 'Required for this account' : 'Turn off two-factor authentication'}>{securityBusy ? <Loader2 size={15} className="profile-spin" /> : <ShieldOff size={15} />} Turn off</button> : !twoFactorSetup && <button type="button" className="profile-button profile-button--secondary" onClick={() => void handleTwoFactorSetup()} disabled={securityBusy}>{securityBusy ? <Loader2 size={15} className="profile-spin" /> : <ShieldCheck size={15} />} Set up 2FA</button>}</div>
            {twoFactorSetup && !twoFactor.enabled && <div className="profile-2fa-setup"><div><span className="profile-card__eyebrow">STEP 1</span><h3>Add VOOK to your authenticator</h3><p>Open the setup link or enter the manual key in Google Authenticator, Microsoft Authenticator, 1Password, or a similar app.</p>{(twoFactorSetup.otpauthUri ?? twoFactorSetup.otpauthUrl) && <a className="profile-text-button" href={twoFactorSetup.otpauthUri ?? twoFactorSetup.otpauthUrl}>Open authenticator app <ChevronRight size={14} /></a>}{twoFactorSetup.secret && <div className="profile-secret"><span>Manual setup key</span><code>{twoFactorSetup.secret}</code></div>}</div><div className="profile-2fa-verify"><label className="profile-field"><span>Step 2 · Verification code</span><input value={twoFactorOtp} onChange={(event) => setTwoFactorOtp(event.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" placeholder="000000" maxLength={6} /></label><button type="button" className="profile-button profile-button--primary" onClick={() => void handleTwoFactorVerify()} disabled={securityBusy || twoFactorOtp.length !== 6}>{securityBusy ? <Loader2 size={15} className="profile-spin" /> : <Check size={15} />} Verify and enable</button></div></div>}
          </section>
        </main>

        <aside className="profile-side">
          <section className="profile-card profile-scope-card profile-card--scope">
            <div className="profile-card__header"><div><p className="profile-card__eyebrow">ROLE CONTEXT</p><h2>What you can manage</h2><p>{meta.summary}</p></div><MonitorSmartphone size={19} /></div>
            <div className="profile-capability-list">{meta.capabilities.map((capability) => <div key={capability}><Check size={14} /> {capability}</div>)}</div>
            {assignedRoles.length > 0 && <div className="profile-role-assignment"><span>Assigned role{assignedRoles.length > 1 ? 's' : ''}</span><strong>{assignedRoles.join(' · ')}</strong></div>}
            <div className="profile-module-block"><div className="profile-module-block__heading"><span>Enabled modules</span>{access.isLoading && <Loader2 size={13} className="profile-spin" />}</div><div className="profile-chip-list">{enabledModules.length > 0 ? enabledModules.map((module) => <span key={module}>{module}</span>) : <span className="is-muted">Loading access…</span>}</div></div>
          </section>

          <section className="profile-card profile-card--preferences">
            <div className="profile-card__header"><div><p className="profile-card__eyebrow">PREFERENCES</p><h2>Notification rhythm</h2><p>Choose which updates should reach you.</p></div><Palette size={19} /></div>
            <div className="profile-preference-list">{meta.preferences.map((preference) => <div className="profile-preference" key={preference.key}><div><strong>{preference.label}</strong><small>{preference.description}</small></div><button type="button" className={`profile-switch${preferences[preference.key] ? ' is-on' : ''}`} role="switch" aria-checked={Boolean(preferences[preference.key])} aria-label={`${preference.label}: ${preferences[preference.key] ? 'on' : 'off'}`} onClick={() => setPreferences((current) => ({ ...current, [preference.key]: !current[preference.key] }))}><span /></button></div>)}</div>
            <button type="button" className="profile-button profile-button--secondary profile-button--full" onClick={savePreferences}><Check size={15} /> Save preferences</button>
          </section>

          <section className="profile-card profile-card--sessions">
            <div className="profile-card__header"><div><p className="profile-card__eyebrow">SESSION CONTROL</p><h2>Active sessions</h2><p>Review where your account is signed in.</p></div><Clock3 size={19} /></div>
            {sessionsLoading ? <div className="profile-loading"><Loader2 size={18} className="profile-spin" /> Loading sessions…</div> : sessions.length === 0 ? <div className="profile-empty">No active sessions found.</div> : <div className="profile-session-list">{sessions.slice(0, 3).map((session, index) => { const mobile = /mobile|android|iphone/i.test(`${session.device ?? ''} ${session.userAgent ?? ''}`); return <div className="profile-session" key={sessionId(session, index)}>{mobile ? <Smartphone size={17} /> : <Laptop size={17} />}<div><strong>{session.device ?? session.userAgent ?? 'Browser session'}</strong><small>{session.current ? 'Current session' : session.ip ?? session.ipAddress ?? 'Signed in device'}{session.lastSeenAt || session.createdAt ? ` · ${formatDate(session.lastSeenAt ?? session.createdAt)}` : ''}</small></div>{session.current && <span className="profile-session__current">Current</span>}</div>; })}</div>}
            <button type="button" className="profile-text-button profile-text-button--danger" onClick={() => void handleRevokeAll()} disabled={securityBusy}><RotateCcw size={14} /> Sign out all devices</button>
          </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
