import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express, { type NextFunction, type Request, type Response } from 'express';
import { db, hashPassword, initDatabase, makeId, verifyPassword } from './server/db.ts';
import type {
  AssignmentItem,
  ClassItem,
  ClassReportBundle,
  DisciplineRow,
  MarkRow,
  ReportCardSubjectLine,
  ReportPeriod,
  SchoolSettings,
  SectionItem,
  SequenceNumber,
  StudentDisciplineSummary,
  StudentItem,
  StudentReportCard,
  SubjectItem,
  UserProfile,
  UserRole,
} from './src/types.ts';

initDatabase();

db.exec(`
  CREATE TABLE IF NOT EXISTS revoked_sessions (
    token TEXT PRIMARY KEY,
    revoked_at TEXT NOT NULL
  );
`);

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const SESSION_SECRET_KEY = crypto
  .createHash('sha256')
  .update(process.env.SESSION_SECRET || 'gbhs-douala-academic-session-secret-v1')
  .digest();

function issueSessionToken(userId: string): { token: string; expiresAt: string } {
  const expMs = Date.now() + SESSION_TTL_MS;
  const payload = {
    uid: userId,
    exp: expMs,
    jti: crypto.randomBytes(12).toString('hex'),
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sigB64 = crypto
    .createHmac('sha256', SESSION_SECRET_KEY)
    .update(payloadB64)
    .digest('base64url');
  return {
    token: `${payloadB64}.${sigB64}`,
    expiresAt: new Date(expMs).toISOString(),
  };
}

function verifySignedSessionToken(token: string): { uid: string; exp: number } | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payloadB64, sigB64] = parts;
  if (!payloadB64 || !sigB64) return null;

  const expectedSig = crypto
    .createHmac('sha256', SESSION_SECRET_KEY)
    .update(payloadB64)
    .digest('base64url');

  const sigBuf = Buffer.from(sigB64);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as {
      uid?: unknown;
      exp?: unknown;
    };
    if (typeof parsed.uid !== 'string' || typeof parsed.exp !== 'number') return null;
    if (parsed.exp < Date.now()) return null;
    return { uid: parsed.uid, exp: parsed.exp };
  } catch {
    return null;
  }
}

interface AuthenticatedRequest extends Request {
  user?: UserProfile;
  authToken?: string;
}

function mapUserRow(row: Record<string, unknown>): UserProfile {
  return {
    id: String(row.id),
    username: String(row.username),
    email: String(row.email),
    fullName: String(row.full_name),
    role: row.role as UserRole,
    active: Number(row.active) === 1,
    createdAt: String(row.created_at),
  };
}

function getSchoolSettingsRow(): SchoolSettings {
  const row = db.prepare('SELECT * FROM school_settings WHERE id = 1').get() as Record<string, unknown>;
  return {
    nameEn: String(row.name_en),
    nameFr: String(row.name_fr),
    republicEn: String(row.republic_en),
    republicFr: String(row.republic_fr),
    mottoRepublicEn: String(row.motto_republic_en),
    mottoRepublicFr: String(row.motto_republic_fr),
    ministryEn: String(row.ministry_en),
    ministryFr: String(row.ministry_fr),
    schoolMotto: String(row.school_motto),
    city: String(row.city),
    academicYear: String(row.academic_year),
    activeTerm: (Number(row.active_term) as 1 | 2 | 3) || 1,
    headTeacherName: String(row.head_teacher_name),
    logoDataUrl: row.logo_data_url ? String(row.logo_data_url) : null,
  };
}

function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

  if (!token) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const revokedRow = db
    .prepare('SELECT token FROM revoked_sessions WHERE token = ?')
    .get(token) as { token: string } | undefined;
  if (revokedRow) {
    res.status(401).json({ error: 'Session revoked' });
    return;
  }

  let row = db
    .prepare(
      `SELECT u.*, s.expires_at
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token = ?`
    )
    .get(token) as Record<string, unknown> | undefined;

  if (!row) {
    // Seamless recovery across container restarts or SQLite resets using signed token verification
    const verified = verifySignedSessionToken(token);
    if (!verified) {
      res.status(401).json({ error: 'Invalid or expired session' });
      return;
    }

    const userRow = db
      .prepare('SELECT * FROM users WHERE id = ?')
      .get(verified.uid) as Record<string, unknown> | undefined;
    if (!userRow) {
      res.status(401).json({ error: 'Invalid or expired session' });
      return;
    }

    const nowIso = new Date().toISOString();
    const renewedExp = new Date(Date.now() + SESSION_TTL_MS).toISOString();
    db.prepare(
      'INSERT OR IGNORE INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)'
    ).run(token, String(userRow.id), nowIso, renewedExp);

    row = { ...userRow, expires_at: renewedExp };
  } else {
    const expTime = new Date(String(row.expires_at)).getTime();
    if (expTime < Date.now()) {
      db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
      res.status(401).json({ error: 'Session expired' });
      return;
    }
    // Sliding renewal when less than half TTL remains
    if (expTime - Date.now() < SESSION_TTL_MS / 2) {
      const renewedExp = new Date(Date.now() + SESSION_TTL_MS).toISOString();
      db.prepare('UPDATE sessions SET expires_at = ? WHERE token = ?').run(renewedExp, token);
    }
  }

  if (Number(row.active) !== 1) {
    res.status(403).json({ error: 'Account is deactivated' });
    return;
  }

  req.user = mapUserRow(row);
  req.authToken = token;
  next();
}

function requireHeadTeacher(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (!req.user || req.user.role !== 'head_teacher') {
    res.status(403).json({ error: 'Head teacher privileges required' });
    return;
  }
  next();
}

function isTeacherAssigned(teacherId: string, classId: string, subjectId: string): boolean {
  const row = db
    .prepare('SELECT id FROM teacher_assignments WHERE teacher_id = ? AND class_id = ? AND subject_id = ?')
    .get(teacherId, classId, subjectId);
  return Boolean(row);
}

