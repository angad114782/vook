import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  CreditCard,
  LockKeyhole,
  Loader2,
  ShieldCheck,
  Sparkles,
  Users,
  Building2,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import {
  onboardingApi,
  type CheckoutRegistrationData,
} from "../../api/onboarding";
import type { PlanData } from "../../api/subscriptions";
import { extractError } from "../../utils/errorUtils";
import { openPaymentCheckout } from "../../payments/checkout";

type RegisterStep = 1 | 2 | 3;

const STEPS: Array<{
  number: RegisterStep;
  label: string;
  description: string;
}> = [
  {
    number: 1,
    label: "Account details",
    description: "Tell us about your company",
  },
  {
    number: 2,
    label: "Choose a plan",
    description: "Pick the right access for your team",
  },
  {
    number: 3,
    label: "Review & pay",
    description: "Confirm your details and checkout",
  },
];

function moduleLabel(module: PlanData["moduleIds"][number]) {
  if (typeof module !== "string") return module.name;
  return module
    .replace(/^module_/, "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function RegisterPageV2() {
  const navigate = useNavigate();
  const [plans, setPlans] = useState<PlanData[]>([]);
  const [step, setStep] = useState<RegisterStep>(1);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    companyName: "",
    companyEmail: "",
    adminName: "",
    adminEmail: "",
    password: "",
    plan: "",
    billingCycle: "Monthly" as "Monthly" | "Annual",
  });

  useEffect(() => {
    onboardingApi
      .plans()
      .then((response) => {
        const availablePlans = response.data.filter(
          (plan) => plan.status === "PUBLISHED",
        );
        setPlans(availablePlans);
        setForm((current) => ({
          ...current,
          plan: current.plan || availablePlans[0]?.type || "",
        }));
      })
      .catch((reason) =>
        setError(extractError(reason, "Could not load plans.")),
      );
  }, []);

  const selected = plans.find((plan) => plan.type === form.plan);
  const amount = selected
    ? form.billingCycle === "Annual"
      ? selected.annualPrice
      : selected.price
    : 0;
  const selectedModules = useMemo(
    () => selected?.moduleIds.map(moduleLabel) ?? [],
    [selected],
  );
  const selectedFeatures = selected?.features ?? [];

  const updateForm = (changes: Partial<typeof form>) => {
    setForm((current) => ({ ...current, ...changes }));
    if (error) setError("");
  };

  const validateDetails = () => {
    if (
      !form.companyName.trim() ||
      !form.adminName.trim() ||
      !form.adminEmail.trim() ||
      !form.password
    ) {
      setError(
        "Complete the required company and administrator details to continue.",
      );
      return false;
    }
    if (!form.adminEmail.includes("@")) {
      setError("Enter a valid administrator email address to continue.");
      return false;
    }
    if (form.companyEmail && !form.companyEmail.includes("@")) {
      setError("Enter a valid company email address or leave it blank.");
      return false;
    }
    if (form.password.length < 8) {
      setError("Your password must be at least 8 characters long.");
      return false;
    }
    return true;
  };

  const continueToNextStep = () => {
    setError("");
    if (step === 1 && validateDetails()) setStep(2);
    if (step === 2) {
      if (!selected || amount <= 0) {
        setError("Choose a paid plan before continuing.");
        return;
      }
      setStep(3);
    }
  };

  const goBack = () => {
    setError("");
    setStep((current) =>
      current === 1 ? current : ((current - 1) as RegisterStep),
    );
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selected || amount <= 0) {
      setError("Choose a paid plan before continuing to checkout.");
      setStep(2);
      return;
    }
    setBusy(true);
    setError("");
    const payload: CheckoutRegistrationData = {
      company: {
        name: form.companyName.trim(),
        email: form.companyEmail.trim() || undefined,
      },
      admin: {
        name: form.adminName.trim(),
        email: form.adminEmail.trim(),
        password: form.password,
      },
      plan: selected.type,
      billingCycle: form.billingCycle,
    };
    try {
      const result = await onboardingApi.checkout(payload);
      const order = result.data;
      await openPaymentCheckout({
        keyId: order.keyId,
        amount: order.amount,
        currency: order.currency,
        orderId: order.orderId,
        description: `${selected.name} ${form.billingCycle} plan`,
      });
      navigate(
        `/register/complete?registration=${encodeURIComponent(order.registrationId)}`,
      );
    } catch (reason) {
      setError(
        extractError(reason, "Could not complete registration checkout."),
      );
      setBusy(false);
    }
  };

  const currentStep = STEPS[step - 1];

  return (
    <main className="register-shell">
      <aside className="register-story">
        <Link to="/login" className="register-brand">
          <span>V</span>VOOK
        </Link>
        <div>
          <div className="register-kicker">
            <Sparkles size={13} /> WORKFORCE OPERATIONS
          </div>
          <h1>Set up the company around how work actually flows.</h1>
          <p>
            Create your company account with a secure online subscription
            purchase. Access starts after payment and email verification.
          </p>
        </div>
        <ol>
          <li>
            <span>1</span>
            <div>
              <strong>Enter account details</strong>
              <small>Tell us about your company and administrator.</small>
            </div>
          </li>
          <li>
            <span>2</span>
            <div>
              <strong>Choose your plan</strong>
              <small>Compare included modules and limits.</small>
            </div>
          </li>
          <li>
            <span>3</span>
            <div>
              <strong>Pay securely</strong>
              <small>Complete checkout, then verify your email.</small>
            </div>
          </li>
        </ol>
      </aside>
      <section className="register-form-wrap">
        <div className="register-top">
          Already registered? <Link to="/login">Sign in</Link>
        </div>
        <div className="register-card">
          <header>
            <div className="register-eyebrow">Create your company account</div>
            <h2>{currentStep.label}</h2>
            <p>
              {currentStep.description}. You can review everything before
              payment.
            </p>
          </header>

          <nav className="register-progress" aria-label="Registration progress">
            {STEPS.map((item) => {
              const complete = item.number < step;
              const active = item.number === step;
              return (
                <button
                  type="button"
                  key={item.number}
                  className={`${active ? "is-active" : ""} ${complete ? "is-complete" : ""}`}
                  aria-current={active ? "step" : undefined}
                  disabled={item.number > step}
                  onClick={() => {
                    if (item.number <= step) {
                      setError("");
                      setStep(item.number);
                    }
                  }}
                >
                  <span className="register-progress__marker">
                    {complete ? <Check size={14} /> : item.number}
                  </span>
                  <span>
                    <strong>{item.label}</strong>
                    <small>{item.description}</small>
                  </span>
                </button>
              );
            })}
          </nav>

          {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
          )}

          <form onSubmit={submit}>
            {step === 1 && (
              <section
                className="register-step"
                aria-labelledby="account-details-heading"
              >
                <div className="register-step__heading">
                  <span className="register-step__icon">
                    <Building2 size={17} />
                  </span>
                  <div>
                    <h3 id="account-details-heading">Your account</h3>
                    <p>
                      These details will be used to create your company
                      workspace.
                    </p>
                  </div>
                </div>
                <fieldset>
                  <legend>Company</legend>
                  <div className="form-grid">
                    <label className="admin-label">
                      <span>Company name</span>
                      <input
                        className="admin-input"
                        required
                        value={form.companyName}
                        onChange={(event) =>
                          updateForm({ companyName: event.target.value })
                        }
                      />
                    </label>
                    <label className="admin-label">
                      <span>
                        Company email{" "}
                        <span className="register-optional">Optional</span>
                      </span>
                      <input
                        className="admin-input"
                        type="email"
                        value={form.companyEmail}
                        onChange={(event) =>
                          updateForm({ companyEmail: event.target.value })
                        }
                      />
                    </label>
                  </div>
                </fieldset>
                <fieldset>
                  <legend>Administrator</legend>
                  <div className="form-grid">
                    <label className="admin-label">
                      <span>Full name</span>
                      <input
                        className="admin-input"
                        required
                        value={form.adminName}
                        onChange={(event) =>
                          updateForm({ adminName: event.target.value })
                        }
                      />
                    </label>
                    <label className="admin-label">
                      <span>Work email</span>
                      <input
                        className="admin-input"
                        required
                        type="email"
                        value={form.adminEmail}
                        onChange={(event) =>
                          updateForm({ adminEmail: event.target.value })
                        }
                      />
                    </label>
                    <label className="admin-label">
                      <span>
                        Create password{" "}
                        <span className="register-optional">8+ characters</span>
                      </span>
                      <input
                        className="admin-input"
                        required
                        minLength={8}
                        type="password"
                        value={form.password}
                        onChange={(event) =>
                          updateForm({ password: event.target.value })
                        }
                      />
                    </label>
                  </div>
                </fieldset>
              </section>
            )}

            {step === 2 && (
              <section
                className="register-step"
                aria-labelledby="plan-selection-heading"
              >
                <div className="register-step__heading">
                  <span className="register-step__icon">
                    <Sparkles size={17} />
                  </span>
                  <div>
                    <h3 id="plan-selection-heading">
                      Choose what your team needs
                    </h3>
                    <p>
                      Every plan includes the core workspace. Compare the
                      included modules before you continue.
                    </p>
                  </div>
                </div>
                <div className="register-plan-toolbar">
                  <span>Billing cycle</span>
                  <div className="cycle-switch" aria-label="Billing cycle">
                    <button
                      type="button"
                      className={
                        form.billingCycle === "Monthly" ? "is-active" : ""
                      }
                      onClick={() => updateForm({ billingCycle: "Monthly" })}
                    >
                      Monthly
                    </button>
                    <button
                      type="button"
                      className={
                        form.billingCycle === "Annual" ? "is-active" : ""
                      }
                      onClick={() => updateForm({ billingCycle: "Annual" })}
                    >
                      Annual <small>save more</small>
                    </button>
                  </div>
                </div>
                {plans.length === 0 ? (
                  <p className="admin-label">
                    No paid plans are available for signup.
                  </p>
                ) : (
                  <div className="public-plan-grid">
                    {plans.map((plan) => {
                      const modules = plan.moduleIds.map(moduleLabel);
                      const features = plan.features.slice(0, 3);
                      const price =
                        form.billingCycle === "Annual"
                          ? plan.annualPrice
                          : plan.price;
                      const isSelected = form.plan === plan.type;
                      return (
                        <button
                          type="button"
                          key={plan.id}
                          className={isSelected ? "is-selected" : ""}
                          aria-pressed={isSelected}
                          onClick={() => updateForm({ plan: plan.type })}
                        >
                          <span className="public-plan-card__head">
                            <span>
                              <small>{plan.type}</small>
                              <strong>{plan.name}</strong>
                            </span>
                            {isSelected && (
                              <span className="public-plan-card__selected">
                                <Check size={12} /> Selected
                              </span>
                            )}
                          </span>
                          <span className="public-plan-card__price">
                            &#8377;{price.toLocaleString("en-IN")}
                            <small>
                              /
                              {form.billingCycle === "Annual"
                                ? "year"
                                : "month"}
                            </small>
                          </span>
                          <span className="public-plan-card__limits">
                            <span>
                              <Users size={13} /> {plan.maxUsers} employees
                            </span>
                          </span>
                          <span className="public-plan-card__included">
                            <small>Includes</small>
                            {features.map((feature) => (
                              <span key={feature}>
                                <Check size={12} />
                                {feature}
                              </span>
                            ))}
                            <span className="public-plan-card__modules">
                              <span>Modules</span>
                              {modules.slice(0, 4).map((module) => (
                                <em key={module}>{module}</em>
                              ))}
                              {modules.length > 4 && (
                                <em>+{modules.length - 4} more</em>
                              )}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
                <p className="register-secure-note">
                  <ShieldCheck size={14} /> Checkout is securely processed by
                  Razorpay.
                </p>
              </section>
            )}

            {step === 3 && (
              <section
                className="register-step"
                aria-labelledby="review-heading"
              >
                <div className="register-step__heading">
                  <span className="register-step__icon">
                    <CheckCircle2 size={17} />
                  </span>
                  <div>
                    <h3 id="review-heading">
                      Ready to activate your workspace?
                    </h3>
                    <p>
                      Review the account and plan details below. You will finish
                      setup after email verification.
                    </p>
                  </div>
                </div>
                <div className="register-review">
                  <div className="register-review__section">
                    <div>
                      <span>Company</span>
                      <strong>{form.companyName || "Not provided"}</strong>
                      <small>
                        {form.companyEmail || "No company email added"}
                      </small>
                    </div>
                    <button type="button" onClick={() => setStep(1)}>
                      Edit
                    </button>
                  </div>
                  <div className="register-review__section">
                    <div>
                      <span>Administrator</span>
                      <strong>{form.adminName || "Not provided"}</strong>
                      <small>{form.adminEmail || "Not provided"}</small>
                    </div>
                    <button type="button" onClick={() => setStep(1)}>
                      Edit
                    </button>
                  </div>
                  <div className="register-review__section register-review__section--plan">
                    <div>
                      <span>Selected plan</span>
                      <strong>{selected?.name ?? "Choose a plan"}</strong>
                      <small>
                        {form.billingCycle} billing / &#8377;
                        {amount.toLocaleString("en-IN")} /{" "}
                        {form.billingCycle === "Annual" ? "year" : "month"}
                      </small>
                    </div>
                    <button type="button" onClick={() => setStep(2)}>
                      Edit
                    </button>
                  </div>
                  {selected && (
                    <div className="register-review__included">
                      <span>Included with {selected.name}</span>
                      <div>
                        {selectedFeatures.map((feature) => (
                          <span key={feature}>
                            <Check size={12} />
                            {feature}
                          </span>
                        ))}
                      </div>
                      <p>
                        {selectedModules.slice(0, 5).join(" / ")}
                        {selectedModules.length > 5
                          ? ` / +${selectedModules.length - 5} more modules`
                          : ""}
                      </p>
                    </div>
                  )}
                </div>
              </section>
            )}

            <div className="register-actions">
              {step > 1 && (
                <button
                  type="button"
                  className="admin-button admin-button--secondary"
                  onClick={goBack}
                >
                  <ArrowLeft size={16} /> Back
                </button>
              )}
              {step < 3 ? (
                <button
                  type="button"
                  className="admin-button register-next"
                  onClick={continueToNextStep}
                >
                  Continue <ArrowRight size={16} />
                </button>
              ) : (
                <button
                  className="admin-button register-submit"
                  disabled={busy || !selected || amount <= 0}
                >
                  {busy ? (
                    <>
                      <Loader2 size={16} /> Preparing checkout...
                    </>
                  ) : (
                    <>
                      <CreditCard size={16} /> Continue to secure checkout
                    </>
                  )}
                </button>
              )}
            </div>
          </form>
          <footer>
            <span>
              <LockKeyhole size={13} /> Encrypted credentials
            </span>
            <span>
              <ShieldCheck size={13} /> Verified email
            </span>
          </footer>
        </div>
      </section>
    </main>
  );
}
