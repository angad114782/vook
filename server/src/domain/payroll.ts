import type { Row } from '../db/repo.ts';

/** Whole-rupee amounts, computed from integer rupees per component so gross, deductions and net always add up. */
export interface PayslipCalc {
  grossSalary: number; totalDeductions: number; netPay: number;
  snapshot: { calculationVersion: string; annualCtc: number; monthDays: number; payableDays: number; absentDays: number; basicSalary: number; allowances: number; configuredDeductions: number; pf: number; esi: number; overtimeMinutes: number; overtimePay: number; reimbursementAmount: number };
}

const pad = (n: number) => String(n).padStart(2, '0');
export const monthPrefix = (year: number, month: number) => `${year}-${pad(month)}`;
export const daysInMonth = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).getUTCDate();
export const periodLabel = (year: number, month: number) => new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(year, month - 1, 1)));

const isAbsence = (row: Row) => row.status === 'Absent' || (row.status === 'Leave' && /unpaid|lop/i.test(String(row.leaveType ?? '')));

export function computePayslip(input: { employee: Row; salary: Row; compliance: Row | null; attendance: Row[]; month: number; year: number }): PayslipCalc {
  const { employee, salary, compliance, attendance, month, year } = input;
  const annualCtc = Number(salary.annualCtc ?? employee.annualCtc ?? 0);
  const monthDays = daysInMonth(year, month);
  const joining = String(employee.joiningDate ?? '').slice(0, 10);
  const periodStart = `${monthPrefix(year, month)}-01`;
  const periodEnd = `${monthPrefix(year, month)}-${pad(monthDays)}`;
  let eligibleDays = monthDays;
  if (joining > periodEnd) eligibleDays = 0;
  else if (joining > periodStart) eligibleDays = monthDays - Number(joining.slice(8, 10)) + 1;
  const absentDays = attendance.filter(isAbsence).length;
  const payableDays = Math.max(0, eligibleDays - absentDays);
  const prorate = payableDays / monthDays;

  const basicMonthly = Number(salary.basicAnnual ?? annualCtc * 0.5) / 12;
  const allowanceMonthly = Number(salary.allowancesAnnual ?? annualCtc * 0.15) / 12;
  const deductionMonthly = Number(salary.deductionsAnnual ?? 0) / 12;
  const basicSalary = Math.round(basicMonthly * prorate);
  const allowances = Math.round(allowanceMonthly * prorate);
  const configuredDeductions = Math.round(deductionMonthly * prorate);
  const grossSalary = basicSalary + allowances;

  const pfConfig = compliance?.pf;
  const pfBase = Math.min(basicSalary, Number(pfConfig?.wageCeiling ?? basicSalary));
  const pf = pfConfig?.enabled ? Math.round((pfBase * Number(pfConfig.employeeRate ?? 0)) / 100) : 0;
  const esiConfig = compliance?.esi;
  const esi = esiConfig?.enabled && grossSalary <= Number(esiConfig.wageCeiling ?? 0) ? Math.round((grossSalary * Number(esiConfig.employeeRate ?? 0)) / 100) : 0;

  const totalDeductions = configuredDeductions + pf + esi;
  const netPay = Math.max(0, grossSalary - totalDeductions);
  return { grossSalary, totalDeductions, netPay, snapshot: { calculationVersion: 'v2', annualCtc, monthDays, payableDays, absentDays, basicSalary, allowances, configuredDeductions, pf, esi, overtimeMinutes: 0, overtimePay: 0, reimbursementAmount: 0 } };
}