async function startServer(): Promise<void> {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '5mb' }));

  // Health check endpoint for Render zero-downtime deploys
  app.get('/api/health', (_req, res) => {
    try {
      db.prepare('SELECT 1').get();
      res.status(200).json({ ok: true, status: 'healthy', timestamp: new Date().toISOString() });
    } catch (err) {
      res.status(503).json({
        ok: false,
        status: 'unhealthy',
        error: err instanceof Error ? err.message : 'Database unavailable',
      });
    }
  });

  // Public school branding for login screen
  app.get('/api/school-settings', (_req, res) => {
    res.json(getSchoolSettingsRow());
  });

  app.put('/api/school-settings', requireAuth, requireHeadTeacher, (req: AuthenticatedRequest, res) => {
    const body = req.body as Partial<SchoolSettings>;
    const current = getSchoolSettingsRow();
    const activeTerm = [1, 2, 3].includes(Number(body.activeTerm)) ? Number(body.activeTerm) : current.activeTerm;

    if (body.logoDataUrl && typeof body.logoDataUrl === 'string' && body.logoDataUrl.length > 2_800_000) {
      res.status(400).json({ error: 'Logo image is too large (max 2MB)' });
      return;
    }

    db.prepare(
      `UPDATE school_settings SET
        name_en = ?,
        name_fr = ?,
        republic_en = ?,
        republic_fr = ?,
        motto_republic_en = ?,
        motto_republic_fr = ?,
        ministry_en = ?,
        ministry_fr = ?,
        school_motto = ?,
        city = ?,
        academic_year = ?,
        active_term = ?,
        head_teacher_name = ?,
        logo_data_url = ?
      WHERE id = 1`
    ).run(
      (body.nameEn ?? current.nameEn).trim(),
      (body.nameFr ?? current.nameFr).trim(),
      (body.republicEn ?? current.republicEn).trim(),
      (body.republicFr ?? current.republicFr).trim(),
      (body.mottoRepublicEn ?? current.mottoRepublicEn).trim(),
      (body.mottoRepublicFr ?? current.mottoRepublicFr).trim(),
      (body.ministryEn ?? current.ministryEn).trim(),
      (body.ministryFr ?? current.ministryFr).trim(),
      (body.schoolMotto ?? current.schoolMotto).trim(),
      (body.city ?? current.city).trim(),
      (body.academicYear ?? current.academicYear).trim(),
      activeTerm,
      (body.headTeacherName ?? current.headTeacherName).trim(),
      body.logoDataUrl === undefined ? current.logoDataUrl : body.logoDataUrl
    );

    res.json(getSchoolSettingsRow());
  });

  // Auth routes
  app.post('/api/auth/login', (req, res) => {
    const { identifier, password } = req.body as { identifier?: string; password?: string };
    const cleanId = (identifier ?? '').trim().toLowerCase();
    if (!cleanId || !password) {
      res.status(400).json({ error: 'Username/email and password are required' });
      return;
    }

    const row = db
      .prepare('SELECT * FROM users WHERE LOWER(username) = ? OR LOWER(email) = ?')
      .get(cleanId, cleanId) as Record<string, unknown> | undefined;

    if (!row || !verifyPassword(password, String(row.password_hash))) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    if (Number(row.active) !== 1) {
      res.status(403).json({ error: 'This account has been deactivated by the head teacher' });
      return;
    }

    const now = new Date();
    const { token, expiresAt } = issueSessionToken(String(row.id));

    db.prepare('INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)').run(
      token,
      String(row.id),
      now.toISOString(),
      expiresAt
    );

    res.json({ token, user: mapUserRow(row) });
  });

  app.get('/api/auth/me', requireAuth, (req: AuthenticatedRequest, res) => {
    res.json({ user: req.user });
  });

  app.post('/api/auth/logout', requireAuth, (req: AuthenticatedRequest, res) => {
    if (req.authToken) {
      db.prepare('DELETE FROM sessions WHERE token = ?').run(req.authToken);
      db.prepare('INSERT OR REPLACE INTO revoked_sessions (token, revoked_at) VALUES (?, ?)').run(
        req.authToken,
        new Date().toISOString()
      );
    }
    res.json({ ok: true });
  });

  app.post('/api/auth/change-password', requireAuth, (req: AuthenticatedRequest, res) => {
    const { currentPassword, newPassword } = req.body as { currentPassword?: string; newPassword?: string };
    if (!currentPassword || !newPassword || newPassword.length < 6) {
      res.status(400).json({ error: 'New password must be at least 6 characters' });
      return;
    }
    const row = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user!.id) as Record<string, unknown>;
    if (!verifyPassword(currentPassword, String(row.password_hash))) {
      res.status(400).json({ error: 'Current password is incorrect' });
      return;
    }
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(newPassword), req.user!.id);
    res.json({ ok: true });
  });

  // Overview
  app.get('/api/overview', requireAuth, (req: AuthenticatedRequest, res) => {
    const settings = getSchoolSettingsRow();
    const term = settings.activeTerm;

    if (req.user!.role === 'head_teacher') {
      const sectionsCount = (db.prepare('SELECT COUNT(*) as c FROM sections').get() as { c: number }).c;
      const classesCount = (db.prepare('SELECT COUNT(*) as c FROM classes').get() as { c: number }).c;
      const studentsCount = (db.prepare('SELECT COUNT(*) as c FROM students').get() as { c: number }).c;
      const teachersCount = (
        db.prepare("SELECT COUNT(*) as c FROM users WHERE role = 'teacher'").get() as { c: number }
      ).c;
      const subjectsCount = (db.prepare('SELECT COUNT(*) as c FROM subjects').get() as { c: number }).c;
      const assignmentsCount = (db.prepare('SELECT COUNT(*) as c FROM teacher_assignments').get() as { c: number }).c;

      const classProgress = db
        .prepare(
          `SELECT
            c.id as classId,
            c.name as className,
            s.name_en as sectionNameEn,
            s.name_fr as sectionNameFr,
            (SELECT COUNT(*) FROM students st WHERE st.class_id = c.id) as studentCount,
            (SELECT COUNT(*) FROM subjects sb WHERE sb.class_id = c.id) as subjectCount,
            (SELECT COUNT(DISTINCT m.student_id || ':' || m.subject_id) FROM marks m WHERE m.class_id = c.id AND m.term = ?) as marksCount
           FROM classes c
           JOIN sections s ON s.id = c.section_id
           ORDER BY s.name_en, c.name`
        )
        .all(term);

      res.json({
        counts: {
          sectionsCount,
          classesCount,
          studentsCount,
          teachersCount,
          subjectsCount,
          assignmentsCount,
        },
        classProgress,
        activeTerm: term,
      });
      return;
    }

    const assignedCount = (
      db.prepare('SELECT COUNT(*) as c FROM teacher_assignments WHERE teacher_id = ?').get(req.user!.id) as {
        c: number;
      }
    ).c;

    res.json({
      assignedCount,
      activeTerm: term,
    });
  });

  // Teachers Management (Head Teacher only)
  app.get('/api/teachers', requireAuth, requireHeadTeacher, (_req, res) => {
    const rows = db
      .prepare("SELECT * FROM users WHERE role = 'teacher' ORDER BY full_name ASC")
      .all() as Record<string, unknown>[];
    res.json(rows.map(mapUserRow));
  });

  app.post('/api/teachers', requireAuth, requireHeadTeacher, (req, res) => {
    const { fullName, username, email, password } = req.body as {
      fullName?: string;
      username?: string;
      email?: string;
      password?: string;
    };

    const cleanName = (fullName ?? '').trim();
    const cleanUsername = (username ?? '').trim().toLowerCase();
    const cleanEmail = (email ?? '').trim().toLowerCase();

    if (!cleanName || !cleanUsername || !cleanEmail || !password || password.length < 4) {
      res.status(400).json({ error: 'Full name, username, email, and password (min 4 chars) are required' });
      return;
    }

    const existing = db
      .prepare('SELECT id FROM users WHERE LOWER(username) = ? OR LOWER(email) = ?')
      .get(cleanUsername, cleanEmail);
    if (existing) {
      res.status(409).json({ error: 'A user with that username or email already exists' });
      return;
    }

    const id = makeId('tch');
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO users (id, username, email, full_name, password_hash, role, active, created_at)
       VALUES (?, ?, ?, ?, ?, 'teacher', 1, ?)`
    ).run(id, cleanUsername, cleanEmail, cleanName, hashPassword(password), now);

    const created = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as Record<string, unknown>;
    res.status(201).json(mapUserRow(created));
  });

  app.put('/api/teachers/:id', requireAuth, requireHeadTeacher, (req, res) => {
    const { id } = req.params;
    const { fullName, username, email, password, active } = req.body as {
      fullName?: string;
      username?: string;
      email?: string;
      password?: string;
      active?: boolean;
    };

    const existing = db.prepare("SELECT * FROM users WHERE id = ? AND role = 'teacher'").get(id) as
      | Record<string, unknown>
      | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Teacher not found' });
      return;
    }

    const cleanName = (fullName ?? String(existing.full_name)).trim();
    const cleanUsername = (username ?? String(existing.username)).trim().toLowerCase();
    const cleanEmail = (email ?? String(existing.email)).trim().toLowerCase();

    const duplicate = db
      .prepare('SELECT id FROM users WHERE (LOWER(username) = ? OR LOWER(email) = ?) AND id != ?')
      .get(cleanUsername, cleanEmail, id);
    if (duplicate) {
      res.status(409).json({ error: 'Username or email already in use by another account' });
      return;
    }

    const nextActive = active === undefined ? Number(existing.active) : active ? 1 : 0;
    const nextPasswordHash = password && password.trim().length >= 4 ? hashPassword(password.trim()) : String(existing.password_hash);

    db.prepare(
      'UPDATE users SET full_name = ?, username = ?, email = ?, password_hash = ?, active = ? WHERE id = ?'
    ).run(cleanName, cleanUsername, cleanEmail, nextPasswordHash, nextActive, id);

    if (nextActive === 0) {
      db.prepare('DELETE FROM sessions WHERE user_id = ?').run(id);
    }

    const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as Record<string, unknown>;
    res.json(mapUserRow(updated));
  });

  app.delete('/api/teachers/:id', requireAuth, requireHeadTeacher, (req, res) => {
    const { id } = req.params;
    const result = db.prepare("DELETE FROM users WHERE id = ? AND role = 'teacher'").run(id);
    if (result.changes === 0) {
      res.status(404).json({ error: 'Teacher not found' });
      return;
    }
    res.json({ ok: true });
  });

  // Sections
  app.get('/api/sections', requireAuth, (_req, res) => {
    const rows = db.prepare('SELECT * FROM sections ORDER BY name_en ASC').all() as Record<string, unknown>[];
    const sections: SectionItem[] = rows.map((r) => ({
      id: String(r.id),
      nameEn: String(r.name_en),
      nameFr: String(r.name_fr),
      type: r.type as SectionItem['type'],
      createdAt: String(r.created_at),
    }));
    res.json(sections);
  });

  app.post('/api/sections', requireAuth, requireHeadTeacher, (req, res) => {
    const { nameEn, nameFr, type } = req.body as Partial<SectionItem>;
    if (!nameEn?.trim() || !nameFr?.trim() || !['francophone', 'anglophone', 'general', 'technical'].includes(type ?? '')) {
      res.status(400).json({ error: 'English name, French name, and valid section type are required' });
      return;
    }
    const id = makeId('sec');
    const now = new Date().toISOString();
    db.prepare('INSERT INTO sections (id, name_en, name_fr, type, created_at) VALUES (?, ?, ?, ?, ?)').run(
      id,
      nameEn.trim(),
      nameFr.trim(),
      type!,
      now
    );
    res.status(201).json({ id, nameEn: nameEn.trim(), nameFr: nameFr.trim(), type, createdAt: now });
  });

  app.put('/api/sections/:id', requireAuth, requireHeadTeacher, (req, res) => {
    const { id } = req.params;
    const { nameEn, nameFr, type } = req.body as Partial<SectionItem>;
    const existing = db.prepare('SELECT * FROM sections WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Section not found' });
      return;
    }
    const nextType = type && ['francophone', 'anglophone', 'general', 'technical'].includes(type) ? type : String(existing.type);
    db.prepare('UPDATE sections SET name_en = ?, name_fr = ?, type = ? WHERE id = ?').run(
      (nameEn ?? String(existing.name_en)).trim(),
      (nameFr ?? String(existing.name_fr)).trim(),
      nextType,
      id
    );
    const updated = db.prepare('SELECT * FROM sections WHERE id = ?').get(id) as Record<string, unknown>;
    res.json({
      id: String(updated.id),
      nameEn: String(updated.name_en),
      nameFr: String(updated.name_fr),
      type: updated.type,
      createdAt: String(updated.created_at),
    });
  });

  app.delete('/api/sections/:id', requireAuth, requireHeadTeacher, (req, res) => {
    const result = db.prepare('DELETE FROM sections WHERE id = ?').run(req.params.id);
    if (result.changes === 0) {
      res.status(404).json({ error: 'Section not found' });
      return;
    }
    res.json({ ok: true });
  });

  // Classes
  app.get('/api/classes', requireAuth, (req, res) => {
    const sectionId = req.query.sectionId ? String(req.query.sectionId) : null;
    const rows = (
      sectionId
        ? db.prepare('SELECT * FROM classes WHERE section_id = ? ORDER BY name ASC').all(sectionId)
        : db.prepare('SELECT * FROM classes ORDER BY name ASC').all()
    ) as Record<string, unknown>[];

    const list: ClassItem[] = rows.map((r) => ({
      id: String(r.id),
      sectionId: String(r.section_id),
      name: String(r.name),
      level: String(r.level),
      createdAt: String(r.created_at),
    }));
    res.json(list);
  });

  app.post('/api/classes', requireAuth, requireHeadTeacher, (req, res) => {
    const { sectionId, name, level } = req.body as Partial<ClassItem>;
    if (!sectionId || !name?.trim()) {
      res.status(400).json({ error: 'Section and class name are required' });
      return;
    }
    const secExists = db.prepare('SELECT id FROM sections WHERE id = ?').get(sectionId);
    if (!secExists) {
      res.status(404).json({ error: 'Section not found' });
      return;
    }
    const id = makeId('cls');
    const now = new Date().toISOString();
    db.prepare('INSERT INTO classes (id, section_id, name, level, created_at) VALUES (?, ?, ?, ?, ?)').run(
      id,
      sectionId,
      name.trim(),
      (level ?? '').trim(),
      now
    );
    res.status(201).json({ id, sectionId, name: name.trim(), level: (level ?? '').trim(), createdAt: now });
  });

  app.put('/api/classes/:id', requireAuth, requireHeadTeacher, (req, res) => {
    const { id } = req.params;
    const { sectionId, name, level } = req.body as Partial<ClassItem>;
    const existing = db.prepare('SELECT * FROM classes WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Class not found' });
      return;
    }
    db.prepare('UPDATE classes SET section_id = ?, name = ?, level = ? WHERE id = ?').run(
      sectionId ?? String(existing.section_id),
      (name ?? String(existing.name)).trim(),
      (level ?? String(existing.level)).trim(),
      id
    );
    const updated = db.prepare('SELECT * FROM classes WHERE id = ?').get(id) as Record<string, unknown>;
    res.json({
      id: String(updated.id),
      sectionId: String(updated.section_id),
      name: String(updated.name),
      level: String(updated.level),
      createdAt: String(updated.created_at),
    });
  });

  app.delete('/api/classes/:id', requireAuth, requireHeadTeacher, (req, res) => {
    const result = db.prepare('DELETE FROM classes WHERE id = ?').run(req.params.id);
    if (result.changes === 0) {
      res.status(404).json({ error: 'Class not found' });
      return;
    }
    res.json({ ok: true });
  });

  // Students
  app.get('/api/students', requireAuth, requireHeadTeacher, (req, res) => {
    const classId = req.query.classId ? String(req.query.classId) : null;
    const rows = (
      classId
        ? db.prepare('SELECT * FROM students WHERE class_id = ? ORDER BY full_name ASC').all(classId)
        : db.prepare('SELECT * FROM students ORDER BY full_name ASC').all()
    ) as Record<string, unknown>[];

    const list: StudentItem[] = rows.map((r) => ({
      id: String(r.id),
      classId: String(r.class_id),
      matricule: String(r.matricule),
      fullName: String(r.full_name),
      dateOfBirth: String(r.date_of_birth),
      placeOfBirth: String(r.place_of_birth),
      sex: r.sex as 'M' | 'F',
      repeater: Number(r.repeater) === 1,
      createdAt: String(r.created_at),
    }));
    res.json(list);
  });

  app.post('/api/students', requireAuth, requireHeadTeacher, (req, res) => {
    const { classId, matricule, fullName, dateOfBirth, placeOfBirth, sex, repeater } =
      req.body as Partial<StudentItem>;
    if (!classId || !fullName?.trim() || !dateOfBirth?.trim() || !placeOfBirth?.trim() || !['M', 'F'].includes(sex ?? '')) {
      res.status(400).json({ error: 'All student fields (class, full name, DOB, POB, sex) are required' });
      return;
    }
    const clsExists = db.prepare('SELECT id FROM classes WHERE id = ?').get(classId);
    if (!clsExists) {
      res.status(404).json({ error: 'Class not found' });
      return;
    }
    const id = makeId('stu');
    const now = new Date().toISOString();
    const generatedMatricule =
      matricule?.trim() || `SCH-${new Date().getFullYear().toString().slice(-2)}-${Math.floor(100 + Math.random() * 900)}`;

    db.prepare(
      `INSERT INTO students (id, class_id, matricule, full_name, date_of_birth, place_of_birth, sex, repeater, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      classId,
      generatedMatricule,
      fullName.trim(),
      dateOfBirth.trim(),
      placeOfBirth.trim(),
      sex!,
      repeater ? 1 : 0,
      now
    );

    res.status(201).json({
      id,
      classId,
      matricule: generatedMatricule,
      fullName: fullName.trim(),
      dateOfBirth: dateOfBirth.trim(),
      placeOfBirth: placeOfBirth.trim(),
      sex: sex!,
      repeater: Boolean(repeater),
      createdAt: now,
    });
  });

  app.put('/api/students/:id', requireAuth, requireHeadTeacher, (req, res) => {
    const { id } = req.params;
    const body = req.body as Partial<StudentItem>;
    const existing = db.prepare('SELECT * FROM students WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Student not found' });
      return;
    }

    const nextClassId = body.classId ?? String(existing.class_id);
    const nextRepeater = body.repeater === undefined ? Number(existing.repeater) : body.repeater ? 1 : 0;
    const nextSex = body.sex && ['M', 'F'].includes(body.sex) ? body.sex : String(existing.sex);

    db.prepare(
      `UPDATE students SET
        class_id = ?,
        matricule = ?,
        full_name = ?,
        date_of_birth = ?,
        place_of_birth = ?,
        sex = ?,
        repeater = ?
      WHERE id = ?`
    ).run(
      nextClassId,
      (body.matricule ?? String(existing.matricule)).trim(),
      (body.fullName ?? String(existing.full_name)).trim(),
      (body.dateOfBirth ?? String(existing.date_of_birth)).trim(),
      (body.placeOfBirth ?? String(existing.place_of_birth)).trim(),
      nextSex,
      nextRepeater,
      id
    );

    const updated = db.prepare('SELECT * FROM students WHERE id = ?').get(id) as Record<string, unknown>;
    res.json({
      id: String(updated.id),
      classId: String(updated.class_id),
      matricule: String(updated.matricule),
      fullName: String(updated.full_name),
      dateOfBirth: String(updated.date_of_birth),
      placeOfBirth: String(updated.place_of_birth),
      sex: updated.sex,
      repeater: Number(updated.repeater) === 1,
      createdAt: String(updated.created_at),
    });
  });

  app.delete('/api/students/:id', requireAuth, requireHeadTeacher, (req, res) => {
    const result = db.prepare('DELETE FROM students WHERE id = ?').run(req.params.id);
    if (result.changes === 0) {
      res.status(404).json({ error: 'Student not found' });
      return;
    }
    res.json({ ok: true });
  });

  // Subjects & Coefficients
  app.get('/api/subjects', requireAuth, (req, res) => {
    const classId = req.query.classId ? String(req.query.classId) : null;
    const rows = (
      classId
        ? db.prepare('SELECT * FROM subjects WHERE class_id = ? ORDER BY name_en ASC').all(classId)
        : db.prepare('SELECT * FROM subjects ORDER BY name_en ASC').all()
    ) as Record<string, unknown>[];

    const list: SubjectItem[] = rows.map((r) => ({
      id: String(r.id),
      classId: String(r.class_id),
      nameEn: String(r.name_en),
      nameFr: String(r.name_fr),
      coefficient: Number(r.coefficient),
      code: String(r.code),
      createdAt: String(r.created_at),
    }));
    res.json(list);
  });

  app.post('/api/subjects', requireAuth, requireHeadTeacher, (req, res) => {
    const { classId, nameEn, nameFr, coefficient, code } = req.body as Partial<SubjectItem>;
    const coefNum = Number(coefficient);
    if (!classId || !nameEn?.trim() || !nameFr?.trim() || !Number.isFinite(coefNum) || coefNum <= 0) {
      res.status(400).json({ error: 'Class, English name, French name, and positive coefficient are required' });
      return;
    }
    const clsExists = db.prepare('SELECT id FROM classes WHERE id = ?').get(classId);
    if (!clsExists) {
      res.status(404).json({ error: 'Class not found' });
      return;
    }
    const id = makeId('sub');
    const now = new Date().toISOString();
    const cleanCode = (code ?? nameEn.trim().slice(0, 3)).trim().toUpperCase();
    db.prepare(
      'INSERT INTO subjects (id, class_id, name_en, name_fr, coefficient, code, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(id, classId, nameEn.trim(), nameFr.trim(), coefNum, cleanCode, now);

    res.status(201).json({
      id,
      classId,
      nameEn: nameEn.trim(),
      nameFr: nameFr.trim(),
      coefficient: coefNum,
      code: cleanCode,
      createdAt: now,
    });
  });

  app.put('/api/subjects/:id', requireAuth, requireHeadTeacher, (req, res) => {
    const { id } = req.params;
    const body = req.body as Partial<SubjectItem>;
    const existing = db.prepare('SELECT * FROM subjects WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Subject not found' });
      return;
    }
    const coefNum = body.coefficient !== undefined ? Number(body.coefficient) : Number(existing.coefficient);
    if (!Number.isFinite(coefNum) || coefNum <= 0) {
      res.status(400).json({ error: 'Coefficient must be a positive number' });
      return;
    }

    db.prepare('UPDATE subjects SET name_en = ?, name_fr = ?, coefficient = ?, code = ? WHERE id = ?').run(
      (body.nameEn ?? String(existing.name_en)).trim(),
      (body.nameFr ?? String(existing.name_fr)).trim(),
      coefNum,
      (body.code ?? String(existing.code)).trim().toUpperCase(),
      id
    );

    const updated = db.prepare('SELECT * FROM subjects WHERE id = ?').get(id) as Record<string, unknown>;
    res.json({
      id: String(updated.id),
      classId: String(updated.class_id),
      nameEn: String(updated.name_en),
      nameFr: String(updated.name_fr),
      coefficient: Number(updated.coefficient),
      code: String(updated.code),
      createdAt: String(updated.created_at),
    });
  });

  app.delete('/api/subjects/:id', requireAuth, requireHeadTeacher, (req, res) => {
    const result = db.prepare('DELETE FROM subjects WHERE id = ?').run(req.params.id);
    if (result.changes === 0) {
      res.status(404).json({ error: 'Subject not found' });
      return;
    }
    res.json({ ok: true });
  });

  // Teacher Access Assignments (Head Teacher only for management)
  app.get('/api/assignments', requireAuth, requireHeadTeacher, (_req, res) => {
    const rows = db
      .prepare(
        `SELECT
          a.id, a.teacher_id, a.class_id, a.subject_id, a.created_at,
          u.full_name as teacher_name, u.username as teacher_username,
          c.name as class_name, c.section_id,
          sec.name_en as section_name_en, sec.name_fr as section_name_fr,
          sub.name_en as subject_name_en, sub.name_fr as subject_name_fr, sub.coefficient
         FROM teacher_assignments a
         JOIN users u ON u.id = a.teacher_id
         JOIN classes c ON c.id = a.class_id
         JOIN sections sec ON sec.id = c.section_id
         JOIN subjects sub ON sub.id = a.subject_id
         ORDER BY c.name ASC, sub.name_en ASC`
      )
      .all() as Record<string, unknown>[];

    const list: AssignmentItem[] = rows.map((r) => ({
      id: String(r.id),
      teacherId: String(r.teacher_id),
      teacherName: String(r.teacher_name),
      teacherUsername: String(r.teacher_username),
      classId: String(r.class_id),
      className: String(r.class_name),
      sectionId: String(r.section_id),
      sectionNameEn: String(r.section_name_en),
      sectionNameFr: String(r.section_name_fr),
      subjectId: String(r.subject_id),
      subjectNameEn: String(r.subject_name_en),
      subjectNameFr: String(r.subject_name_fr),
      coefficient: Number(r.coefficient),
      createdAt: String(r.created_at),
    }));
    res.json(list);
  });

  app.post('/api/assignments', requireAuth, requireHeadTeacher, (req, res) => {
    const { teacherId, classId, subjectId } = req.body as {
      teacherId?: string;
      classId?: string;
      subjectId?: string;
    };
    if (!teacherId || !classId || !subjectId) {
      res.status(400).json({ error: 'Teacher, class, and subject are required' });
      return;
    }

    const teacher = db.prepare("SELECT id FROM users WHERE id = ? AND role = 'teacher'").get(teacherId);
    const subject = db.prepare('SELECT id, class_id FROM subjects WHERE id = ?').get(subjectId) as
      | { id: string; class_id: string }
      | undefined;
    if (!teacher || !subject || subject.class_id !== classId) {
      res.status(400).json({ error: 'Invalid teacher, class, or subject combination' });
      return;
    }

    const existing = db
      .prepare('SELECT id FROM teacher_assignments WHERE teacher_id = ? AND class_id = ? AND subject_id = ?')
      .get(teacherId, classId, subjectId);
    if (existing) {
      res.status(409).json({ error: 'This teacher is already assigned to this class and subject' });
      return;
    }

    const id = makeId('asg');
    const now = new Date().toISOString();
    db.prepare(
      'INSERT INTO teacher_assignments (id, teacher_id, class_id, subject_id, created_at) VALUES (?, ?, ?, ?, ?)'
    ).run(id, teacherId, classId, subjectId, now);

    res.status(201).json({ id, teacherId, classId, subjectId, createdAt: now });
  });

  app.put('/api/assignments/:id', requireAuth, requireHeadTeacher, (req, res) => {
    const { id } = req.params;
    const { teacherId, classId, subjectId } = req.body as {
      teacherId?: string;
      classId?: string;
      subjectId?: string;
    };

    const existing = db.prepare('SELECT * FROM teacher_assignments WHERE id = ?').get(id) as
      | Record<string, unknown>
      | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Assignment not found' });
      return;
    }

    const nextTeacherId = teacherId ?? String(existing.teacher_id);
    const nextClassId = classId ?? String(existing.class_id);
    const nextSubjectId = subjectId ?? String(existing.subject_id);

    const teacher = db.prepare("SELECT id FROM users WHERE id = ? AND role = 'teacher'").get(nextTeacherId);
    const subject = db.prepare('SELECT id, class_id FROM subjects WHERE id = ?').get(nextSubjectId) as
      | { id: string; class_id: string }
      | undefined;

    if (!teacher || !subject || subject.class_id !== nextClassId) {
      res.status(400).json({ error: 'Invalid teacher, class, or subject combination' });
      return;
    }

    const duplicate = db
      .prepare('SELECT id FROM teacher_assignments WHERE teacher_id = ? AND class_id = ? AND subject_id = ? AND id != ?')
      .get(nextTeacherId, nextClassId, nextSubjectId, id);
    if (duplicate) {
      res.status(409).json({ error: 'This assignment already exists' });
      return;
    }

    db.prepare('UPDATE teacher_assignments SET teacher_id = ?, class_id = ?, subject_id = ? WHERE id = ?').run(
      nextTeacherId,
      nextClassId,
      nextSubjectId,
      id
    );
    res.json({ id, teacherId: nextTeacherId, classId: nextClassId, subjectId: nextSubjectId });
  });

  app.delete('/api/assignments/:id', requireAuth, requireHeadTeacher, (req, res) => {
    const result = db.prepare('DELETE FROM teacher_assignments WHERE id = ?').run(req.params.id);
    if (result.changes === 0) {
      res.status(404).json({ error: 'Assignment not found' });
      return;
    }
    res.json({ ok: true });
  });

  // Teacher's own scoped assignments
  app.get('/api/teacher/assignments', requireAuth, (req: AuthenticatedRequest, res) => {
    const term = [1, 2, 3].includes(Number(req.query.term))
      ? Number(req.query.term)
      : getSchoolSettingsRow().activeTerm;
    const sequence: SequenceNumber = Number(req.query.sequence) === 2 ? 2 : 1;

    const query =
      req.user!.role === 'head_teacher'
        ? `SELECT
            sub.id as id,
            '' as teacher_id,
            'Head Teacher' as teacher_name,
            '' as teacher_username,
            c.id as class_id,
            c.name as class_name,
            c.section_id,
            sec.name_en as section_name_en,
            sec.name_fr as section_name_fr,
            sub.id as subject_id,
            sub.name_en as subject_name_en,
            sub.name_fr as subject_name_fr,
            sub.coefficient,
            sub.created_at,
            (SELECT COUNT(*) FROM students st WHERE st.class_id = c.id) as student_count,
            (SELECT COUNT(*) FROM marks m WHERE m.class_id = c.id AND m.subject_id = sub.id AND m.term = ? AND m.sequence = ?) as graded_count
           FROM subjects sub
           JOIN classes c ON c.id = sub.class_id
           JOIN sections sec ON sec.id = c.section_id
           ORDER BY c.name ASC, sub.name_en ASC`
        : `SELECT
            a.id, a.teacher_id, a.class_id, a.subject_id, a.created_at,
            u.full_name as teacher_name, u.username as teacher_username,
            c.name as class_name, c.section_id,
            sec.name_en as section_name_en, sec.name_fr as section_name_fr,
            sub.name_en as subject_name_en, sub.name_fr as subject_name_fr, sub.coefficient,
            (SELECT COUNT(*) FROM students st WHERE st.class_id = c.id) as student_count,
            (SELECT COUNT(*) FROM marks m WHERE m.class_id = c.id AND m.subject_id = sub.id AND m.term = ? AND m.sequence = ?) as graded_count
           FROM teacher_assignments a
           JOIN users u ON u.id = a.teacher_id
           JOIN classes c ON c.id = a.class_id
           JOIN sections sec ON sec.id = c.section_id
           JOIN subjects sub ON sub.id = a.subject_id
           WHERE a.teacher_id = ?
           ORDER BY c.name ASC, sub.name_en ASC`;

    const rows = (
      req.user!.role === 'head_teacher'
        ? db.prepare(query).all(term, sequence)
        : db.prepare(query).all(term, sequence, req.user!.id)
    ) as Record<string, unknown>[];

    res.json(
      rows.map((r) => ({
        id: String(r.id),
        teacherId: String(r.teacher_id),
        teacherName: String(r.teacher_name),
        teacherUsername: String(r.teacher_username),
        classId: String(r.class_id),
        className: String(r.class_name),
        sectionId: String(r.section_id),
        sectionNameEn: String(r.section_name_en),
        sectionNameFr: String(r.section_name_fr),
        subjectId: String(r.subject_id),
        subjectNameEn: String(r.subject_name_en),
        subjectNameFr: String(r.subject_name_fr),
        coefficient: Number(r.coefficient),
        createdAt: String(r.created_at),
        studentCount: Number(r.student_count),
        gradedCount: Number(r.graded_count),
      }))
    );
  });

  // Marks read/write with strict teacher authorization and 2 sequences per term
  app.get('/api/marks', requireAuth, (req: AuthenticatedRequest, res) => {
    const classId = String(req.query.classId ?? '');
    const subjectId = String(req.query.subjectId ?? '');
    const term = Number(req.query.term ?? getSchoolSettingsRow().activeTerm);
    const sequence: SequenceNumber = Number(req.query.sequence) === 2 ? 2 : 1;
    const otherSequence: SequenceNumber = sequence === 1 ? 2 : 1;

    if (!classId || !subjectId || ![1, 2, 3].includes(term)) {
      res.status(400).json({ error: 'Valid classId, subjectId, and term (1-3) are required' });
      return;
    }

    if (req.user!.role !== 'head_teacher' && !isTeacherAssigned(req.user!.id, classId, subjectId)) {
      res.status(403).json({ error: 'Access denied: you are not assigned to this class and subject' });
      return;
    }

    const rows = db
      .prepare(
        `SELECT
          st.id as student_id,
          st.matricule,
          st.full_name,
          st.sex,
          st.repeater,
          m.score,
          m.remark,
          m.updated_at,
          u.full_name as updated_by_name,
          m2.score as other_score
         FROM students st
         LEFT JOIN marks m
           ON m.student_id = st.id AND m.subject_id = ? AND m.term = ? AND m.sequence = ?
         LEFT JOIN users u
           ON u.id = m.updated_by
         LEFT JOIN marks m2
           ON m2.student_id = st.id AND m2.subject_id = ? AND m2.term = ? AND m2.sequence = ?
         WHERE st.class_id = ?
         ORDER BY st.full_name ASC`
      )
      .all(subjectId, term, sequence, subjectId, term, otherSequence, classId) as Record<string, unknown>[];

    const list: MarkRow[] = rows.map((r) => {
      const score = r.score === null || r.score === undefined ? null : Number(r.score);
      const otherScore = r.other_score === null || r.other_score === undefined ? null : Number(r.other_score);
      let termAverage: number | null = null;
      if (score !== null && otherScore !== null) {
        termAverage = Math.round(((score + otherScore) / 2) * 100) / 100;
      } else if (score !== null) {
        termAverage = score;
      } else if (otherScore !== null) {
        termAverage = otherScore;
      }

      return {
        studentId: String(r.student_id),
        matricule: String(r.matricule),
        fullName: String(r.full_name),
        sex: r.sex as 'M' | 'F',
        repeater: Number(r.repeater) === 1,
        score,
        otherSequenceScore: otherScore,
        termAverage,
        remark: r.remark ? String(r.remark) : '',
        updatedByName: r.updated_by_name ? String(r.updated_by_name) : null,
        updatedAt: r.updated_at ? String(r.updated_at) : null,
      };
    });

    res.json(list);
  });

  app.put('/api/marks', requireAuth, (req: AuthenticatedRequest, res) => {
    const { classId, subjectId, term, sequence, entries } = req.body as {
      classId?: string;
      subjectId?: string;
      term?: number;
      sequence?: number;
      entries?: Array<{ studentId: string; score: number | null; remark?: string }>;
    };

    const seqNum: SequenceNumber = Number(sequence) === 2 ? 2 : 1;

    if (!classId || !subjectId || ![1, 2, 3].includes(Number(term)) || !Array.isArray(entries)) {
      res.status(400).json({ error: 'classId, subjectId, term (1-3), and entries array are required' });
      return;
    }

    if (req.user!.role !== 'head_teacher' && !isTeacherAssigned(req.user!.id, classId, subjectId)) {
      res.status(403).json({ error: 'Access denied: you are not assigned to this class and subject' });
      return;
    }

    const subjectRow = db.prepare('SELECT id, class_id FROM subjects WHERE id = ?').get(subjectId) as
      | { id: string; class_id: string }
      | undefined;
    if (!subjectRow || subjectRow.class_id !== classId) {
      res.status(400).json({ error: 'Subject does not belong to the specified class' });
      return;
    }

    const now = new Date().toISOString();
    const deleteStmt = db.prepare(
      'DELETE FROM marks WHERE student_id = ? AND subject_id = ? AND term = ? AND sequence = ?'
    );
    const upsertStmt = db.prepare(
      `INSERT INTO marks (id, student_id, subject_id, class_id, term, sequence, score, remark, updated_by, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (student_id, subject_id, term, sequence) DO UPDATE SET
         score = excluded.score,
         remark = excluded.remark,
         updated_by = excluded.updated_by,
         updated_at = excluded.updated_at`
    );

    db.exec('BEGIN');
    try {
      for (const entry of entries) {
        const studentRow = db
          .prepare('SELECT id FROM students WHERE id = ? AND class_id = ?')
          .get(entry.studentId, classId);
        if (!studentRow) continue;

        if (entry.score === null || entry.score === undefined || Number.isNaN(Number(entry.score))) {
          deleteStmt.run(entry.studentId, subjectId, Number(term), seqNum);
          continue;
        }

        const numScore = Math.round(Number(entry.score) * 100) / 100;
        if (numScore < 0 || numScore > 20) {
          throw new Error('Marks must be between 0 and 20');
        }

        upsertStmt.run(
          makeId('mrk'),
          entry.studentId,
          subjectId,
          classId,
          Number(term),
          seqNum,
          numScore,
          (entry.remark ?? '').trim(),
          req.user!.id,
          now
        );
      }
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to save marks' });
      return;
    }

    res.json({ ok: true, updatedAt: now });
  });

  // Student Discipline & Attendance (Head Teacher only)
  app.get('/api/discipline', requireAuth, requireHeadTeacher, (req, res) => {
    const classId = String(req.query.classId ?? '');
    const term = Number(req.query.term ?? getSchoolSettingsRow().activeTerm);
    const sequence: SequenceNumber = Number(req.query.sequence) === 2 ? 2 : 1;

    if (!classId || ![1, 2, 3].includes(term)) {
      res.status(400).json({ error: 'Valid classId and term (1-3) are required' });
      return;
    }

    const rows = db
      .prepare(
        `SELECT
          st.id as student_id,
          st.matricule,
          st.full_name,
          st.sex,
          COALESCE(d.justified_absences, 0) as justified_absences,
          COALESCE(d.unjustified_absences, 0) as unjustified_absences,
          COALESCE(d.late_comings, 0) as late_comings,
          COALESCE(d.sanction, '') as sanction,
          d.updated_at
         FROM students st
         LEFT JOIN student_discipline d
           ON d.student_id = st.id AND d.term = ? AND d.sequence = ?
         WHERE st.class_id = ?
         ORDER BY st.full_name ASC`
      )
      .all(term, sequence, classId) as Record<string, unknown>[];

    const list: DisciplineRow[] = rows.map((r) => ({
      studentId: String(r.student_id),
      matricule: String(r.matricule),
      fullName: String(r.full_name),
      sex: r.sex as 'M' | 'F',
      justifiedAbsences: Number(r.justified_absences ?? 0),
      unjustifiedAbsences: Number(r.unjustified_absences ?? 0),
      lateComings: Number(r.late_comings ?? 0),
      sanction: String(r.sanction ?? ''),
      updatedAt: r.updated_at ? String(r.updated_at) : null,
    }));

    res.json(list);
  });

  app.put('/api/discipline', requireAuth, requireHeadTeacher, (req: AuthenticatedRequest, res) => {
    const { classId, term, sequence, entries } = req.body as {
      classId?: string;
      term?: number;
      sequence?: number;
      entries?: Array<{
        studentId: string;
        justifiedAbsences: number;
        unjustifiedAbsences: number;
        lateComings: number;
        sanction?: string;
      }>;
    };

    const seqNum: SequenceNumber = Number(sequence) === 2 ? 2 : 1;
    if (!classId || ![1, 2, 3].includes(Number(term)) || !Array.isArray(entries)) {
      res.status(400).json({ error: 'classId, term (1-3), and entries array are required' });
      return;
    }

    const now = new Date().toISOString();
    const upsertStmt = db.prepare(
      `INSERT INTO student_discipline (
         id, student_id, class_id, term, sequence,
         justified_absences, unjustified_absences, late_comings, sanction, updated_by, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (student_id, term, sequence) DO UPDATE SET
         justified_absences = excluded.justified_absences,
         unjustified_absences = excluded.unjustified_absences,
         late_comings = excluded.late_comings,
         sanction = excluded.sanction,
         updated_by = excluded.updated_by,
         updated_at = excluded.updated_at`
    );

    db.exec('BEGIN');
    try {
      for (const entry of entries) {
        const studentRow = db
          .prepare('SELECT id FROM students WHERE id = ? AND class_id = ?')
          .get(entry.studentId, classId);
        if (!studentRow) continue;

        const just = Math.max(0, Math.round(Number(entry.justifiedAbsences) || 0));
        const unjust = Math.max(0, Math.round(Number(entry.unjustifiedAbsences) || 0));
        const late = Math.max(0, Math.round(Number(entry.lateComings) || 0));
        const sanction = (entry.sanction ?? '').trim();

        upsertStmt.run(
          makeId('dsc'),
          entry.studentId,
          classId,
          Number(term),
          seqNum,
          just,
          unjust,
          late,
          sanction,
          req.user!.id,
          now
        );
      }
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to save discipline records' });
      return;
    }

    res.json({ ok: true, updatedAt: now });
  });

  // Report Cards Bundle for an entire class (per Sequence or Whole Term)
  app.get('/api/report-cards/:classId', requireAuth, (req: AuthenticatedRequest, res) => {
    const { classId } = req.params;
    if (req.user?.role === 'teacher') {
      const assigned = db
        .prepare('SELECT 1 FROM teacher_assignments WHERE teacher_id = ? AND class_id = ? LIMIT 1')
        .get(req.user.id, classId);
      if (!assigned) {
        res.status(403).json({ error: 'You are not assigned to this class' });
        return;
      }
    }
    const term = [1, 2, 3].includes(Number(req.query.term))
      ? (Number(req.query.term) as 1 | 2 | 3)
      : getSchoolSettingsRow().activeTerm;
    const rawPeriod = String(req.query.period ?? 'term');
    const period: ReportPeriod = rawPeriod === 'seq1' || rawPeriod === 'seq2' ? rawPeriod : 'term';

    const classRow = db.prepare('SELECT * FROM classes WHERE id = ?').get(classId) as
      | Record<string, unknown>
      | undefined;
    if (!classRow) {
      res.status(404).json({ error: 'Class not found' });
      return;
    }

    const sectionRow = db.prepare('SELECT * FROM sections WHERE id = ?').get(String(classRow.section_id)) as Record<
      string,
      unknown
    >;

    const school = getSchoolSettingsRow();
    const classItem: ClassItem = {
      id: String(classRow.id),
      sectionId: String(classRow.section_id),
      name: String(classRow.name),
      level: String(classRow.level),
      createdAt: String(classRow.created_at),
    };
    const section: SectionItem = {
      id: String(sectionRow.id),
      nameEn: String(sectionRow.name_en),
      nameFr: String(sectionRow.name_fr),
      type: sectionRow.type as SectionItem['type'],
      createdAt: String(sectionRow.created_at),
    };

    const studentRows = db
      .prepare('SELECT * FROM students WHERE class_id = ? ORDER BY full_name ASC')
      .all(classId) as Record<string, unknown>[];
    const students: StudentItem[] = studentRows.map((r) => ({
      id: String(r.id),
      classId: String(r.class_id),
      matricule: String(r.matricule),
      fullName: String(r.full_name),
      dateOfBirth: String(r.date_of_birth),
      placeOfBirth: String(r.place_of_birth),
      sex: r.sex as 'M' | 'F',
      repeater: Number(r.repeater) === 1,
      createdAt: String(r.created_at),
    }));

    const subjectRows = db
      .prepare('SELECT * FROM subjects WHERE class_id = ? ORDER BY name_en ASC')
      .all(classId) as Record<string, unknown>[];
    const subjects: SubjectItem[] = subjectRows.map((r) => ({
      id: String(r.id),
      classId: String(r.class_id),
      nameEn: String(r.name_en),
      nameFr: String(r.name_fr),
      coefficient: Number(r.coefficient),
      code: String(r.code),
      createdAt: String(r.created_at),
    }));

    const assignmentRows = db
      .prepare(
        `SELECT a.subject_id, u.full_name
         FROM teacher_assignments a
         JOIN users u ON u.id = a.teacher_id
         WHERE a.class_id = ?`
      )
      .all(classId) as Array<{ subject_id: string; full_name: string }>;

    const assignedTeacherBySubject = new Map<string, string[]>();
    for (const row of assignmentRows) {
      const arr = assignedTeacherBySubject.get(row.subject_id) ?? [];
      arr.push(row.full_name);
      assignedTeacherBySubject.set(row.subject_id, arr);
    }

    // Fetch marks joined with the teacher who actually entered them
    const markRows = db
      .prepare(
        `SELECT m.student_id, m.subject_id, m.sequence, m.score, m.remark, u.full_name as entered_by_name
         FROM marks m
         LEFT JOIN users u ON u.id = m.updated_by
         WHERE m.class_id = ? AND m.term = ?`
      )
      .all(classId, term) as Array<{
        student_id: string;
        subject_id: string;
        sequence: number;
        score: number;
        remark: string;
        entered_by_name: string | null;
      }>;

    // Organize marks by student:subject -> seq1 & seq2
    interface SeqPair {
      seq1: number | null;
      seq2: number | null;
      remark1: string;
      remark2: string;
      teacher1: string | null;
      teacher2: string | null;
    }
    const pairMap = new Map<string, SeqPair>();
    const subjectEnterers = new Map<string, Set<string>>();

    for (const m of markRows) {
      const key = `${m.student_id}:${m.subject_id}`;
      const pair = pairMap.get(key) ?? {
        seq1: null,
        seq2: null,
        remark1: '',
        remark2: '',
        teacher1: null,
        teacher2: null,
      };
      if (Number(m.sequence) === 2) {
        pair.seq2 = Number(m.score);
        pair.remark2 = m.remark || '';
        pair.teacher2 = m.entered_by_name;
      } else {
        pair.seq1 = Number(m.score);
        pair.remark1 = m.remark || '';
        pair.teacher1 = m.entered_by_name;
      }
      pairMap.set(key, pair);

      if (m.entered_by_name) {
        const set = subjectEnterers.get(m.subject_id) ?? new Set<string>();
        set.add(m.entered_by_name);
        subjectEnterers.set(m.subject_id, set);
      }
    }

    // Effective score per student & subject for selected period + collect per-subject score distribution
    const effectiveScoreMap = new Map<string, { score: number | null; remark: string; teacher: string }>();
    const subjectScoresList = new Map<string, number[]>();

    for (const student of students) {
      for (const sub of subjects) {
        const key = `${student.id}:${sub.id}`;
        const pair = pairMap.get(key);
        const s1 = pair?.seq1 ?? null;
        const s2 = pair?.seq2 ?? null;

        let effective: number | null = null;
        let remark = '';
        let enteredBy = '';

        if (period === 'seq1') {
          effective = s1;
          remark = pair?.remark1 ?? '';
          enteredBy = pair?.teacher1 ?? '';
        } else if (period === 'seq2') {
          effective = s2;
          remark = pair?.remark2 ?? '';
          enteredBy = pair?.teacher2 ?? '';
        } else {
          if (s1 !== null && s2 !== null) {
            effective = Math.round(((s1 + s2) / 2) * 100) / 100;
          } else if (s1 !== null) {
            effective = s1;
          } else if (s2 !== null) {
            effective = s2;
          }
          remark = pair?.remark2 || pair?.remark1 || '';
          enteredBy = pair?.teacher2 || pair?.teacher1 || '';
        }

        if (!enteredBy) {
          const fromSub = Array.from(subjectEnterers.get(sub.id) ?? []);
          enteredBy = fromSub[0] || (assignedTeacherBySubject.get(sub.id) ?? []).join(', ');
        }

        effectiveScoreMap.set(key, { score: effective, remark, teacher: enteredBy });
        if (effective !== null) {
          const arr = subjectScoresList.get(sub.id) ?? [];
          arr.push(effective);
          subjectScoresList.set(sub.id, arr);
        }
      }
    }

    // Sort scores descending per subject to compute avg, highest, lowest, and student rank
    const subjectStatsMap = new Map<
      string,
      { avg: number | null; highest: number | null; lowest: number | null; sortedDesc: number[] }
    >();
    for (const sub of subjects) {
      const scores = [...(subjectScoresList.get(sub.id) ?? [])].sort((a, b) => b - a);
      const avg =
        scores.length > 0
          ? Math.round((scores.reduce((acc, v) => acc + v, 0) / scores.length) * 100) / 100
          : null;
      subjectStatsMap.set(sub.id, {
        avg,
        highest: scores.length > 0 ? scores[0] : null,
        lowest: scores.length > 0 ? scores[scores.length - 1] : null,
        sortedDesc: scores,
      });
    }

    // Fetch discipline records for (classId, term)
    const discRows = db
      .prepare(
        `SELECT student_id, sequence, justified_absences, unjustified_absences, late_comings, sanction
         FROM student_discipline
         WHERE class_id = ? AND term = ?`
      )
      .all(classId, term) as Array<{
        student_id: string;
        sequence: number;
        justified_absences: number;
        unjustified_absences: number;
        late_comings: number;
        sanction: string;
      }>;

    const discByStudent = new Map<
      string,
      {
        s1?: { just: number; unjust: number; late: number; sanction: string };
        s2?: { just: number; unjust: number; late: number; sanction: string };
      }
    >();
    for (const d of discRows) {
      const entry = discByStudent.get(d.student_id) ?? {};
      const val = {
        just: Number(d.justified_absences),
        unjust: Number(d.unjustified_absences),
        late: Number(d.late_comings),
        sanction: String(d.sanction || ''),
      };
      if (Number(d.sequence) === 2) entry.s2 = val;
      else entry.s1 = val;
      discByStudent.set(d.student_id, entry);
    }

    const totalCoefficients = subjects.reduce((acc, s) => acc + s.coefficient, 0);

    const rawCards: StudentReportCard[] = students.map((student) => {
      let totalGradedCoefficients = 0;
      let totalWeightedScore = 0;

      const subjectLines: ReportCardSubjectLine[] = subjects.map((sub) => {
        const key = `${student.id}:${sub.id}`;
        const pair = pairMap.get(key);
        const eff = effectiveScoreMap.get(key);
        const score = eff?.score ?? null;
        const weightedScore = score !== null ? Math.round(score * sub.coefficient * 100) / 100 : null;
        if (score !== null && weightedScore !== null) {
          totalGradedCoefficients += sub.coefficient;
          totalWeightedScore += weightedScore;
        }

        const st = subjectStatsMap.get(sub.id);
        const subjectRank =
          score !== null && st ? st.sortedDesc.findIndex((val) => val === score) + 1 : null;

        return {
          subjectId: sub.id,
          code: sub.code,
          nameEn: sub.nameEn,
          nameFr: sub.nameFr,
          coefficient: sub.coefficient,
          seq1Score: pair?.seq1 ?? null,
          seq2Score: pair?.seq2 ?? null,
          score,
          weightedScore,
          remark: eff?.remark ?? '',
          teacherName: eff?.teacher || (assignedTeacherBySubject.get(sub.id) ?? []).join(', '),
          classSubjectAverage: st?.avg ?? null,
          subjectHighest: st?.highest ?? null,
          subjectLowest: st?.lowest ?? null,
          subjectRank,
          subjectGradedCount: st?.sortedDesc.length ?? 0,
        };
      });

      const average =
        totalGradedCoefficients > 0
          ? Math.round((totalWeightedScore / totalGradedCoefficients) * 100) / 100
          : null;

      // Aggregate discipline according to selected period
      const dRec = discByStudent.get(student.id);
      let discipline: StudentDisciplineSummary;
      if (period === 'seq1') {
        discipline = {
          justifiedAbsences: dRec?.s1?.just ?? 0,
          unjustifiedAbsences: dRec?.s1?.unjust ?? 0,
          lateComings: dRec?.s1?.late ?? 0,
          sanction: dRec?.s1?.sanction ?? '',
        };
      } else if (period === 'seq2') {
        discipline = {
          justifiedAbsences: dRec?.s2?.just ?? 0,
          unjustifiedAbsences: dRec?.s2?.unjust ?? 0,
          lateComings: dRec?.s2?.late ?? 0,
          sanction: dRec?.s2?.sanction ?? '',
        };
      } else {
        const sanctions = [dRec?.s1?.sanction, dRec?.s2?.sanction].filter(
          (v): v is string => Boolean(v && v.trim())
        );
        const uniqueSanctions = Array.from(new Set(sanctions));
        discipline = {
          justifiedAbsences: (dRec?.s1?.just ?? 0) + (dRec?.s2?.just ?? 0),
          unjustifiedAbsences: (dRec?.s1?.unjust ?? 0) + (dRec?.s2?.unjust ?? 0),
          lateComings: (dRec?.s1?.late ?? 0) + (dRec?.s2?.late ?? 0),
          sanction: uniqueSanctions.join(' · '),
        };
      }

      return {
        student,
        classItem,
        section,
        term,
        period,
        subjects: subjectLines,
        totalCoefficients,
        totalGradedCoefficients,
        totalWeightedScore: Math.round(totalWeightedScore * 100) / 100,
        average,
        honourRoll: average !== null && average >= 12,
        rank: null,
        totalStudents: students.length,
        classAverage: null,
        highestAverage: null,
        lowestAverage: null,
        discipline,
      };
    });

    const gradedAverages = rawCards
      .map((c) => c.average)
      .filter((avg): avg is number => avg !== null)
      .sort((a, b) => b - a);

    const classAverage =
      gradedAverages.length > 0
        ? Math.round((gradedAverages.reduce((a, b) => a + b, 0) / gradedAverages.length) * 100) / 100
        : null;
    const highestAverage = gradedAverages.length > 0 ? gradedAverages[0] : null;
    const lowestAverage = gradedAverages.length > 0 ? gradedAverages[gradedAverages.length - 1] : null;
    const passCount = gradedAverages.filter((a) => a >= 10).length;
    const honorRollCount = gradedAverages.filter((a) => a >= 12).length;
    const passRate =
      gradedAverages.length > 0 ? Math.round((passCount / gradedAverages.length) * 1000) / 10 : null;

    // Assign competition ranking (1, 1, 3...)
    const cards: StudentReportCard[] = rawCards.map((card) => {
      const rank =
        card.average !== null ? gradedAverages.findIndex((avg) => avg === card.average) + 1 : null;
      return {
        ...card,
        rank,
        classAverage,
        highestAverage,
        lowestAverage,
      };
    });

    const bundle: ClassReportBundle = {
      school,
      section,
      classItem,
      term,
      period,
      cards,
      summary: {
        studentCount: students.length,
        subjectCount: subjects.length,
        classAverage,
        highestAverage,
        lowestAverage,
        passCount,
        passRate,
        honorRollCount,
      },
    };

    res.json(bundle);
  });

  // Vite / Static serving
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    if (fs.existsSync(distPath)) {
      app.use(
        express.static(distPath, {
          index: false,
          maxAge: '1y',
          immutable: true,
        })
      );
      app.get('*', (req, res) => {
        if (req.path.startsWith('/api/')) {
          res.status(404).json({ error: 'API endpoint not found' });
          return;
        }
        if (req.path.startsWith('/assets/')) {
          res.status(404).end();
          return;
        }
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.sendFile(path.join(distPath, 'index.html'));
      });
    } else {
      app.get('*', (req, res) => {
        if (req.path.startsWith('/api/')) {
          res.status(404).json({ error: 'API endpoint not found' });
          return;
        }
        res
          .status(503)
          .send('Application build missing. Run "npm run build" before starting in production.');
      });
    }
  }

  // Global Express JSON / route error handler
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const status =
      typeof err === 'object' && err !== null && 'status' in err && typeof err.status === 'number'
        ? err.status
        : 500;
    const message = err instanceof Error ? err.message : 'Internal server error';
    res.status(status).json({ error: message });
  });

  const port = Number(process.env.PORT || 3000);
  const host = process.env.HOST || '0.0.0.0';
  const server = app.listen(port, host, () => {
    console.log(`GBHS Douala server listening on http://${host}:${port}`);
  });

  let shuttingDown = false;
  const shutdown = () => {
    if (shuttingDown) return;
    shuttingDown = true;
    const forceTimer = setTimeout(() => {
      process.exit(0);
    }, 8000);
    forceTimer.unref();

    server.close(() => {
      try {
        db.exec('PRAGMA wal_checkpoint(TRUNCATE);');
      } catch {
        // ignore checkpoint errors on exit
      }
      try {
        db.close();
      } catch {
        // ignore already closed
      }
      process.exit(0);
    });
    server.closeIdleConnections?.();
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

startServer();
