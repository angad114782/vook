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
  Palette,
  RotateCcw,
  Smartphone,
  Trash2,
  UserRound,
  UsersRound,
} from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { accountApi } from "../api/account";
import { useAuthStore } from "../store/authStore";
import "./profilePage.css";
import { FormSkeleton, ListSkeleton } from '../components/ui/Skeleton';

type RoleKey =
  | "SUPER_ADMIN"
  | "COMPANY_ADMIN"
  | "HR"
  | "FINANCE"
  | "MANAGER"
  | "SUPERVISOR"
  | "EMPLOYEE";
type PreferenceKey =
  | "security"
  | "approvals"
  | "attendance"
  | "payroll"
  | "digest"
  | "shifts"
  | "platform";

interface RoleMeta {
  label: string;
  eyebrow: string;
  summary: string;
  workspace: string;
  capabilities: string[];
  preferences: Array<{
    key: PreferenceKey;
    label: string;
    description: string;
  }>;
}

const roleMeta: Record<RoleKey, RoleMeta> = {
  SUPER_ADMIN: {
    label: "Super Admin",
    eyebrow: "Platform control plane",
    workspace: "All companies",
    summary:
      "You manage the VOOK platform, tenant health, and global security controls.",
    capabilities: ["All companies", "Plans & billing", "Audit & security"],
    preferences: [
      {
        key: "platform",
        label: "Platform incidents",
        description: "Critical service and tenant health alerts",
      },
      {
        key: "security",
        label: "Security events",
        description: "Sign-in, access, and audit activity",
      },
      {
        key: "digest",
        label: "Operations digest",
        description: "A concise daily platform summary",
      },
    ],
  },
  COMPANY_ADMIN: {
    label: "Company Admin",
    eyebrow: "Company workspace",
    workspace: "Your organization",
    summary:
      "You oversee people, access, workflows, and the operating setup for your company.",
    capabilities: ["People & organization", "Roles & scopes", "Plan & modules"],
    preferences: [
      {
        key: "approvals",
        label: "Approval reminders",
        description: "Requests waiting for your decision",
      },
      {
        key: "payroll",
        label: "Payroll updates",
        description: "Payroll runs, exceptions, and publishing",
      },
      {
        key: "digest",
        label: "Company digest",
        description: "A daily summary of important activity",
      },
    ],
  },
  HR: {
    label: "Human Resources",
    eyebrow: "People operations",
    workspace: "Your organization",
    summary:
      "You keep employee records, attendance, leave, payroll, and policies moving.",
    capabilities: [
      "Employee records",
      "Leave & attendance",
      "Policies & payroll",
    ],
    preferences: [
      {
        key: "approvals",
        label: "Approval reminders",
        description: "Leave and workflow decisions",
      },
      {
        key: "attendance",
        label: "Attendance alerts",
        description: "Late arrivals, absences, and exceptions",
      },
      {
        key: "payroll",
        label: "Payroll updates",
        description: "Processing and salary revision alerts",
      },
    ],
  },
  FINANCE: {
    label: "Finance",
    eyebrow: "Finance workspace",
    workspace: "Your organization",
    summary:
      "You manage payroll operations, expenses, payslips, and financial reporting.",
    capabilities: [
      "Payroll operations",
      "Expenses & payouts",
      "Reports & analytics",
    ],
    preferences: [
      {
        key: "payroll",
        label: "Payroll updates",
        description: "Runs, calculations, and payslips",
      },
      {
        key: "approvals",
        label: "Expense approvals",
        description: "Reimbursements waiting for review",
      },
      {
        key: "digest",
        label: "Finance digest",
        description: "A daily summary of finance activity",
      },
    ],
  },
  MANAGER: {
    label: "Manager",
    eyebrow: "Team workspace",
    workspace: "Your team",
    summary:
      "You lead your team through workforce planning, attendance, approvals, and reporting.",
    capabilities: ["Team workforce", "Approvals", "Team reports"],
    preferences: [
      {
        key: "approvals",
        label: "Approval reminders",
        description: "Requests waiting for your decision",
      },
      {
        key: "attendance",
        label: "Team attendance",
        description: "Late arrivals and absence alerts",
      },
      {
        key: "digest",
        label: "Weekly summary",
        description: "A concise view of team activity",
      },
    ],
  },
  SUPERVISOR: {
    label: "Supervisor",
    eyebrow: "Team operations",
    workspace: "Your team",
    summary:
      "You coordinate daily operations, shifts, attendance, and team-level approvals.",
    capabilities: [
      "Workforce operations",
      "Shift management",
      "Team approvals",
    ],
    preferences: [
      {
        key: "shifts",
        label: "Shift changes",
        description: "Assignment and roster updates",
      },
      {
        key: "attendance",
        label: "Attendance alerts",
        description: "Late arrivals and absence alerts",
      },
      {
        key: "approvals",
        label: "Approval reminders",
        description: "Requests waiting for your decision",
      },
    ],
  },
  EMPLOYEE: {
    label: "Employee",
    eyebrow: "My workspace",
    workspace: "Your organization",
    summary:
      "Keep your personal details current and stay in control of your account security.",
    capabilities: [
      "Attendance & leave",
      "Payslips & expenses",
      "Personal records",
    ],
    preferences: [
      {
        key: "attendance",
        label: "Attendance updates",
        description: "Check-in, exceptions, and regularization updates",
      },
      {
        key: "payroll",
        label: "Payslip alerts",
        description: "Know when a new payslip is ready",
      },
      {
        key: "digest",
        label: "Monthly summary",
        description: "A concise view of your work records",
      },
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
  mobile?: string | null;
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

const defaultPreferenceState = (options: RoleMeta["preferences"]) =>
  Object.fromEntries(options.map(({ key }) => [key, true])) as Record<
    PreferenceKey,
    boolean
  >;

const formatDate = (value?: string | null) =>
  value
    ? new Date(value).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "Not provided";
const sessionId = (session: Session, index: number) =>
  session._id ?? session.id ?? `session-${index}`;

export default function ProfilePage() {
  const navigate = useNavigate();
  const { user, setUser, logout } = useAuthStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const role = (user?.role ?? "EMPLOYEE") as RoleKey;
  const meta = roleMeta[role] ?? roleMeta.EMPLOYEE;
  const preferenceStorageKey = `vook-profile-preferences-${user?.id ?? "user"}`;

  const [profile, setProfile] = useState({
    name: user?.name ?? "",
    email: user?.email ?? "",
    mobile: user?.mobile ?? "",
  });
  const [avatarDraft, setAvatarDraft] = useState<string | null>(
    user?.avatar ?? null,
  );
  const [profileLoading, setProfileLoading] = useState(role === "EMPLOYEE");
  const [profileSaving, setProfileSaving] = useState(false);
  const [employee, setEmployee] = useState<EmployeeSnapshot | null>(null);
  const [passwords, setPasswords] = useState({
    current: "",
    next: "",
    confirm: "",
  });
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [securityBusy, setSecurityBusy] = useState(false);
  const [preferences, setPreferences] = useState<
    Record<PreferenceKey, boolean>
  >(() => {
    const defaults = defaultPreferenceState(meta.preferences);
    try {
      const saved = JSON.parse(
        localStorage.getItem(preferenceStorageKey) ?? "{}",
      ) as Record<PreferenceKey, boolean>;
      return { ...defaults, ...saved };
    } catch {
      return defaults;
    }
  });

  useEffect(() => {
    let active = true;
    if (role !== "EMPLOYEE") {
      setProfileLoading(false);
      return () => {
        active = false;
      };
    }

    void accountApi
      .getProfile<ProfileResponse>()
      .then(({ data }) => {
        if (!active) return;
        setEmployee(data.employee ?? null);
        setProfile((current) => ({
          name: data.name ?? current.name,
          email: data.email ?? current.email,
          mobile: data.mobile ?? current.mobile,
        }));
        if (data.avatar !== undefined) setAvatarDraft(data.avatar ?? null);
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setProfileLoading(false);
      });

    return () => {
      active = false;
    };
  }, [role]);

  useEffect(() => {
    let active = true;
    void accountApi
      .getSessions<Session>()
      .then(({ data }) => {
        if (active) setSessions(data.sessions ?? []);
      })
      .catch(() => {
        if (active) setSessions([]);
      })
      .finally(() => {
        if (active) setSessionsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const handleAvatarChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Choose a JPG, PNG, WEBP, or GIF image.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Profile photos must be 2MB or smaller.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") setAvatarDraft(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleProfileSave = async (event: FormEvent) => {
    event.preventDefault();

    if (!profile.name.trim()) {
      toast.error("Enter your name.");
      return;
    }
    if (profile.mobile.replace(/\D/g, "").length < 10) {
      toast.error("Enter a valid 10-digit mobile number.");
      return;
    }
    setProfileSaving(true);
    try {
      await accountApi.updateProfile({
        name: profile.name.trim(),
        email: profile.email.trim(),
        mobile: profile.mobile.trim(),
        ...(avatarDraft !== (user?.avatar ?? null)
          ? { avatar: avatarDraft }
          : {}),
      });
      setUser({
        name: profile.name.trim(),
        email: profile.email.trim(),
        mobile: profile.mobile.trim(),
        avatar: avatarDraft,
      });
      toast.success("Profile updated successfully.");
    } catch (error: any) {
      toast.error(
        error.response?.data?.message ?? "Unable to update your profile.",
      );
    } finally {
      setProfileSaving(false);
    }
  };

  const handlePasswordSave = async (event: FormEvent) => {
    event.preventDefault();
    if (passwords.next.length < 8) {
      toast.error("New password must be at least 8 characters.");
      return;
    }
    if (passwords.next !== passwords.confirm) {
      toast.error("New passwords do not match.");
      return;
    }
    setPasswordSaving(true);
    try {
      await accountApi.changePassword(passwords.current, passwords.next);
      setPasswords({ current: "", next: "", confirm: "" });
      setPasswordOpen(false);
      toast.success("Password updated successfully.");
    } catch (error: any) {
      toast.error(
        error.response?.data?.message ?? "Unable to update your password.",
      );
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleRevokeAll = async () => {
    if (!window.confirm("Sign out every active session, including this one?"))
      return;
    setSecurityBusy(true);
    try {
      await accountApi.revokeAllSessions();
      await logout();
      navigate("/login", { replace: true });
    } catch (error: any) {
      toast.error(
        error.response?.data?.message ?? "Unable to revoke sessions.",
      );
    } finally {
      setSecurityBusy(false);
    }
  };

  const savePreferences = () => {
    localStorage.setItem(preferenceStorageKey, JSON.stringify(preferences));
    toast.success("Notification preferences saved.");
  };

  if (!user) return null;

  return (
    <div className="profile-page">
      <header className="profile-page__header">
        <div>
          <p className="profile-page__eyebrow">
            ACCOUNT / {meta.label.toUpperCase()}
          </p>
          <h1>Profile</h1>
          <p>
            Keep your identity, access context, and account security in one
            place.
          </p>
        </div>
        <div className="profile-page__header-status">
          <span className="profile-status-dot" /> Account active{" "}
          <ChevronRight size={14} />
        </div>
      </header>

      <div className="profile-layout">
        <aside
          className="profile-identity"
          aria-labelledby="profile-identity-title"
        >
          <p className="profile-hero__kicker">{meta.eyebrow}</p>
          <button
            type="button"
            className="profile-avatar-upload"
            onClick={() => fileInputRef.current?.click()}
            aria-label="Choose profile photo"
          >
            {avatarDraft ? (
              <img
                src={avatarDraft}
                alt={`${profile.name || "User"} profile preview`}
              />
            ) : (
              <span className="profile-avatar-placeholder">
                <UserRound size={36} aria-hidden="true" />
              </span>
            )}
            <span className="profile-avatar-upload__action" aria-hidden="true">
              <Camera size={13} />
            </span>
          </button>
          <input
            ref={fileInputRef}
            className="profile-visually-hidden"
            type="file"
            accept="image/*"
            onChange={handleAvatarChange}
          />
          <div className="profile-identity__copy">
            <h2 id="profile-identity-title">
              {profile.name || "Your profile"}
            </h2>
            <p>
              <Mail size={14} /> <span>{profile.email}</span>
            </p>
          </div>
          <div className="profile-identity__photo-meta">
            <span>JPG, PNG, WEBP or GIF · max 2MB</span>
            {avatarDraft && (
              <button
                type="button"
                className="profile-text-button profile-text-button--danger"
                onClick={() => setAvatarDraft(null)}
              >
                <Trash2 size={14} /> Remove photo
              </button>
            )}
          </div>
          <div className="profile-identity__facts">
            <div>
              <span>Role</span>
              <strong>{meta.label}</strong>
            </div>
            <div>
              <span>Workspace</span>
              <strong>{meta.workspace}</strong>
            </div>
            <div>
              <span>Company</span>
              <strong>{user.company?.name ?? "VOOK platform"}</strong>
            </div>
          </div>
        </aside>

        <div className="profile-content">
          <main className="profile-main">
            <section className="profile-card profile-card--personal">
              <div className="profile-card__header">
                <div>
                  <p className="profile-card__eyebrow">IDENTITY</p>
                  <h2>Personal information</h2>
                  <p>
                    Use an email address you can access for account notices and
                    verification.
                  </p>
                </div>
                <UserRound size={19} />
              </div>
              <form
                className="profile-form"
                onSubmit={(event) => void handleProfileSave(event)}
              >
                <div className="profile-form__grid">
                  <label className="profile-field">
                    <span>Full name</span>
                    <input
                      value={profile.name}
                      onChange={(event) =>
                        setProfile({ ...profile, name: event.target.value })
                      }
                      autoComplete="name"
                      required
                    />
                  </label>
                  <label className="profile-field">
                    <span>Email address</span>
                    <input
                      value={profile.email}
                      onChange={(event) =>
                        setProfile({ ...profile, email: event.target.value })
                      }
                      type="email"
                      autoComplete="email"
                      required
                    />
                    <small>Email changes may require verification.</small>
                  </label>
                  <label className="profile-field">
                    <span>Mobile number *</span>
                    <input
                      value={profile.mobile}
                      onChange={(event) =>
                        setProfile({ ...profile, mobile: event.target.value })
                      }
                      type="tel"
                      inputMode="numeric"
                      autoComplete="tel"
                      placeholder="10-digit mobile number"
                      required
                    />
                    <small>Used to sign in with a mobile code.</small>
                  </label>
                </div>
                <div className="profile-form__footer">
                  <span>
                    Last saved changes apply across every VOOK workspace.
                  </span>
                  <div className="profile-form__buttons">
                    <button
                      type="button"
                      className="profile-button profile-button--secondary"
                      onClick={() => setPasswordOpen(true)}
                    >
                      <KeyRound size={15} /> Update password
                    </button>
                    <button
                      type="submit"
                      className="profile-button profile-button--primary"
                      disabled={profileSaving}
                    >
                      {profileSaving ? (
                        <Loader2 size={15} className="profile-spin" />
                      ) : (
                        <Check size={15} />
                      )}{" "}
                      Save profile
                    </button>
                  </div>
                </div>
              </form>
            </section>

            {role === "EMPLOYEE" && (
              <section className="profile-card profile-card--employment">
                <div className="profile-card__header">
                  <div>
                    <p className="profile-card__eyebrow">EMPLOYMENT RECORD</p>
                    <h2>Your work details</h2>
                    <p>
                      These details come from People Operations and are
                      read-only here.
                    </p>
                  </div>
                  <UsersRound size={19} />
                </div>
                {profileLoading ? (
                  <FormSkeleton fields={4} label="Loading employment record" />
                ) : (
                  <div className="profile-detail-grid">
                    <div>
                      <span>Employee ID</span>
                      <strong>{employee?.employeeId ?? "Not provided"}</strong>
                    </div>
                    <div>
                      <span>Department</span>
                      <strong>{employee?.department ?? "Not provided"}</strong>
                    </div>
                    <div>
                      <span>Designation</span>
                      <strong>{employee?.designation ?? "Not provided"}</strong>
                    </div>
                    <div>
                      <span>Employment type</span>
                      <strong>
                        {employee?.employmentType ?? "Not provided"}
                      </strong>
                    </div>
                    <div>
                      <span>Shift timing</span>
                      <strong>{employee?.shiftTiming ?? "Not provided"}</strong>
                    </div>
                    <div>
                      <span>Joining date</span>
                      <strong>{formatDate(employee?.joiningDate)}</strong>
                    </div>
                  </div>
                )}
                <div className="profile-note">
                  <BadgeCheck size={15} /> Need to change employment details?
                  Contact your HR team.
                </div>
              </section>
            )}

            <Dialog.Root
              open={passwordOpen}
              onOpenChange={(open) => {
                setPasswordOpen(open);
                if (!open) setPasswords({ current: "", next: "", confirm: "" });
              }}
            >
              <Dialog.Portal>
                <Dialog.Overlay className="profile-modal__overlay" />
                <Dialog.Content className="profile-modal">
                  <Dialog.Title>Update password</Dialog.Title>
                  <Dialog.Description>
                    Confirm your current password before choosing a new one.
                  </Dialog.Description>
                  <form
                    className="profile-form"
                    onSubmit={(event) => void handlePasswordSave(event)}
                  >
                    <label className="profile-field">
                      <span>Current password</span>
                      <input
                        value={passwords.current}
                        onChange={(event) =>
                          setPasswords({ ...passwords, current: event.target.value })
                        }
                        type="password"
                        autoComplete="current-password"
                        required
                      />
                    </label>
                    <label className="profile-field">
                      <span>New password</span>
                      <input
                        value={passwords.next}
                        onChange={(event) =>
                          setPasswords({ ...passwords, next: event.target.value })
                        }
                        type="password"
                        autoComplete="new-password"
                        minLength={8}
                        required
                      />
                    </label>
                    <label className="profile-field">
                      <span>Confirm new password</span>
                      <input
                        value={passwords.confirm}
                        onChange={(event) =>
                          setPasswords({ ...passwords, confirm: event.target.value })
                        }
                        type="password"
                        autoComplete="new-password"
                        minLength={8}
                        required
                      />
                    </label>
                    <small>At least 8 characters. Your current session stays active.</small>
                    <div className="profile-modal__actions">
                      <Dialog.Close asChild>
                        <button
                          type="button"
                          className="profile-button profile-button--secondary"
                        >
                          Cancel
                        </button>
                      </Dialog.Close>
                      <button
                        type="submit"
                        className="profile-button profile-button--primary"
                        disabled={passwordSaving}
                      >
                        {passwordSaving ? (
                          <Loader2 size={15} className="profile-spin" />
                        ) : (
                          <KeyRound size={15} />
                        )}{" "}
                        Update password
                      </button>
                    </div>
                  </form>
                </Dialog.Content>
              </Dialog.Portal>
            </Dialog.Root>

          </main>

          <aside className="profile-side">
            <section className="profile-card profile-card--preferences">
              <div className="profile-card__header">
                <div>
                  <p className="profile-card__eyebrow">PREFERENCES</p>
                  <h2>Notification rhythm</h2>
                  <p>Choose which updates should reach you.</p>
                </div>
                <Palette size={19} />
              </div>
              <div className="profile-preference-list">
                {meta.preferences.map((preference) => (
                  <div className="profile-preference" key={preference.key}>
                    <div>
                      <strong>{preference.label}</strong>
                      <small>{preference.description}</small>
                    </div>
                    <button
                      type="button"
                      className={`profile-switch${preferences[preference.key] ? " is-on" : ""}`}
                      role="switch"
                      aria-checked={Boolean(preferences[preference.key])}
                      aria-label={`${preference.label}: ${preferences[preference.key] ? "on" : "off"}`}
                      onClick={() =>
                        setPreferences((current) => ({
                          ...current,
                          [preference.key]: !current[preference.key],
                        }))
                      }
                    >
                      <span />
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                className="profile-button profile-button--secondary profile-button--full"
                onClick={savePreferences}
              >
                <Check size={15} /> Save preferences
              </button>
            </section>

            <section className="profile-card profile-card--sessions">
              <div className="profile-card__header">
                <div>
                  <p className="profile-card__eyebrow">SESSION CONTROL</p>
                  <h2>Active sessions</h2>
                  <p>Review where your account is signed in.</p>
                </div>
                <Clock3 size={19} />
              </div>
              {sessionsLoading ? (
                <ListSkeleton rows={3} label="Loading sessions" />
              ) : sessions.length === 0 ? (
                <div className="profile-empty">No active sessions found.</div>
              ) : (
                <div className="profile-session-list">
                  {sessions.slice(0, 3).map((session, index) => {
                    const mobile = /mobile|android|iphone/i.test(
                      `${session.device ?? ""} ${session.userAgent ?? ""}`,
                    );
                    return (
                      <div
                        className="profile-session"
                        key={sessionId(session, index)}
                      >
                        {mobile ? (
                          <Smartphone size={17} />
                        ) : (
                          <Laptop size={17} />
                        )}
                        <div>
                          <strong>
                            {session.device ??
                              session.userAgent ??
                              "Browser session"}
                          </strong>
                          <small>
                            {session.current
                              ? "Current session"
                              : (session.ip ??
                                session.ipAddress ??
                                "Signed in device")}
                            {session.lastSeenAt || session.createdAt
                              ? ` · ${formatDate(session.lastSeenAt ?? session.createdAt)}`
                              : ""}
                          </small>
                        </div>
                        {session.current && (
                          <span className="profile-session__current">
                            Current
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              <button
                type="button"
                className="profile-text-button profile-text-button--danger"
                onClick={() => void handleRevokeAll()}
                disabled={securityBusy}
              >
                <RotateCcw size={14} /> Sign out all devices
              </button>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
