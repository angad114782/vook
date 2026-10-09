import { computePayslip, periodLabel } from '../domain/payroll.ts';
import type { Row } from '../db/repo.ts';

/**
 * Large, realistic demo data for the sample company: hundreds of people with a month of attendance,
 * leave and expense history, salaries, and last month's published payroll.
 * Fully deterministic (fixed random seed) so every reset produces the same company.
 */
const COMPANY = 'company_northstar';

const mulberry32 = (seed: number) => () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

const FIRST = ['Aarav', 'Vivaan', 'Aditya', 'Vihaan', 'Arjun', 'Sai', 'Reyansh', 'Krishna', 'Ishaan', 'Rohan', 'Kabir', 'Rahul', 'Amit', 'Suresh', 'Manoj', 'Deepak', 'Nikhil', 'Pranav', 'Siddharth', 'Varun', 'Harsh', 'Yash', 'Gaurav', 'Akash', 'Tushar', 'Anaya', 'Diya', 'Ananya', 'Aadhya', 'Saanvi', 'Myra', 'Kiara', 'Isha', 'Priya', 'Neha', 'Pooja', 'Sneha', 'Kavya', 'Riya', 'Shreya', 'Meera', 'Nisha', 'Swati', 'Divya', 'Anjali', 'Komal', 'Sonal', 'Tanvi', 'Ritu', 'Preeti'];
const LAST = ['Sharma', 'Verma', 'Patil', 'Deshmukh', 'Kulkarni', 'Joshi', 'Gupta', 'Singh', 'Yadav', 'Iyer', 'Nair', 'Reddy', 'Rao', 'Mehta', 'Shah', 'Jain', 'Khan', 'Ansari', 'Pawar', 'Jadhav', 'More', 'Bhosale', 'Chavan', 'Shinde', 'Gaikwad', 'Kale', 'Thakur', 'Mishra', 'Tiwari', 'Pandey', 'Das', 'Bose', 'Banerjee', 'Kapoor', 'Malhotra', 'Bhatt', 'Desai', 'Menon', 'Pillai', 'Naidu'];
const BANKS = ['HDFC Bank', 'ICICI Bank', 'State Bank of India', 'Axis Bank', 'Kotak Mahindra Bank', 'Bank of Maharashtra'];

interface Dept { id: string; name: string; share: number; roles: Array<[string, number, number]>; shift: 'general' | 'rotating' }
const DEPTS: Dept[] = [
  { id: 'dept_eng', name: 'Engineering', share: 0.3, shift: 'general', roles: [['Software Engineer', 600_000, 1_400_000], ['Senior Software Engineer', 1_400_000, 2_400_000], ['QA Engineer', 500_000, 1_100_000], ['DevOps Engineer', 900_000, 1_800_000]] },
  { id: 'dept_ops', name: 'Operations', share: 0.32, shift: 'rotating', roles: [['Operations Executive', 300_000, 520_000], ['Machine Operator', 240_000, 400_000], ['Quality Inspector', 320_000, 560_000], ['Warehouse Associate', 220_000, 360_000]] },
  { id: 'dept_sales', name: 'Sales', share: 0.16, shift: 'general', roles: [['Sales Executive', 350_000, 700_000], ['Key Account Manager', 800_000, 1_500_000], ['Business Development Associate', 400_000, 800_000]] },
  { id: 'dept_fin', name: 'Finance', share: 0.08, shift: 'general', roles: [['Accounts Executive', 360_000, 650_000], ['Senior Accountant', 700_000, 1_200_000]] },
  { id: 'dept_hr', name: 'HR', share: 0.05, shift: 'general', roles: [['HR Executive', 360_000, 650_000], ['Talent Acquisition Specialist', 500_000, 900_000]] },
  { id: 'dept_eng', name: 'Engineering', share: 0.09, shift: 'general', roles: [['Product Designer', 600_000, 1_300_000]] },
];

