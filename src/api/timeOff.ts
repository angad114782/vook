import api from './axios';
import type { Holiday, HolidayCalendar } from '../types/hrms';

export interface HolidayCalendarInput {
  name: string;
  year: number;
  stateCode: string | null;
  employeeGroupIds: string[];
}

export const timeOffApi = {
  listHolidayCalendars: (year?: number) =>
    api.get<{ calendars: HolidayCalendar[] }>('/holiday-calendars', { params: year ? { year } : undefined }),
  createHolidayCalendar: (data: HolidayCalendarInput) =>
    api.post<HolidayCalendar>('/holiday-calendars', data, { headers: { 'Idempotency-Key': crypto.randomUUID() } }),
  updateHolidayCalendar: (id: string, version: number, data: Partial<HolidayCalendarInput>) =>
    api.patch<HolidayCalendar>(`/holiday-calendars/${id}`, { ...data, version }),
  addHoliday: (calendarId: string, version: number, data: Omit<Holiday, 'id'>) =>
    api.post<HolidayCalendar>(`/holiday-calendars/${calendarId}/holidays`, { ...data, version }, { headers: { 'Idempotency-Key': crypto.randomUUID() } }),
  deleteHoliday: (calendarId: string, holidayId: string, version: number) =>
    api.delete<HolidayCalendar>(`/holiday-calendars/${calendarId}/holidays/${holidayId}`, { data: { version } }),
  copyHolidayCalendar: (calendarId: string, targetYear: number) =>
    api.post<HolidayCalendar>(`/holiday-calendars/${calendarId}/copy`, { targetYear }, { headers: { 'Idempotency-Key': crypto.randomUUID() } }),
};
