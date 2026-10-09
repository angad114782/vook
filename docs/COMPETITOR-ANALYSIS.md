# Vook — Competitor & Market Analysis

Research date: 2026-10-08. Prices come from third-party comparison articles and vendor pages and are **indicative only** — verify on vendor sites before using them in sales material.

## 1. Landscape

### India (our primary market)
| Product | Positioning | Indicative pricing | Strengths | Gaps we can exploit |
|---|---|---|---|---|
| **Keka** | SME/mid-market HR + payroll | From ~₹6,999/mo for 100 employees; ~₹60 per extra employee | Polished UX, attendance (biometric/GPS), performance | Fixed bundles; limited per-company customization of plans |
| **greytHR** | Payroll/compliance-first SME | From ~₹3,495/mo for 50 employees | Strong statutory payroll (PF/ESI/TDS), price | Dated UI, limited extensibility/API |
| **Zoho People** (+ Zoho Payroll) | Suite play inside Zoho ecosystem | From ~₹48/employee/mo | Cheap, ecosystem, GPS/offline mobile | Payroll is a separate product; HR depth vs. complexity |
| **Darwinbox** | Enterprise, large workforces | Custom quote | Depth, AI, global | Expensive, heavy implementation — poor fit for SMEs |
| **HROne, PocketHRMS, others** | Mid-market/SME | Varies | Local support, price | Fragmented feature depth |

### Global (sets user expectations)
| Product | Model | Indicative pricing | Takeaway |
|---|---|---|---|
| **Rippling** | Modular, pay only for modules | Core ~$8/emp/mo + ~$35 base; typical full HR+Payroll+Benefits $15–25 PEPM | **Modular pricing is the market direction** — and our plan-version/entitlement engine already supports it |
| **BambooHR** | Tiered (Core / Pro / Elite) | ~$10 / ~$17 / ~$25 PEPM | Simple tiers and clear UX win SMEs |
| **Deel** | EOR/global payroll/contractors | EOR ~$599 per employee/mo, contractors ~$49 | Global hiring, compliance in 130+ countries |
| **Workday** | Enterprise suite | Custom | Depth; too heavy for our segment |

Sources: [India HRMS comparison – Digisme](https://www.digisme.in/blog/comparison-of-best-hrms-software-in-india/) · [15 Best HRMS in India 2026 – PocketHRMS](https://www.pockethrms.com/hrms-software/top-10-hrms-software-in-india/) · [Rippling pricing 2026 – Gloroots](https://www.gloroots.com/blog/rippling-price) · [Rippling 2026 deep dive – Outsail](https://www.outsail.co/post/is-rippling-right-for-your-business-2026) · [BambooHR pricing 2026 – Compono](https://www.compono.com/articles/bamboohr-pricing-guide-2026) · [Workday alternatives – Siit](https://www.siit.io/tools/alternatives/workday-alternatives)

## 2. Trends shaping 2026–2030
- **Agentic AI** that executes tasks across modules ("approve all clean leaves", "prepare this month's payroll draft"), not just chatbots.
- **Skills-based workforce**: skills as the unit of work, continuously updated profiles, internal mobility.
- **Real-time workforce analytics** replacing monthly spreadsheets (attrition risk, cost, absenteeism).
- **Frontline-first**: mobile/WhatsApp-first experiences for non-desk staff.
- **AI governance**: workplace AI is regulated (EU AI Act classes recruiting/performance AI as high-risk; human oversight, logging, bias testing). Build explainability + audit from day one.
- **Modular, usage-based pricing** and composable stacks with open APIs.

Sources: [HR tech trends – Firstup](https://firstup.io/blog/the-hr-technology-trends-to-watch/) · [HR trends 2026 – Smart-IT](https://hr.smart-it.com/blog/hr-trends-2026/) · [HR software trends India 2026 – uKnowva](https://uknowva.com/blogs/hr-software-trends-india-2026-the-future-of-work) · [AI HR assistants – Engagedly](https://engagedly.com/blog/ai-hr-assistants/)

## 3. Where Vook wins (differentiators)
1. **Plans fully customizable per company** — immutable plan versions + per-company overrides already exist. Extend to a **plan builder** (modules, seat tiers, usage meters, add-ons, coupons, custom contract price). Competitors mostly sell fixed tiers.
2. **Ease of use as a rule** — written into `RULES.md`; competitors are feature-heavy and training-heavy.
3. **Everything dynamic** — custom roles/scopes, workflows, fields, reports, forms without developer help.
4. **Price-fit for SMEs with enterprise-grade control** (multi-tenant, audit, maker-checker payroll).
5. **Open by design** — OpenAPI v2, webhooks, provider adapters (payments, biometrics, mail, SMS/WhatsApp).
6. **Trust** — tenant isolation, immutable payroll, audit trail, AI explainability.

## 4. Gap list vs. market (features customers will expect)
| Area | Market baseline | Vook today | Target phase |
|---|---|---|---|
| Statutory payroll India (PF, ESI, PT, TDS, Form 16, challans) | Standard | Compliance page, partial | P3 |
| Mobile app / PWA with GPS + selfie attendance | Standard | Web responsive, GPS policy | P3 |
| Recruitment/ATS + onboarding e-sign | Common | Not built | P4 |
| Performance (OKR, 360, cycles) | Common | Not built | P4 |
| LMS / training | Common | Not built | P5 |
| Helpdesk / employee queries | Common | Support tickets (platform) | P4 |
| Benefits, loans, reimbursements | Common | Expenses only | P4 |
| Assets management | Common | Not built | P4 |
| Analytics & custom report builder | Expected | Basic reports | P3 |
| AI assistant & agents | Differentiator | None | P5 |
| Multi-language (Hindi + regional) | India-critical | None | P3 |
| Marketplace / integrations (Tally, Zoho Books, Slack, Teams, WhatsApp) | Expected | Provider abstraction | P4 |
| Global payroll / EOR | Niche | None | P7 (partner, not build) |

## 5. Build / partner / buy
- **Build:** core HR, attendance, leave, payroll engine, plan builder, workflows, analytics, AI layer.
- **Partner (integrate):** payments (Razorpay, PayU), biometric vendors, WhatsApp/SMS (Gupshup, Twilio, MSG91), e-sign (Leegality/DigiO), KYC/background verification, accounting (Tally, Zoho Books, QuickBooks), bank payout APIs.
- **Avoid building:** EOR/global payroll (partner with Deel-style providers), full LMS content, ATS job-board syndication.