const iso = (d: Date) => d.toISOString();
const dateOnly = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);
const istDate = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d);
const hhmm = (mins: number) => `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;

export interface BulkResult {
  designations: Row[]; employees: Row[]; teams: Row[]; salaries: Row[]; salaryHistory: Row[]; attendance: Row[]; leaves: Row[]; approvals: Row[];
  expenses: Row[]; attendanceRegularizations: Row[]; payslips: Row[]; payrollRuns: Row[]; attendancePeriods: Row[];
  /** Existing teams that should also gain some of the new people (so the sample supervisor has a full team). */
  addToTeams: Record<string, string[]>;
}

export function generateBulk(count: number, now: Date, firstNumber: number): BulkResult {
  const rand = mulberry32(20261008);
  const pick = <T,>(list: T[]) => list[Math.floor(rand() * list.length)]!;
  const between = (lo: number, hi: number) => Math.round(lo + rand() * (hi - lo));
  const out: BulkResult = { designations: [], employees: [], teams: [], salaries: [], salaryHistory: [], attendance: [], leaves: [], approvals: [], expenses: [], attendanceRegularizations: [], payslips: [], payrollRuns: [], attendancePeriods: [], addToTeams: {} };

  // Designations (one per role, per department)
  const seenRoles = new Set<string>();
  for (const d of DEPTS) for (const [name] of d.roles) {
    if (seenRoles.has(name)) continue;
    seenRoles.add(name);
    out.designations.push({ id: `des_bulk_${name.toLowerCase().replace(/[^a-z]+/g, '_')}`, companyId: COMPANY, name, code: name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 4), departmentId: d.id, branchIds: ['office_pune', 'office_nashik'], isActive: true });
  }

  // People
  const usedNames = new Set<string>();
  const weights = DEPTS.map((d) => d.share);
  const total = weights.reduce((a, b) => a + b, 0);
  const pickDept = () => { let r = rand() * total; for (const d of DEPTS) { r -= d.share; if (r <= 0) return d; } return DEPTS[0]!; };
  for (let i = 0; i < count; i++) {
    let name = '';
    do name = `${pick(FIRST)} ${pick(LAST)}`; while (usedNames.has(name));
    usedNames.add(name);
    const dept = pickDept();
    const [designation, lo, hi] = pick(dept.roles);
    const ctc = Math.round(between(lo, hi) / 12_000) * 12_000;
    const roll = rand();
    const status = roll < 0.9 ? 'ACTIVE' : roll < 0.93 ? 'ONBOARDING' : roll < 0.96 ? 'NOTICE_PERIOD' : roll < 0.98 ? 'SUSPENDED' : 'EXITED';
    const joinedDaysAgo = status === 'ONBOARDING' ? between(1, 14) : between(30, 1400);
    const contract = rand() < 0.14;
    const branch = dept.shift === 'rotating' ? (rand() < 0.7 ? 'office_nashik' : 'office_pune') : (rand() < 0.75 ? 'office_pune' : 'office_nashik');
    const shiftIdx = dept.shift === 'rotating' ? i % 3 : -1;
    const [shiftType, shiftTiming] = shiftIdx < 0 ? ['General', '09:00 - 18:00'] : [['Morning', 'Evening', 'Night'][shiftIdx]!, ['06:00 - 14:00', '14:00 - 22:00', '22:00 - 06:00'][shiftIdx]!];
    const seq = firstNumber + i;
    const id = `employee_bulk_${i + 1}`;
    out.employees.push({
      id, employeeId: `NS-${String(seq).padStart(4, '0')}`, companyId: COMPANY, branchId: branch, departmentId: dept.id, department: dept.name, designation,
      shiftType, shiftTiming, joiningDate: dateOnly(addDays(now, -joinedDaysAgo)), annualCtc: ctc, employmentType: contract ? 'Contract' : 'Permanent', status,
      mobile: (() => { const d = `9${String(800_000_000 + i * 131 + 17).padStart(9, '0')}`; return `+91 ${d.slice(0, 5)} ${d.slice(5)}`; })(),
      bankName: pick(BANKS), branchName: branch === 'office_nashik' ? 'Nashik' : 'Pune', accountHolder: name, version: 1, userId: null,
      user: { id: null, name, email: `${name.toLowerCase().replace(/[^a-z]+/g, '.')}.${seq}@northstar.demo`, role: 'EMPLOYEE', accountStatus: 'NOT_CREATED', lastLoginAt: null },
    });
    if (status !== 'ONBOARDING') {
      const salary = { id: `salary_bulk_${i + 1}`, companyId: COMPANY, employeeId: id, annualCtc: ctc, basicAnnual: Math.round(ctc * 0.5), allowancesAnnual: Math.round(ctc * 0.4), deductionsAnnual: Math.round(ctc * 0.1), effectiveFrom: dateOnly(addDays(now, -joinedDaysAgo)), lastRevised: iso(addDays(now, -between(20, 200))) };
      out.salaries.push(salary);
      out.salaryHistory.push({ ...salary, id: `${salary.id}_version_1`, salaryId: salary.id, version: 1, effectiveTo: null, createdAt: salary.lastRevised });
    }
  }

  // Teams: groups of 8–12 by department + branch (first manager/supervisor of the sample data lead the first two groups)
  const active = out.employees.filter((e) => e.status === 'ACTIVE');
  const groups = new Map<string, Row[]>();
  for (const e of active) { const k = `${e.departmentId}|${e.branchId}`; (groups.get(k) ?? groups.set(k, []).get(k)!).push(e); }
  let teamNo = 1;
  for (const [key, members] of groups) {
    const [departmentId, branchId] = key.split('|');
    const dept = DEPTS.find((d) => d.id === departmentId)!;
    for (let s = 0; s < members.length; s += 10) {
      const slice = members.slice(s, s + 10);
      if (slice.length < 3) continue;
      out.teams.push({ id: `team_bulk_${teamNo}`, companyId: COMPANY, branchId, departmentId, name: `${dept.name} ${branchId === 'office_nashik' ? 'Nashik' : 'Pune'} ${teamNo}`, managerEmployeeId: 'employee_3', supervisorEmployeeId: slice[0]!.id, employeeIds: slice.map((e) => e.id) });
      teamNo++;
    }
  }
  const eng = active.filter((e) => e.departmentId === 'dept_eng').slice(0, 10).map((e) => e.id);
  const ops = active.filter((e) => e.departmentId === 'dept_ops').slice(0, 12).map((e) => e.id);
  out.addToTeams = { team_engineering_platform: eng, team_ops_alpha: ops };

  // Leave: ~18% of active people have one request; some already decided
  const approvedLeaveDays = new Map<string, string>(); // `${empId}|${date}` → leave type
  const workday = (d: Date) => ![0, 6].includes(d.getUTCDay());
  const leaveTypes = ['Casual', 'Sick', 'Earned'];
  active.filter(() => rand() < 0.18).forEach((e, n) => {
    const type = pick(leaveTypes);
    const startOffset = between(-40, 30);
    const length = between(1, 4);
    let start = addDays(now, startOffset);
    while (!workday(start)) start = addDays(start, 1);
    let end = start, days = 1;
    while (days < length) { end = addDays(end, 1); if (workday(end)) days++; }
    const past = end.getTime() < now.getTime();
    const status = past ? (rand() < 0.85 ? 'APPROVED' : 'REJECTED') : rand() < 0.6 ? 'PENDING' : 'APPROVED';
    const stages = ['SUPERVISOR_RECOMMENDATION', 'MANAGER_APPROVAL', 'HR_COMPLETION'];
    const stage = status === 'PENDING' ? stages[between(0, 2)]! : 'COMPLETED';
    const leave = { id: `leave_bulk_${n + 1}`, companyId: COMPANY, employeeId: e.id, branchId: e.branchId, departmentId: e.departmentId, leaveType: type, startDate: dateOnly(start), endDate: dateOnly(end), days, reason: pick(['Family function', 'Medical appointment', 'Personal work', 'Travel', 'Fever and rest', 'Festival']), status, approvalStage: stage, version: 1, createdAt: iso(addDays(start, -between(2, 10))) };
    out.leaves.push(leave);
    if (status === 'APPROVED') for (let t = start.getTime(); t <= end.getTime(); t += 86_400_000) if (workday(new Date(t))) approvedLeaveDays.set(`${e.id}|${dateOnly(new Date(t))}`, type);
    if (status === 'PENDING') out.approvals.push({ id: `approval_bulk_leave_${n + 1}`, companyId: COMPANY, employeeId: e.id, entityType: 'LEAVE', entityId: leave.id, type: 'Leave', details: `${type} leave · ${days} day${days === 1 ? '' : 's'}`, date: leave.startDate, priority: days > 2 ? 'High' : 'Medium', status: 'PENDING', currentStage: stage, history: [], createdAt: leave.createdAt });
  });

  // Attendance: last 30 days of working days for everyone who is not exited/onboarding-new
  const today = istDate(now);
  const inPolicyWindow = (e: Row, date: string) => e.status !== 'EXITED' && date >= String(e.joiningDate);
  for (let back = 0; back < 31; back++) {
    const day = addDays(now, -back);
    const date = back === 0 ? today : dateOnly(day);
    if (!workday(new Date(`${date}T00:00:00Z`))) continue;
    for (const e of out.employees) {
      if (!inPolicyWindow(e, date) || e.status === 'SUSPENDED') continue;
      const leaveType = approvedLeaveDays.get(`${e.id}|${date}`);
      const base = { id: `attendance_${e.id}_${date}`, companyId: COMPANY, employeeId: e.id, branchId: e.branchId, departmentId: e.departmentId, date };
      if (leaveType) { out.attendance.push({ ...base, checkIn: null, checkOut: null, status: 'Leave', leaveType, source: 'LEAVE' }); continue; }
      const r = rand();
      const startMins = e.shiftType === 'Morning' ? 360 : e.shiftType === 'Evening' ? 840 : e.shiftType === 'Night' ? 1320 : 540;
      if (r < 0.035) { out.attendance.push({ ...base, checkIn: null, checkOut: null, status: 'Absent', source: 'MANUAL' }); continue; }
      const late = r < 0.115;
      const inMins = startMins + (late ? between(16, 45) : between(-12, 10));
      const stillWorking = back === 0;
      out.attendance.push({ ...base, checkIn: hhmm(((inMins % 1440) + 1440) % 1440), checkOut: stillWorking ? null : hhmm((((inMins + 540 + between(-15, 40)) % 1440) + 1440) % 1440), status: late ? 'Late' : 'Present', lateMinutes: late ? inMins - startMins : 0, source: rand() < 0.5 ? 'BIOMETRIC' : 'WEB' });
    }
  }

  // Missed-punch corrections waiting for approval
  active.filter(() => rand() < 0.04).forEach((e, n) => {
    const date = dateOnly(addDays(now, -between(2, 9)));
    out.attendanceRegularizations.push({ id: `regularization_bulk_${n + 1}`, companyId: COMPANY, employeeId: e.id, branchId: e.branchId, departmentId: e.departmentId, date, requestedCheckIn: '09:05', requestedCheckOut: null, reason: pick(['Forgot to punch in', 'Biometric device was down', 'Visited client site']), status: 'PENDING', approvalStage: pick(['SUPERVISOR_RECOMMENDATION', 'MANAGER_APPROVAL', 'HR_COMPLETION']), history: [], createdAt: iso(addDays(now, -1)) });
  });

  // Expenses at every stage of the workflow
  const categories: Array<[string, number, number]> = [['Travel', 400, 9000], ['Meals', 200, 1800], ['Materials', 1500, 22000], ['Accommodation', 2500, 14000], ['Internet', 500, 1500], ['Training', 2000, 18000]];
  active.filter(() => rand() < 0.14).forEach((e, n) => {
    const [category, lo, hi] = pick(categories);
    const stage = pick([['SUBMITTED', 'MANAGER_APPROVAL'], ['MANAGER_APPROVED', 'FINANCE_APPROVAL'], ['FINANCE_APPROVED', 'REIMBURSEMENT'], ['PAID', 'COMPLETED'], ['PAID', 'COMPLETED'], ['REJECTED', 'COMPLETED']] as Array<[string, string]>);
    const expense = { id: `expense_bulk_${n + 1}`, companyId: COMPANY, employeeId: e.id, branchId: e.branchId, departmentId: e.departmentId, category, amount: between(lo, hi), description: `${category} — ${pick(['client visit', 'plant maintenance', 'team offsite', 'monthly claim', 'project work'])}`, status: stage[0], approvalStage: stage[1], createdAt: iso(addDays(now, -between(1, 25))) };
    out.expenses.push(expense);
    if (stage[1] !== 'COMPLETED') out.approvals.push({ id: `approval_bulk_expense_${n + 1}`, companyId: COMPANY, employeeId: e.id, entityType: 'EXPENSE', entityId: expense.id, type: 'Expense', details: `${category} · ₹${expense.amount}`, status: 'PENDING', currentStage: stage[1], history: [], createdAt: expense.createdAt });
  });

  // Last month: attendance period locked and a published, mostly-paid payroll run
  const prev = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const month = prev.getUTCMonth() + 1, year = prev.getUTCFullYear();
  out.attendancePeriods.push({ id: `attendance_period_${year}_${month}`, companyId: COMPANY, month, year, status: 'LOCKED', version: 1, lockedBy: 'user_hr', lockedAt: iso(addDays(now, -now.getUTCDate() + 3)), createdAt: iso(addDays(now, -40)), updatedAt: iso(addDays(now, -now.getUTCDate() + 3)) });
  const pc = { pf: { enabled: true, employeeRate: 12, wageCeiling: 15000 }, esi: { enabled: true, employeeRate: 0.75, wageCeiling: 21000 } };
  const runId = `payroll_run_${year}_${month}`;
  const periodEnd = `${year}-${String(month).padStart(2, '0')}-${new Date(Date.UTC(year, month, 0)).getUTCDate()}`;
  let gross = 0, ded = 0, net = 0;
  out.employees.filter((e) => !['ONBOARDING', 'EXITED'].includes(e.status) && String(e.joiningDate) <= periodEnd).forEach((e, n) => {
    const salary = out.salaries.find((s) => s.employeeId === e.id)!;
    const calc = computePayslip({ employee: e, salary, compliance: pc, attendance: [], month, year });
    gross += calc.grossSalary; ded += calc.totalDeductions; net += calc.netPay;
    out.payslips.push({ id: `payslip_bulk_${n + 1}`, companyId: COMPANY, employeeId: e.id, runId, payslipId: `PS-${year}${String(month).padStart(2, '0')}-${e.employeeId}`, month, year, period: periodLabel(year, month), grossSalary: calc.grossSalary, totalDeductions: calc.totalDeductions, netPay: calc.netPay, snapshot: calc.snapshot, status: rand() < 0.9 ? 'PAID' : 'PUBLISHED', paymentStatus: 'PAID', paidAt: iso(addDays(now, -now.getUTCDate() + 5)), createdAt: iso(addDays(now, -now.getUTCDate() + 2)) });
  });
  out.payrollRuns.push({ id: runId, companyId: COMPANY, month, year, status: 'PUBLISHED', version: 5, preparedBy: 'user_finance', approvedBy: 'user_company', finalizedAt: iso(addDays(now, -now.getUTCDate() + 4)), publishedAt: iso(addDays(now, -now.getUTCDate() + 4)), payslipIds: out.payslips.map((p) => p.id), employeeCount: out.payslips.length, grossPayMinor: gross * 100, deductionsMinor: ded * 100, totalNetMinor: net * 100, currency: 'INR', validationIssues: [], createdAt: iso(addDays(now, -now.getUTCDate() + 1)), updatedAt: iso(addDays(now, -now.getUTCDate() + 4)) });
  return out;
}
