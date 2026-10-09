export const EMPLOYEE_CSV_COLUMNS = ['name', 'mobile', 'email', 'department', 'designation', 'joiningDate', 'employmentType', 'annualCtc'] as const;
export type EmployeeCsvColumn = (typeof EMPLOYEE_CSV_COLUMNS)[number];
export type EmployeeCsvRow = Record<EmployeeCsvColumn, string>;
export interface EmployeeCsvIssue { row: number; message: string }
export interface EmployeeCsvResult { rows: EmployeeCsvRow[]; issues: EmployeeCsvIssue[]; fileError?: string }

export const MAX_IMPORT_ROWS = 500;
export const MAX_IMPORT_BYTES = 1024 * 1024;
// Column titles people actually see in the template; HEADER_ALIASES below maps them back to our fields.
export const EMPLOYEE_CSV_HEADERS = ['Full Name', 'Mobile Number', 'Email', 'Department', 'Designation', 'Joining Date', 'Employment Type', 'Annual CTC'];
export const EMPLOYEE_CSV_TEMPLATE = `${EMPLOYEE_CSV_HEADERS.join(',')}\nAnkita Yadav,9876543210,ankita@company.com,Design,UI/UX Designer,15/01/2026,Permanent,1200000\n`;

// Header aliases so exports from other HR tools still map onto our columns.
const HEADER_ALIASES: Record<string, EmployeeCsvColumn> = {
  name: 'name', fullname: 'name', employeename: 'name',
  mobile: 'mobile', phone: 'mobile', mobilenumber: 'mobile', contact: 'mobile',
  email: 'email', emailaddress: 'email',
  department: 'department', dept: 'department',
  designation: 'designation', role: 'designation', title: 'designation',
  joiningdate: 'joiningDate', dateofjoining: 'joiningDate', doj: 'joiningDate',
  employmenttype: 'employmentType', type: 'employmentType',
  annualctc: 'annualCtc', ctc: 'annualCtc',
};

/** RFC 4180 parser: quoted fields, escaped quotes, embedded commas/newlines, CRLF. */
export function parseCsv(text: string): string[][] {
  const records: string[][] = [];
  let record: string[] = [];
  let field = '';
  let quoted = false;
  const src = text.replace(/^﻿/, '');
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]!;
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; } else quoted = false;
      } else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { record.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      record.push(field); field = '';
      records.push(record); record = [];
    } else field += ch;
  }
  if (field !== '' || record.length) { record.push(field); records.push(record); }
  return records.filter((r) => r.some((c) => c.trim() !== ''));
}

/** Accepts 2026-01-15 and the DD/MM/YYYY style Excel and Indian users type; returns ISO or null. */
function toIsoDate(value: string): string | null {
  const m = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/) ?? value.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (!m) return null;
  const iso = value.includes('-') && m[1]!.length === 4 ? [m[1], m[2], m[3]] : [m[3], m[2], m[1]];
  const [y, mo, d] = iso.map(Number) as [number, number, number];
  const date = new Date(Date.UTC(y, mo - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d
    ? `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}` : null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMPLOYMENT_TYPES = ['Permanent', 'Contract'];

// Spreadsheet apps prefix =,+,-,@ cells to run formulas; neutralise on text we may re-export later.
const defuse = (value: string) => /^[=@]/.test(value) ? `'${value}` : value;

export function validateEmployeeCsv(text: string): EmployeeCsvResult {
  const table = parseCsv(text);
  if (!table.length) return { rows: [], issues: [], fileError: 'This file is empty. Download the sample file, fill it in and upload it again.' };
  const headerMap = table[0]!.map((h) => HEADER_ALIASES[h.toLowerCase().replace(/[^a-z]/g, '')]);
  if (!headerMap.includes('name')) return { rows: [], issues: [], fileError: 'We could not find the “Full Name” column. Please use the sample file as your starting point.' };
  if (!headerMap.includes('mobile')) return { rows: [], issues: [], fileError: 'We could not find the “Mobile Number” column. Please use the sample file as your starting point.' };
  if (table.length - 1 > MAX_IMPORT_ROWS) return { rows: [], issues: [], fileError: `This file has too many employees. Please upload up to ${MAX_IMPORT_ROWS} at a time.` };

  const rows: EmployeeCsvRow[] = [];
  const issues: EmployeeCsvIssue[] = [];
  const seenMobile = new Set<string>();
  const seenEmail = new Set<string>();

  table.slice(1).forEach((cells, index) => {
    const rowNumber = index + 2; // 1-based, header is row 1
    const row = Object.fromEntries(EMPLOYEE_CSV_COLUMNS.map((c) => [c, ''])) as EmployeeCsvRow;
    headerMap.forEach((column, i) => { if (column) row[column] = defuse((cells[i] ?? '').trim()); });
    const problems: string[] = [];
    if (!row.name) problems.push('Name is missing');
    if (!row.mobile) problems.push('Mobile number is missing');
    else if (row.mobile.replace(/\D/g, '').length < 10) problems.push('Mobile number should have 10 digits');
    if (row.email && !EMAIL_RE.test(row.email)) problems.push('Email does not look right');
    if (row.joiningDate) {
      const iso = toIsoDate(row.joiningDate);
      if (iso) row.joiningDate = iso; else problems.push('Joining date should look like 15/01/2026');
    }
    if (row.employmentType) {
      const match = EMPLOYMENT_TYPES.find((t) => t.toLowerCase() === row.employmentType.toLowerCase());
      if (match) row.employmentType = match; else problems.push('Employment type should be Permanent or Contract');
    }
    if (row.annualCtc) {
      const digits = row.annualCtc.replace(/[₹,\s]/g, '');
      if (/^\d+$/.test(digits)) row.annualCtc = digits; else problems.push('Annual CTC should be a number like 1200000');
    }
    const mobileKey = row.mobile.replace(/\D/g, '').slice(-10);
    if (mobileKey && seenMobile.has(mobileKey)) problems.push('Same mobile number appears earlier in this file');
    if (row.email && seenEmail.has(row.email.toLowerCase())) problems.push('Same email appears earlier in this file');
    if (problems.length) { issues.push({ row: rowNumber, message: `${row.name ? `${row.name}: ` : ''}${problems.join('. ')}` }); return; }
    if (mobileKey) seenMobile.add(mobileKey);
    if (row.email) seenEmail.add(row.email.toLowerCase());
    rows.push(row);
  });
  return { rows, issues };
}
