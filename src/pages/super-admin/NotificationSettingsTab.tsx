import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowUpRight,
  Bell,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  FileText,
  Loader2,
  Mail,
  MessageCircle,
  Save,
  Search,
  ShieldCheck,
  Smartphone,
  UsersRound,
} from "lucide-react";
import { Link } from "react-router-dom";
import { integrationsApi } from "../../api/integrations";
import { platformApi } from "../../api/platform";
import {
  normalizeNotificationSettings,
  type NotificationChannel,
  NOTIFICATION_RECIPIENTS,
  type NotificationRuleCategory,
  type NotificationSettings,
  type WhatsAppTemplate,
} from "../../utils/notificationSettings";

type InnerTab = "rules" | "whatsapp";
type Toast = (message: string, type: "success" | "error") => void;

const CHANNELS: Array<{
  key: NotificationChannel;
  label: string;
  icon: typeof Bell;
}> = [
  { key: "inApp", label: "In-app", icon: Bell },
  { key: "email", label: "Email", icon: Mail },
  { key: "whatsapp", label: "WhatsApp", icon: MessageCircle },
];

const CATEGORIES: Array<"All events" | NotificationRuleCategory> = [
  "All events",
  "People",
  "Leave",
  "Attendance",
  "Payroll",
  "Expenses",
  "Compliance",
  "Platform",
];

const CATEGORY_ICONS: Record<NotificationRuleCategory, typeof Bell> = {
  People: UsersRound,
  Leave: Bell,
  Attendance: Smartphone,
  Payroll: Mail,
  Expenses: CheckCircle2,
  Compliance: ShieldCheck,
  Platform: ArrowUpRight,
};

