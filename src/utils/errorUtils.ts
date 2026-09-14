type PayrollIssue = {
  employeeId?: string;
  name?: string;
  reason?: string;
};

type ErrorPayload = {
  message?: string;
  error?: {
    message?: string;
    details?: unknown;
  };
  issues?: unknown;
};

function isPayrollIssue(value: unknown): value is PayrollIssue {
  return typeof value === 'object' && value !== null && (
    'employeeId' in value || 'name' in value || 'reason' in value
  );
}

function formatIssues(value: unknown): string | undefined {
  if (!Array.isArray(value)) return undefined;

  const issues = value.filter(isPayrollIssue);
  if (issues.length === 0) return undefined;

  return issues
    .map((issue) => {
      const employee = issue.name ?? issue.employeeId ?? 'Employee';
      return `${employee}: ${issue.reason ?? 'Payroll setup needs attention.'}`;
    })
    .join(' ');
}

export function extractError(err: unknown, fallback = 'Something went wrong'): string {
  if (typeof err !== 'object' || err === null) return fallback;

  const e = err as {
    response?: { data?: ErrorPayload };
    message?: string;
  };
  const data = e.response?.data;
  const message = data?.error?.message ?? data?.message ?? e.message ?? fallback;
  const details = formatIssues(data?.issues) ?? formatIssues(data?.error?.details);

  return details ? `${message} ${details}` : message;
}
