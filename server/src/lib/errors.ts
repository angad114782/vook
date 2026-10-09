export class AppError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: unknown) {
    super(message);
  }
}
export const badRequest = (message: string, details?: unknown) => new AppError(422, 'VALIDATION_ERROR', message, details);
export const notFound = (what = 'Record') => new AppError(404, 'NOT_FOUND', `${what} not found.`);
export const forbidden = (message = 'Your role does not grant this action.', code = 'PERMISSION_DENIED', details?: unknown) => new AppError(403, code, message, details);
export const conflict = (code: string, message: string, details?: unknown) => new AppError(409, code, message, details);
export const unauthenticated = (message = 'Sign in to continue.') => new AppError(401, 'UNAUTHENTICATED', message);
