export type Language = 'en' | 'fr';

export type UserRole = 'head_teacher' | 'teacher';

export type SectionType = 'francophone' | 'anglophone' | 'general' | 'technical';

export type SequenceNumber = 1 | 2;

export type ReportPeriod = 'term' | 'seq1' | 'seq2';

export interface UserProfile {
  id: string;
  username: string;
  email: string;
  fullName: string;
  role: UserRole;
  active: boolean;
  createdAt: string;
}

export interface SchoolSettings {
  nameEn: string;
  nameFr: string;
  republicEn: string;
  republicFr: string;
  mottoRepublicEn: string;
  mottoRepublicFr: string;
  ministryEn: string;
  ministryFr: string;
  schoolMotto: string;
  city: string;
  academicYear: string;
  activeTerm: 1 | 2 | 3;
  headTeacherName: string;
  logoDataUrl: string | null;
}

export interface SectionItem {
  id: string;
  nameEn: string;
  nameFr: string;
  type: SectionType;
  createdAt: string;
}

export interface ClassItem {
  id: string;
  sectionId: string;
  name: string;
  level: string;
  createdAt: string;
}

export interface StudentItem {
  id: string;
  classId: string;
  matricule: string;
  fullName: string;
  dateOfBirth: string;
  placeOfBirth: string;
  sex: 'M' | 'F';
  repeater: boolean;
  createdAt: string;
}

export interface SubjectItem {
  id: string;
  classId: string;
  nameEn: string;
  nameFr: string;
  coefficient: number;
  code: string;
  createdAt: string;
}

export interface AssignmentItem {
  id: string;
  teacherId: string;
  teacherName: string;
  teacherUsername: string;
  classId: string;
  className: string;
  sectionId: string;
  sectionNameEn: string;
  sectionNameFr: string;
  subjectId: string;
  subjectNameEn: string;
  subjectNameFr: string;
  coefficient: number;
  createdAt: string;
}

export interface TeacherAssignedSlot extends AssignmentItem {
  studentCount: number;
  gradedCount: number;
}

export interface MarkRow {
  studentId: string;
  matricule: string;
  fullName: string;
  sex: 'M' | 'F';
  repeater: boolean;
  score: number | null;
  otherSequenceScore: number | null;
  termAverage: number | null;
  remark: string;
  updatedByName: string | null;
  updatedAt: string | null;
}

export interface DisciplineRow {
  studentId: string;
  matricule: string;
  fullName: string;
  sex: 'M' | 'F';
  justifiedAbsences: number;
  unjustifiedAbsences: number;
  lateComings: number;
  sanction: string;
  updatedAt: string | null;
}

export interface ReportCardSubjectLine {
  subjectId: string;
  code: string;
  nameEn: string;
  nameFr: string;
  coefficient: number;
  seq1Score: number | null;
  seq2Score: number | null;
  score: number | null;
  weightedScore: number | null;
  remark: string;
  teacherName: string;
  classSubjectAverage: number | null;
  subjectHighest: number | null;
  subjectLowest: number | null;
  subjectRank: number | null;
  subjectGradedCount: number;
}

export interface StudentDisciplineSummary {
  justifiedAbsences: number;
  unjustifiedAbsences: number;
  lateComings: number;
  sanction: string;
}

export interface StudentReportCard {
  student: StudentItem;
  classItem: ClassItem;
  section: SectionItem;
  term: 1 | 2 | 3;
  period: ReportPeriod;
  subjects: ReportCardSubjectLine[];
  totalCoefficients: number;
  totalGradedCoefficients: number;
  totalWeightedScore: number;
  average: number | null;
  honourRoll: boolean;
  rank: number | null;
  totalStudents: number;
  classAverage: number | null;
  highestAverage: number | null;
  lowestAverage: number | null;
  discipline: StudentDisciplineSummary;
}

export interface ClassReportBundle {
  school: SchoolSettings;
  section: SectionItem;
  classItem: ClassItem;
  term: 1 | 2 | 3;
  period: ReportPeriod;
  cards: StudentReportCard[];
  summary: {
    studentCount: number;
    subjectCount: number;
    classAverage: number | null;
    highestAverage: number | null;
    lowestAverage: number | null;
    passCount: number;
    passRate: number | null;
    honorRollCount: number;
  };
}
