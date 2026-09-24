import api from './axios';

export interface ContributionRule {
  enabled: boolean;
  employeeGroup: string;
  employeeRate: number;
  employerRate: number;
  wageCeiling: number;
}

export interface PayrollComplianceConfig {
  id: string;
  companyId: string;
  version: number;
  effectiveFrom: string;
  stateCode: string;
  pf: ContributionRule;
  esi: ContributionRule;
  professionalTax: { enabled: boolean; employeeGroup: string; stateCode: string };
  labourWelfareFund: { enabled: boolean; employeeGroup: string; stateCode: string };
  tds: { enabled: boolean; employeeGroup: string; defaultRegime: 'OLD' | 'NEW' };
  updatedAt: string;
}

export const payrollConfigApi = {
  getCompliance: () => api.get<PayrollComplianceConfig>('/payroll-compliance'),
  saveCompliance: (config: PayrollComplianceConfig) => api.put<PayrollComplianceConfig>('/payroll-compliance', config),
};
