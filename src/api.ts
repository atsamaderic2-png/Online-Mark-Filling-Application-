import type {
  AssignmentItem,
  ClassItem,
  ClassReportBundle,
  DisciplineRow,
  MarkRow,
  ReportPeriod,
  SchoolSettings,
  SectionItem,
  SequenceNumber,
  StudentItem,
  SubjectItem,
  TeacherAssignedSlot,
  UserProfile,
} from './types';

const TOKEN_KEY = 'scholaris_auth_token';
let unauthorizedHandler: (() => void) | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null): void {
  unauthorizedHandler = handler;
}

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string | null): void {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(path, { ...options, headers });
  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: text };
    }
  }

  if (!res.ok) {
    const message =
      data && typeof data === 'object' && 'error' in data && typeof (data as { error: unknown }).error === 'string'
        ? (data as { error: string }).error
        : `Request failed (${res.status})`;

    if (res.status === 401 && path !== '/api/auth/login') {
      setStoredToken(null);
      unauthorizedHandler?.();
    }

    throw new Error(message);
  }

  return data as T;
}

export const api = {
  getSchoolSettings: () => request<SchoolSettings>('/api/school-settings'),
  updateSchoolSettings: (payload: Partial<SchoolSettings>) =>
    request<SchoolSettings>('/api/school-settings', { method: 'PUT', body: JSON.stringify(payload) }),

  login: (identifier: string, password: string) =>
    request<{ token: string; user: UserProfile }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier, password }),
    }),
  me: () => request<{ user: UserProfile }>('/api/auth/me'),
  logout: () => request<{ ok: boolean }>('/api/auth/logout', { method: 'POST' }),

  getOverview: () =>
    request<{
      counts?: {
        sectionsCount: number;
        classesCount: number;
        studentsCount: number;
        teachersCount: number;
        subjectsCount: number;
        assignmentsCount: number;
      };
      classProgress?: Array<{
        classId: string;
        className: string;
        sectionNameEn: string;
        sectionNameFr: string;
        studentCount: number;
        subjectCount: number;
        marksCount: number;
      }>;
      assignedCount?: number;
      activeTerm: 1 | 2 | 3;
    }>('/api/overview'),

  // Teachers
  getTeachers: () => request<UserProfile[]>('/api/teachers'),
  createTeacher: (payload: { fullName: string; username: string; email: string; password: string }) =>
    request<UserProfile>('/api/teachers', { method: 'POST', body: JSON.stringify(payload) }),
  updateTeacher: (
    id: string,
    payload: { fullName?: string; username?: string; email?: string; password?: string; active?: boolean }
  ) => request<UserProfile>(`/api/teachers/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteTeacher: (id: string) => request<{ ok: boolean }>(`/api/teachers/${id}`, { method: 'DELETE' }),

  // Sections
  getSections: () => request<SectionItem[]>('/api/sections'),
  createSection: (payload: { nameEn: string; nameFr: string; type: SectionItem['type'] }) =>
    request<SectionItem>('/api/sections', { method: 'POST', body: JSON.stringify(payload) }),
  updateSection: (id: string, payload: Partial<SectionItem>) =>
    request<SectionItem>(`/api/sections/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteSection: (id: string) => request<{ ok: boolean }>(`/api/sections/${id}`, { method: 'DELETE' }),

  // Classes
  getClasses: (sectionId?: string) =>
    request<ClassItem[]>(sectionId ? `/api/classes?sectionId=${encodeURIComponent(sectionId)}` : '/api/classes'),
  createClass: (payload: { sectionId: string; name: string; level: string }) =>
    request<ClassItem>('/api/classes', { method: 'POST', body: JSON.stringify(payload) }),
  updateClass: (id: string, payload: Partial<ClassItem>) =>
    request<ClassItem>(`/api/classes/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteClass: (id: string) => request<{ ok: boolean }>(`/api/classes/${id}`, { method: 'DELETE' }),

  // Students
  getStudents: (classId?: string) =>
    request<StudentItem[]>(classId ? `/api/students?classId=${encodeURIComponent(classId)}` : '/api/students'),
  createStudent: (payload: Omit<StudentItem, 'id' | 'createdAt'>) =>
    request<StudentItem>('/api/students', { method: 'POST', body: JSON.stringify(payload) }),
  updateStudent: (id: string, payload: Partial<StudentItem>) =>
    request<StudentItem>(`/api/students/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteStudent: (id: string) => request<{ ok: boolean }>(`/api/students/${id}`, { method: 'DELETE' }),

  // Subjects
  getSubjects: (classId?: string) =>
    request<SubjectItem[]>(classId ? `/api/subjects?classId=${encodeURIComponent(classId)}` : '/api/subjects'),
  createSubject: (payload: { classId: string; nameEn: string; nameFr: string; coefficient: number; code: string }) =>
    request<SubjectItem>('/api/subjects', { method: 'POST', body: JSON.stringify(payload) }),
  updateSubject: (id: string, payload: Partial<SubjectItem>) =>
    request<SubjectItem>(`/api/subjects/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteSubject: (id: string) => request<{ ok: boolean }>(`/api/subjects/${id}`, { method: 'DELETE' }),

  // Assignments
  getAssignments: () => request<AssignmentItem[]>('/api/assignments'),
  createAssignment: (payload: { teacherId: string; classId: string; subjectId: string }) =>
    request('/api/assignments', { method: 'POST', body: JSON.stringify(payload) }),
  updateAssignment: (id: string, payload: { teacherId: string; classId: string; subjectId: string }) =>
    request(`/api/assignments/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteAssignment: (id: string) => request<{ ok: boolean }>(`/api/assignments/${id}`, { method: 'DELETE' }),

  // Teacher Scoped Workspace & Sequence Marks
  getTeacherSlots: (term: 1 | 2 | 3, sequence: SequenceNumber = 1) =>
    request<TeacherAssignedSlot[]>(`/api/teacher/assignments?term=${term}&sequence=${sequence}`),
  getMarks: (classId: string, subjectId: string, term: 1 | 2 | 3, sequence: SequenceNumber = 1) =>
    request<MarkRow[]>(
      `/api/marks?classId=${encodeURIComponent(classId)}&subjectId=${encodeURIComponent(subjectId)}&term=${term}&sequence=${sequence}`
    ),
  saveMarks: (payload: {
    classId: string;
    subjectId: string;
    term: 1 | 2 | 3;
    sequence: SequenceNumber;
    entries: Array<{ studentId: string; score: number | null; remark: string }>;
  }) => request<{ ok: boolean; updatedAt: string }>('/api/marks', { method: 'PUT', body: JSON.stringify(payload) }),

  // Student Discipline & Attendance
  getDiscipline: (classId: string, term: 1 | 2 | 3, sequence: SequenceNumber = 1) =>
    request<DisciplineRow[]>(
      `/api/discipline?classId=${encodeURIComponent(classId)}&term=${term}&sequence=${sequence}`
    ),
  saveDiscipline: (payload: {
    classId: string;
    term: 1 | 2 | 3;
    sequence: SequenceNumber;
    entries: Array<{
      studentId: string;
      justifiedAbsences: number;
      unjustifiedAbsences: number;
      lateComings: number;
      sanction: string;
    }>;
  }) => request<{ ok: boolean; updatedAt: string }>('/api/discipline', { method: 'PUT', body: JSON.stringify(payload) }),

  // Report Cards (per sequence or per whole term for whole class)
  getClassReportCards: (classId: string, term: 1 | 2 | 3, period: ReportPeriod = 'term') =>
    request<ClassReportBundle>(
      `/api/report-cards/${encodeURIComponent(classId)}?term=${term}&period=${encodeURIComponent(period)}`
    ),
};
