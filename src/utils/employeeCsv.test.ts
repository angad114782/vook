import { describe, expect, it } from 'vitest';
import { EMPLOYEE_CSV_TEMPLATE, parseCsv, validateEmployeeCsv } from './employeeCsv';

describe('employee CSV import', () => {
  it('parses quoted fields, escaped quotes, embedded newlines and CRLF', () => {
    expect(parseCsv('a,"b,c","d ""e"""\r\n"x\ny",z\r\n')).toEqual([['a', 'b,c', 'd "e"'], ['x\ny', 'z']]);
  });

  it('accepts the downloadable template', () => {
    const result = validateEmployeeCsv(EMPLOYEE_CSV_TEMPLATE);
    expect(result.fileError).toBeUndefined();
    expect(result.issues).toEqual([]);
    expect(result.rows).toHaveLength(1);
  });

  it('maps header aliases and BOM', () => {
    const result = validateEmployeeCsv('﻿Full Name,Phone,CTC\nRiya,9876543210,500000');
    expect(result.rows[0]).toMatchObject({ name: 'Riya', mobile: '9876543210', annualCtc: '500000' });
  });

  it('reports row-level problems with spreadsheet row numbers', () => {
    const result = validateEmployeeCsv('name,mobile,email,joiningDate\nA,123,bad,2026-13-40\nB,9876543210,b@x.com,\nC,98765 43210,c@x.com,');
    expect(result.rows.map((r) => r.name)).toEqual(['B']);
    expect(result.issues.map((i) => i.row)).toEqual([2, 4]);
    expect(result.issues[1]!.message).toContain('Same mobile number');
  });

  it('rejects files missing required columns', () => {
    expect(validateEmployeeCsv('name,email\nA,a@x.com').fileError).toContain('Mobile Number');
    expect(validateEmployeeCsv('').fileError).toBeTruthy();
  });

  it('accepts friendly headers, DD/MM/YYYY dates and formatted CTC', () => {
    const result = validateEmployeeCsv('Full Name,Mobile Number,Joining Date,Annual CTC\nRiya,98765 43210,05/03/2026,"₹12,00,000"');
    expect(result.issues).toEqual([]);
    expect(result.rows[0]).toMatchObject({ joiningDate: '2026-03-05', annualCtc: '1200000' });
    expect(validateEmployeeCsv('name,mobile,joiningDate\nA,9876543210,31/02/2026').issues).toHaveLength(1);
  });

  it('defuses formula-looking cells', () => {
    expect(validateEmployeeCsv('name,mobile\n=1+1,9876543210').rows[0]!.name).toBe("'=1+1");
  });
});