function SettingsSwitch({
  checked,
  onChange,
  label,
  description,
  disabled = false,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}) {
  return (
    <div
      className={`notification-settings__switch-row${disabled ? " is-disabled" : ""}`}
    >
      <span className="notification-settings__switch-copy">
        <strong>{label}</strong>
        {description && <small>{description}</small>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        className={`notification-settings__switch${checked ? " is-on" : ""}`}
        onClick={() => onChange(!checked)}
      >
        <span />
      </button>
    </div>
  );
}

function NotificationRules({
  settings,
  onChange,
}: {
  settings: NotificationSettings;
  onChange: (next: NotificationSettings) => void;
}) {
  const [search, setSearch] = useState("");
  const [category, setCategory] =
    useState<(typeof CATEGORIES)[number]>("All events");
  const [openCategories, setOpenCategories] = useState<
    Set<NotificationRuleCategory>
  >(() => new Set([]));
  const [expandedRules, setExpandedRules] = useState<Set<string>>(
    () => new Set([]),
  );

  const visibleRules = useMemo(() => {
    const query = search.trim().toLowerCase();
    return settings.rules.filter((rule) => {
      const matchesCategory =
        category === "All events" || rule.category === category;
      const recipientNames = rule.recipients
        .map(
          (recipient) =>
            NOTIFICATION_RECIPIENTS.find((item) => item.key === recipient)
              ?.label ?? recipient,
        )
        .join(" ");
      const matchesSearch =
        !query ||
        `${rule.title} ${rule.description} ${recipientNames}`
          .toLowerCase()
          .includes(query);
      return matchesCategory && matchesSearch;
    });
  }, [category, search, settings.rules]);

  const groups = CATEGORIES.slice(1)
    .map((item) => {
      const group = item as NotificationRuleCategory;
      const rules = visibleRules.filter((rule) => rule.category === group);
      const allRules = settings.rules.filter((rule) => rule.category === group);
      return {
        category: group,
        rules,
        total: allRules.length,
        active: allRules.filter((rule) => rule.enabled).length,
      };
    })
    .filter((group) => group.rules.length > 0);

  const setRule = (
    ruleId: string,
    update: (
      rule: NotificationSettings["rules"][number],
    ) => NotificationSettings["rules"][number],
  ) => {
    onChange({
      ...settings,
      rules: settings.rules.map((rule) =>
        rule.id === ruleId ? update(rule) : rule,
      ),
    });
  };

  const activeRules = settings.rules.filter((rule) => rule.enabled).length;

  const toggleCategory = (value: NotificationRuleCategory) => {
    setOpenCategories((current) => {
      const next = new Set(current);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  };

  const toggleExpandedRule = (ruleId: string) => {
    setExpandedRules((current) => {
      const next = new Set(current);
      if (next.has(ruleId)) next.delete(ruleId);
      else next.add(ruleId);
      return next;
    });
  };

  const toggleRecipient = (
    ruleId: string,
    recipient: NotificationSettings["rules"][number]["recipients"][number],
  ) => {
    setRule(ruleId, (rule) => ({
      ...rule,
      recipients: rule.recipients.includes(recipient)
        ? rule.recipients.filter((current) => current !== recipient)
        : [...rule.recipients, recipient],
    }));
  };

  return (
    <div className="notification-settings__panel-body">
      <div className="notification-settings__rules-overview">
        <strong>
          {activeRules}
          <small>/{settings.rules.length}</small>
        </strong>
        <span>notification rules active</span>
        <i />
        <span>Select recipients and delivery options for each HRMS event.</span>
      </div>

      <div className="notification-settings__channel-masters">
        <div>
          <strong>Available channels</strong>
          <small>Turn a channel off to pause it across every rule.</small>
        </div>
        <div>
          <label className="notification-settings__master-check">
            <input
              type="checkbox"
              checked={settings.channels.inApp}
              onChange={(event) =>
                onChange({
                  ...settings,
                  channels: {
                    ...settings.channels,
                    inApp: event.target.checked,
                  },
                })
              }
            />
            <Bell size={14} /> In-app
          </label>
          <label className="notification-settings__master-check">
            <input
              type="checkbox"
              checked={settings.channels.email}
              onChange={(event) =>
                onChange({
                  ...settings,
                  channels: {
                    ...settings.channels,
                    email: event.target.checked,
                  },
                })
              }
            />
            <Mail size={14} /> Email
          </label>
          <span
            className={`notification-settings__master-check is-static${settings.whatsapp.enabled ? " is-enabled" : ""}`}
          >
            <MessageCircle size={14} /> WhatsApp{" "}
            {settings.whatsapp.enabled ? "on" : "off"}
          </span>
        </div>
      </div>

      <div className="notification-settings__filters">
        <label className="admin-search">
          <Search size={15} />
          <input
            aria-label="Search notification rules"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search events or recipients"
          />
        </label>
        <label className="notification-settings__category-filter">
          <span>Module</span>
          <select
            className="admin-input"
            aria-label="Filter rules by module"
            value={category}
            onChange={(event) =>
              setCategory(event.target.value as (typeof CATEGORIES)[number])
            }
          >
            {CATEGORIES.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="notification-settings__groups">
        {groups.map(({ category: group, rules, total, active }) => {
          const Icon = CATEGORY_ICONS[group];
          const isOpen = openCategories.has(group);
          return (
            <section
              className={`notification-settings__group${isOpen ? " is-open" : ""}`}
              key={group}
            >
              <button
                type="button"
                className="notification-settings__group-trigger"
                aria-expanded={isOpen}
                onClick={() => toggleCategory(group)}
              >
                <span className="notification-settings__group-icon">
                  <Icon size={16} />
                </span>
                <span className="notification-settings__group-title">
                  <strong>{group}</strong>
                  <small>
                    {active} of {total} active
                  </small>
                </span>
                <span className="notification-settings__group-count">
                  {rules.length} {rules.length === 1 ? "event" : "events"}
                </span>
                <ChevronDown
                  size={16}
                  className="notification-settings__group-chevron"
                />
              </button>
              {isOpen && (
                <div className="notification-settings__group-content">
                  {rules.map((rule) => {
                    const isExpanded = expandedRules.has(rule.id);
                    const selectedRecipients = rule.recipients.map(
                      (recipient) =>
                        NOTIFICATION_RECIPIENTS.find(
                          (item) => item.key === recipient,
                        )?.label ?? recipient,
                    );
                    return (
                      <article
                        className={`notification-rule${rule.enabled ? "" : " is-paused"}`}
                        key={rule.id}
                      >
                        <header className="notification-rule__header">
                          <button
                            type="button"
                            role="switch"
                            aria-label={`${rule.enabled ? "Pause" : "Enable"} ${rule.title} rule`}
                            aria-checked={rule.enabled}
                            className={`notification-settings__switch notification-settings__switch--small${rule.enabled ? " is-on" : ""}`}
                            onClick={() =>
                              setRule(rule.id, (current) => ({
                                ...current,
                                enabled: !current.enabled,
                              }))
                            }
                          >
                            <span />
                          </button>
                          <span className="notification-rule__summary">
                            <strong>{rule.title}</strong>
                            <small>{rule.description}</small>
                          </span>
                          <span className="notification-rule__recipient-count">
                            {selectedRecipients.length
                              ? `${selectedRecipients.length} recipients`
                              : "No recipients"}
                          </span>
                          <button
                            type="button"
                            className="notification-rule__expand"
                            aria-label={`${isExpanded ? "Hide" : "Configure"} ${rule.title}`}
                            aria-expanded={isExpanded}
                            onClick={() => toggleExpandedRule(rule.id)}
                          >
                            {isExpanded ? "Hide settings" : "Configure"}
                            {isExpanded ? (
                              <ChevronDown size={14} />
                            ) : (
                              <ChevronRight size={14} />
                            )}
                          </button>
                        </header>
                        {isExpanded && (
                          <div className="notification-rule__details">
                            <div className="notification-rule__detail-grid">
                              <label className="admin-label">
                                Send timing
                                <select
                                  className="admin-input"
                                  value={rule.timing}
                                  disabled={!rule.enabled}
                                  onChange={(event) =>
                                    setRule(rule.id, (current) => ({
                                      ...current,
                                      timing: event.target
                                        .value as NotificationSettings["rules"][number]["timing"],
                                    }))
                                  }
                                >
                                  <option value="immediate">Immediately</option>
                                  <option value="15-minutes">
                                    After 15 minutes
                                  </option>
                                  <option value="hourly-digest">
                                    Hourly digest
                                  </option>
                                  <option value="daily-digest">
                                    Daily digest
                                  </option>
                                </select>
                              </label>
                              <div className="notification-rule__delivery-summary">
                                <span>Recipients for this event</span>
                                <strong>
                                  {selectedRecipients.length
                                    ? selectedRecipients.join(", ")
                                    : "Select at least one role"}
                                </strong>
                              </div>
                            </div>

                            <fieldset
                              className="notification-rule__recipient-fieldset"
                              aria-label={`Recipient roles for ${rule.title}`}
                              disabled={!rule.enabled}
                            >
                              <legend>Notify these roles</legend>
                              <p>
                                Select one or more platform roles for this
                                event.
                              </p>
                              <div className="notification-rule__recipient-options">
                                {NOTIFICATION_RECIPIENTS.map(
                                  ({ key, label }) => {
                                    const selected =
                                      rule.recipients.includes(key);
                                    return (
                                      <button
                                        type="button"
                                        className={`notification-rule__role${selected ? " is-selected" : ""}`}
                                        aria-pressed={selected}
                                        key={key}
                                        onClick={() =>
                                          toggleRecipient(rule.id, key)
                                        }
                                      >
                                        {selected ? (
                                          <Check size={13} />
                                        ) : (
                                          <span className="notification-rule__role-empty" />
                                        )}
                                        {label}
                                      </button>
                                    );
                                  },
                                )}
                              </div>
                            </fieldset>

                            <fieldset
                              className="notification-rule__channel-fieldset"
                              disabled={!rule.enabled}
                            >
                              <legend>Delivery channels</legend>
                              <div className="notification-rule__channels">
                                {CHANNELS.map(
                                  ({ key, label, icon: ChannelIcon }) => {
                                    const masterEnabled =
                                      key === "inApp"
                                        ? settings.channels.inApp
                                        : key === "email"
                                          ? settings.channels.email
                                          : settings.whatsapp.enabled;
                                    return (
                                      <label
                                        className={`notification-rule__channel${rule.channels[key] ? " is-selected" : ""}${!masterEnabled ? " is-unavailable" : ""}`}
                                        key={key}
                                      >
                                        <input
                                          type="checkbox"
                                          aria-label={`${rule.title} via ${label}`}
                                          checked={rule.channels[key]}
                                          disabled={!masterEnabled}
                                          onChange={(event) =>
                                            setRule(rule.id, (current) => ({
                                              ...current,
                                              channels: {
                                                ...current.channels,
                                                [key]: event.target.checked,
                                              },
                                            }))
                                          }
                                        />
                                        <ChannelIcon size={14} />
                                        <span>{label}</span>
                                      </label>
                                    );
                                  },
                                )}
                              </div>
                            </fieldset>

                            <div className="notification-rule__reminder">
                              <label>
                                <input
                                  type="checkbox"
                                  checked={rule.reminderEnabled}
                                  disabled={!rule.enabled}
                                  onChange={(event) =>
                                    setRule(rule.id, (current) => ({
                                      ...current,
                                      reminderEnabled: event.target.checked,
                                    }))
                                  }
                                />
                                <span>
                                  <strong>
                                    Send a follow-up if still pending
                                  </strong>
                                  <small>
                                    Useful for approvals that are waiting on a
                                    manager or finance reviewer.
                                  </small>
                                </span>
                              </label>
                              {rule.reminderEnabled && (
                                <label className="notification-rule__reminder-delay">
                                  After
                                  <select
                                    className="admin-input"
                                    value={rule.reminderAfterHours}
                                    disabled={!rule.enabled}
                                    onChange={(event) =>
                                      setRule(rule.id, (current) => ({
                                        ...current,
                                        reminderAfterHours: Number(
                                          event.target.value,
                                        ),
                                      }))
                                    }
                                  >
                                    {[4, 8, 24, 48, 72, 168].map((hours) => (
                                      <option value={hours} key={hours}>
                                        {hours < 24
                                          ? `${hours} hours`
                                          : `${hours / 24} day${hours > 24 ? "s" : ""}`}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                              )}
                            </div>
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}
        {!groups.length && (
          <div className="notification-settings__empty-state">
            No HRMS events match this filter.
          </div>
        )}
      </div>
      <p className="notification-settings__footnote">
        WhatsApp messages are sent only when the Cloud API integration is active
        and the employee has a verified mobile number.
      </p>
    </div>
  );
}

function WhatsAppSettings({
  settings,
  onChange,
  integration,
}: {
  settings: NotificationSettings;
  onChange: (next: NotificationSettings) => void;
  integration?: Awaited<
    ReturnType<typeof integrationsApi.list>
  >["data"][number];
}) {
  const active = integration?.status === "ACTIVE";
  const phoneNumberId = String(integration?.publicConfig?.phoneNumberId ?? "");
  const businessAccountId = String(
    integration?.publicConfig?.businessAccountId ?? "",
  );
  const selectedRule = settings.rules.find(
    (rule) => rule.enabled && rule.channels.whatsapp,
  );
  const previewTemplate = settings.whatsapp.templates.find(
    (template) => template.ruleId === selectedRule?.id && template.enabled,
  );

  const setPreference = <K extends keyof NotificationSettings["whatsapp"]>(
    key: K,
    value: NotificationSettings["whatsapp"][K],
  ) =>
    onChange({
      ...settings,
      whatsapp: { ...settings.whatsapp, [key]: value },
    });
  const updateTemplate = (id: string, patch: Partial<WhatsAppTemplate>) =>
    onChange({
      ...settings,
      whatsapp: {
        ...settings.whatsapp,
        templates: settings.whatsapp.templates.map((template) =>
          template.id === id ? { ...template, ...patch } : template,
        ),
      },
    });

  return (
    <div className="notification-settings__whatsapp-layout">
      <section className="notification-settings__wa-connection">
        <header>
          <span className="notification-settings__wa-icon">
            <MessageCircle size={20} />
          </span>
          <span>
            <strong>WhatsApp Cloud API</strong>
            <small>Meta Business messaging for Vook HRMS</small>
          </span>
          <span
            className={`notification-settings__connection-status${active ? " is-active" : ""}`}
          >
            <i />
            {active
              ? "Connected"
              : integration?.status === "DRAFT"
                ? "Setup in progress"
                : "Not connected"}
          </span>
        </header>
        <p className="notification-settings__connection-copy">
          {active
            ? "Your Cloud API connection is active. Selected HRMS rules can now deliver approved WhatsApp notifications."
            : "Connect a Meta WhatsApp Business number to deliver leave, attendance, payroll and expense updates."}
        </p>
        <div className="notification-settings__wa-connection-meta">
          <span>
            <small>Phone number ID</small>
            <strong>{phoneNumberId || "Not configured"}</strong>
          </span>
          <span>
            <small>Business account ID</small>
            <strong>{businessAccountId || "Not configured"}</strong>
          </span>
        </div>
        <Link
          className="admin-button notification-settings__manage-integration"
          to="/integrations"
        >
          {active
            ? "Manage WhatsApp integration"
            : "Configure WhatsApp integration"}
          <ArrowUpRight size={15} />
        </Link>
      </section>

      <section className="notification-settings__wa-preferences">
        <div className="notification-settings__section-heading">
          <div>
            <span className="notification-settings__eyebrow">
              DELIVERY PREFERENCES
            </span>
            <h3>WhatsApp notifications</h3>
            <p>Control when and how HRMS alerts are sent.</p>
          </div>
          <span className="notification-settings__settings-icon">
            <Smartphone size={18} />
          </span>
        </div>
        <SettingsSwitch
          checked={settings.whatsapp.enabled}
          onChange={(enabled) => setPreference("enabled", enabled)}
          label="Enable WhatsApp channel"
          description="Use WhatsApp for the events selected in Notification rules."
        />
        <SettingsSwitch
          checked={settings.whatsapp.quietHoursEnabled}
          onChange={(enabled) => setPreference("quietHoursEnabled", enabled)}
          label="Respect quiet hours"
          description="Hold non-urgent messages outside the company's local workday."
          disabled={!settings.whatsapp.enabled}
        />
        {settings.whatsapp.quietHoursEnabled && (
          <div className="notification-settings__time-window">
            <label className="admin-label">
              Quiet hours start
              <input
                className="admin-input"
                type="time"
                value={settings.whatsapp.quietHoursStart}
                disabled={!settings.whatsapp.enabled}
                onChange={(event) =>
                  setPreference("quietHoursStart", event.target.value)
                }
              />
            </label>
            <span>to</span>
            <label className="admin-label">
              Quiet hours end
              <input
                className="admin-input"
                type="time"
                value={settings.whatsapp.quietHoursEnd}
                disabled={!settings.whatsapp.enabled}
                onChange={(event) =>
                  setPreference("quietHoursEnd", event.target.value)
                }
              />
            </label>
          </div>
        )}
        <SettingsSwitch
          checked={settings.whatsapp.fallbackToInApp}
          onChange={(enabled) => setPreference("fallbackToInApp", enabled)}
          label="Keep an in-app copy"
          description="Employees can still find the alert in Vook if WhatsApp delivery is unavailable."
          disabled={!settings.whatsapp.enabled}
        />
        <SettingsSwitch
          checked={settings.whatsapp.includeCompanyName}
          onChange={(enabled) => setPreference("includeCompanyName", enabled)}
          label="Include company name"
          description="Identify the employer in message templates sent to employees."
          disabled={!settings.whatsapp.enabled}
        />
      </section>

      <section className="notification-settings__wa-preview">
        <div className="notification-settings__section-heading">
          <div>
            <span className="notification-settings__eyebrow">
              MESSAGE PREVIEW
            </span>
            <h3>Employee notification</h3>
            <p>Preview uses a sample HRMS event.</p>
          </div>
          <CheckCircle2 size={18} />
        </div>
        <div className="notification-settings__message-preview">
          <span>
            Vook
            {settings.whatsapp.includeCompanyName
              ? " · Northstar Manufacturing"
              : ""}
          </span>
          <p>
            Hi Dev, your {selectedRule?.title.toLowerCase() ?? "HRMS update"} is
            ready. Sign in to Vook to view the details.
          </p>
          <small>Today · 10:42</small>
        </div>
        <div className="notification-settings__preview-template">
          <FileText size={13} /> {previewTemplate?.name ?? "No template mapped"}
        </div>
        <div className="notification-settings__preview-footer">
          <Clock3 size={14} />{" "}
          {settings.whatsapp.quietHoursEnabled
            ? `Quiet hours ${settings.whatsapp.quietHoursStart}–${settings.whatsapp.quietHoursEnd}`
            : "Quiet hours are off"}
        </div>
      </section>

      <section className="notification-settings__template-library">
        <div className="notification-settings__section-heading">
          <div>
            <span className="notification-settings__eyebrow">
              META MESSAGE TEMPLATES
            </span>
            <h3>WhatsApp template mappings</h3>
            <p>
              Map HRMS events to templates already approved in WhatsApp Manager.
            </p>
          </div>
          <FileText size={18} />
        </div>
        <div
          className="notification-settings__template-table"
          role="table"
          aria-label="WhatsApp template mappings"
        >
          <div className="notification-settings__template-head" role="row">
            <span>Event</span>
            <span>Template name</span>
            <span>Language</span>
            <span>Status</span>
          </div>
          {settings.whatsapp.templates.map((template) => {
            const rule = settings.rules.find(
              (item) => item.id === template.ruleId,
            );
            return (
              <div
                className={`notification-settings__template-row${template.enabled ? "" : " is-disabled"}`}
                role="row"
                key={template.id}
              >
                <label className="notification-settings__template-event">
                  <input
                    type="checkbox"
                    checked={template.enabled}
                    disabled={!settings.whatsapp.enabled}
                    onChange={(event) =>
                      updateTemplate(template.id, {
                        enabled: event.target.checked,
                      })
                    }
                  />
                  <span>
                    <strong>{rule?.title ?? template.ruleId}</strong>
                    <small>{rule?.category ?? "HRMS event"}</small>
                  </span>
                </label>
                <label className="notification-settings__template-field">
                  <span>Template name</span>
                  <input
                    className="admin-input"
                    aria-label={`Template name for ${rule?.title ?? template.ruleId}`}
                    value={template.name}
                    disabled={!settings.whatsapp.enabled || !template.enabled}
                    onChange={(event) =>
                      updateTemplate(template.id, {
                        name: event.target.value
                          .toLowerCase()
                          .replace(/[^a-z0-9_]/g, "_"),
                      })
                    }
                  />
                </label>
                <label className="notification-settings__template-field">
                  <span>Language</span>
                  <select
                    className="admin-input"
                    aria-label={`Template language for ${rule?.title ?? template.ruleId}`}
                    value={template.language}
                    disabled={!settings.whatsapp.enabled || !template.enabled}
                    onChange={(event) =>
                      updateTemplate(template.id, {
                        language: event.target.value,
                      })
                    }
                  >
                    <option value="en">English</option>
                    <option value="en_US">English (US)</option>
                    <option value="hi">Hindi</option>
                  </select>
                </label>
                <span
                  className="notification-settings__template-status"
                  data-status={template.status}
                >
                  {template.status}
                </span>
              </div>
            );
          })}
        </div>
        <p className="notification-settings__template-help">
          <ShieldCheck size={14} /> Template approval still happens in Meta
          WhatsApp Manager. Vook stores only the approved template name,
          language, and event mapping.
        </p>
      </section>
    </div>
  );
}

export default function NotificationSettingsTab({
  showToast,
}: {
  showToast: Toast;
}) {
  const queryClient = useQueryClient();
  const [innerTab, setInnerTab] = useState<InnerTab>("rules");
  const [settings, setSettings] = useState<NotificationSettings>(
    normalizeNotificationSettings(undefined),
  );
  const [saving, setSaving] = useState(false);
  const settingsQuery = useQuery({
    queryKey: ["platform-settings"],
    queryFn: () =>
      platformApi
        .getSettings<Record<string, unknown>>()
        .then((response) => response.data),
  });
  const integrationsQuery = useQuery({
    queryKey: ["integrations"],
    queryFn: () => integrationsApi.list().then((response) => response.data),
  });

  useEffect(() => {
    if (settingsQuery.data) {
      setSettings(
        normalizeNotificationSettings(settingsQuery.data.notifications),
      );
    }
  }, [settingsQuery.data]);

  const integration = integrationsQuery.data?.find(
    (item) => item.providerKey === "WHATSAPP",
  );
  const handleSave = async () => {
    if (
      settings.whatsapp.templates.some(
        (template) => template.enabled && !template.name.trim(),
      )
    ) {
      showToast(
        "Every enabled WhatsApp mapping needs a template name",
        "error",
      );
      return;
    }
    setSaving(true);
    try {
      await platformApi.updateSettings("notifications", settings);
      await queryClient.invalidateQueries({ queryKey: ["platform-settings"] });
      showToast("Notification rules saved", "success");
    } catch {
      showToast("Unable to save notification rules", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="notification-settings admin-card">
      <header className="notification-settings__header">
        <div>
          <span className="notification-settings__eyebrow">
            SUPER ADMIN · SYSTEM SETTINGS
          </span>
          <h2>Notification rules</h2>
          <p>
            Choose which HRMS events notify employees, approvers and
            administrators.
          </p>
        </div>
        <div className="notification-settings__header-icon">
          <Bell size={19} />
        </div>
      </header>

      <div
        className="notification-settings__tabs"
        role="tablist"
        aria-label="Notification settings"
      >
        <button
          role="tab"
          aria-selected={innerTab === "rules"}
          onClick={() => setInnerTab("rules")}
        >
          <Bell size={15} /> Rules <span>{settings.rules.length}</span>
        </button>
        <button
          role="tab"
          aria-selected={innerTab === "whatsapp"}
          onClick={() => setInnerTab("whatsapp")}
        >
          <MessageCircle size={15} /> WhatsApp
          <i className={integration?.status === "ACTIVE" ? "is-active" : ""} />
        </button>
      </div>

      {settingsQuery.isLoading ? (
        <div className="notification-settings__loading">
          <Loader2 size={17} className="spin" /> Loading notification settings…
        </div>
      ) : settingsQuery.isError ? (
        <div className="notification-settings__error">
          Notification settings could not be loaded. Refresh and try again.
        </div>
      ) : innerTab === "rules" ? (
        <NotificationRules settings={settings} onChange={setSettings} />
      ) : (
        <WhatsAppSettings
          settings={settings}
          onChange={setSettings}
          integration={integration}
        />
      )}

      <footer className="notification-settings__footer">
        {settingsQuery.isError && (
          <span>Changes cannot be saved until settings load successfully.</span>
        )}
        {!settingsQuery.isError && (
          <span>
            Changes apply across all companies using the Vook platform.
          </span>
        )}
        <button
          className="admin-button"
          disabled={saving || settingsQuery.isLoading || settingsQuery.isError}
          onClick={() => void handleSave()}
        >
          {saving ? <Loader2 size={15} className="spin" /> : <Save size={15} />}
          {saving ? "Saving…" : "Save notification settings"}
        </button>
      </footer>
    </section>
  );
}
