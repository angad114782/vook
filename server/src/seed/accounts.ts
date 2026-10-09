/** Sign-in emails for the sample company, used when the demo database is seeded for real use (tests keep the *@demo.vook.app set). */
export const VOOK_LOGINS: Record<string, string> = {
  user_super: 'admin@vook.com',
  user_company: 'cadmin@vook.com',
  user_hr: 'hrc@vook.com',
  user_finance: 'finc@vook.com',
  user_manager: 'mgr@vook.com',
  user_supervisor: 'sup@vook.com',
  user_employee: 'emp@vook.com',
};

/** Sign-in mobile numbers for the same people (the five employees keep the number already on their employee record). */
export const VOOK_MOBILES: Record<string, string> = {
  user_super: '+91 90000 00001',
  user_company: '+91 90000 00002',
  user_hr: '+91 90000 10001',
  user_finance: '+91 90000 10002',
  user_manager: '+91 90000 10003',
  user_supervisor: '+91 90000 10004',
  user_employee: '+91 90000 10005',
};
