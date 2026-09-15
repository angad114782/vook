import { describe, expect, it } from 'vitest';
import { createEmployeeCsv } from './PlatformEmployeeDirectoryPage';

describe('platform employee CSV export', () => {
  it('exports directory fields and neutralizes spreadsheet formulas', () => {
    const csv = createEmployeeCsv([{
      id: 'employee_1', employeeId: 'EMP-001', name: '=HYPERLINK("bad")',
      email: 'employee@example.test', mobile: '+91 90000 10001', status: 'ACTIVE',
      companyId: { name: 'Example Co', companyCode: 'EX-1' },
    }]);

    expect(csv).toContain('Work email');
    expect(csv).toContain("'=HYPERLINK");
    expect(csv).not.toContain('Salary');
  });
});
