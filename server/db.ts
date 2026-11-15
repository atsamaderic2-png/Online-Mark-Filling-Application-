import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.resolve(process.cwd(), 'data');
const DB_PATH = process.env.DB_PATH
  ? path.resolve(process.env.DB_PATH)
  : path.join(DATA_DIR, 'scholaris.db');

const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

export const db = new DatabaseSync(DB_PATH);

db.exec('PRAGMA foreign_keys = ON;');
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA busy_timeout = 5000;');

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, keyHex] = parts;
  const derived = crypto.scryptSync(password, salt, 64);
  const keyBuf = Buffer.from(keyHex, 'hex');
  if (derived.length !== keyBuf.length) return false;
  return crypto.timingSafeEqual(derived, keyBuf);
}

export function makeId(prefix: string): string {
  return `${prefix}_${crypto.randomBytes(6).toString('hex')}`;
}

export function initDatabase(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      full_name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('head_teacher', 'teacher')),
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS school_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      name_en TEXT NOT NULL,
      name_fr TEXT NOT NULL,
      republic_en TEXT NOT NULL,
      republic_fr TEXT NOT NULL,
      motto_republic_en TEXT NOT NULL,
      motto_republic_fr TEXT NOT NULL,
      ministry_en TEXT NOT NULL,
      ministry_fr TEXT NOT NULL,
      school_motto TEXT NOT NULL,
      city TEXT NOT NULL,
      academic_year TEXT NOT NULL,
      active_term INTEGER NOT NULL DEFAULT 1,
      head_teacher_name TEXT NOT NULL,
      logo_data_url TEXT
    );

    CREATE TABLE IF NOT EXISTS sections (
      id TEXT PRIMARY KEY,
      name_en TEXT NOT NULL,
      name_fr TEXT NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('francophone', 'anglophone', 'general', 'technical')),
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS classes (
      id TEXT PRIMARY KEY,
      section_id TEXT NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      level TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS students (
      id TEXT PRIMARY KEY,
      class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
      matricule TEXT NOT NULL,
      full_name TEXT NOT NULL,
      date_of_birth TEXT NOT NULL,
      place_of_birth TEXT NOT NULL,
      sex TEXT NOT NULL CHECK (sex IN ('M', 'F')),
      repeater INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS subjects (
      id TEXT PRIMARY KEY,
      class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
      name_en TEXT NOT NULL,
      name_fr TEXT NOT NULL,
      coefficient REAL NOT NULL DEFAULT 1,
      code TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS teacher_assignments (
      id TEXT PRIMARY KEY,
      teacher_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
      subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL,
      UNIQUE (teacher_id, class_id, subject_id)
    );

    CREATE TABLE IF NOT EXISTS marks (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
      class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
      term INTEGER NOT NULL CHECK (term IN (1, 2, 3)),
      sequence INTEGER NOT NULL DEFAULT 1 CHECK (sequence IN (1, 2)),
      score REAL NOT NULL CHECK (score >= 0 AND score <= 20),
      remark TEXT NOT NULL DEFAULT '',
      updated_by TEXT REFERENCES users(id) ON DELETE SET NULL,
      updated_at TEXT NOT NULL,
      UNIQUE (student_id, subject_id, term, sequence)
    );

    CREATE TABLE IF NOT EXISTS student_discipline (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
      term INTEGER NOT NULL CHECK (term IN (1, 2, 3)),
      sequence INTEGER NOT NULL DEFAULT 1 CHECK (sequence IN (1, 2)),
      justified_absences INTEGER NOT NULL DEFAULT 0 CHECK (justified_absences >= 0),
      unjustified_absences INTEGER NOT NULL DEFAULT 0 CHECK (unjustified_absences >= 0),
      late_comings INTEGER NOT NULL DEFAULT 0 CHECK (late_comings >= 0),
      sanction TEXT NOT NULL DEFAULT '',
      updated_by TEXT REFERENCES users(id) ON DELETE SET NULL,
      updated_at TEXT NOT NULL,
      UNIQUE (student_id, term, sequence)
    );
  `);

  // Safe migration if existing marks table lacked the sequence column
  const markCols = db.prepare('PRAGMA table_info(marks)').all() as Array<{ name: string }>;
  if (!markCols.some((c) => c.name === 'sequence')) {
    db.exec(`
      PRAGMA foreign_keys = OFF;
      BEGIN;
      CREATE TABLE marks_v2 (
        id TEXT PRIMARY KEY,
        student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
        class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
        term INTEGER NOT NULL CHECK (term IN (1, 2, 3)),
        sequence INTEGER NOT NULL DEFAULT 1 CHECK (sequence IN (1, 2)),
        score REAL NOT NULL CHECK (score >= 0 AND score <= 20),
        remark TEXT NOT NULL DEFAULT '',
        updated_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        updated_at TEXT NOT NULL,
        UNIQUE (student_id, subject_id, term, sequence)
      );
      INSERT INTO marks_v2 (id, student_id, subject_id, class_id, term, sequence, score, remark, updated_by, updated_at)
      SELECT id, student_id, subject_id, class_id, term, 1, score, remark, updated_by, updated_at FROM marks;
      DROP TABLE marks;
      ALTER TABLE marks_v2 RENAME TO marks;
      COMMIT;
      PRAGMA foreign_keys = ON;
    `);
  }

  const userCountRow = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
  if (userCountRow.count === 0) {
    seedInitialData();
  } else {
    db.prepare(
      `UPDATE school_settings
       SET name_en = CASE
             WHEN name_en IN ('GBHS Jules', 'Scholaris', 'Lycée Bilingue de Douala') THEN 'GBHS Douala'
             ELSE name_en
           END,
           name_fr = CASE
             WHEN name_fr IN ('GBHS Jules', 'Scholaris', 'Lycée Bilingue de Douala') THEN 'GBHS Douala'
             ELSE name_fr
           END,
           school_motto = CASE WHEN school_motto = 'Ad Majorem Dei Gloriam' THEN '' ELSE school_motto END,
           city = CASE WHEN city = 'Yaoundé' THEN 'Douala' ELSE city END,
           academic_year = CASE
             WHEN academic_year IN ('2025 / 2026', '2025 - 2026', '2025-2026', '2025/2026') THEN '2026 - 2027'
             ELSE academic_year
           END
       WHERE id = 1`
    ).run();
    ensureExpandedSeedData();
  }
}

function seedInitialData(): void {
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO school_settings (
      id, name_en, name_fr, republic_en, republic_fr,
      motto_republic_en, motto_republic_fr, ministry_en, ministry_fr,
      school_motto, city, academic_year, active_term, head_teacher_name, logo_data_url
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    1,
    'GBHS Douala',
    'GBHS Douala',
    'REPUBLIC OF CAMEROON',
    'RÉPUBLIQUE DU CAMEROUN',
    'Peace - Work - Fatherland',
    'Paix - Travail - Patrie',
    'MINISTRY OF SECONDARY EDUCATION',
    'MINISTÈRE DES ENSEIGNEMENTS SECONDAIRES',
    '',
    'Douala',
    '2026 - 2027',
    1,
    'Dr. Emmanuel Ndi',
    null
  );

  // Head Teacher & core teachers
  const headId = 'usr_head_01';
  const teacher1Id = 'usr_teach_01';
  const teacher2Id = 'usr_teach_02';

  const insertUser = db.prepare(`
    INSERT INTO users (id, username, email, full_name, password_hash, role, active, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 1, ?)
  `);

  insertUser.run(headId, 'headteacher', 'headteacher@school.edu', 'Dr. Emmanuel Ndi', hashPassword('admin1234'), 'head_teacher', now);
  insertUser.run(teacher1Id, 'm.mbarga', 'mbarga@school.edu', 'Jean-Paul Mbarga', hashPassword('teacher123'), 'teacher', now);
  insertUser.run(teacher2Id, 'c.fomba', 'fomba@school.edu', 'Clarisse Fomba', hashPassword('teacher123'), 'teacher', now);

  // Sections (Francophone, Anglophone, General, Technical)
  const secAnglo = 'sec_anglo';
  const secFranco = 'sec_franco';
  const secGeneral = 'sec_general';
  const secTech = 'sec_tech';

  const insertSection = db.prepare(`
    INSERT INTO sections (id, name_en, name_fr, type, created_at)
    VALUES (?, ?, ?, ?, ?)
  `);

  insertSection.run(secAnglo, 'Anglophone Section', 'Section Anglophone', 'anglophone', now);
  insertSection.run(secFranco, 'Francophone Section', 'Section Francophone', 'francophone', now);
  insertSection.run(secGeneral, 'General Education', 'Enseignement Général', 'general', now);
  insertSection.run(secTech, 'Technical Education', 'Enseignement Technique', 'technical', now);

  ensureExpandedSeedData();
}

function remarkForScore(score: number): string {
  if (score >= 16) return 'Very Good / Très Bien';
  if (score >= 14) return 'Good / Bien';
  if (score >= 12) return 'Fair / Assez Bien';
  if (score >= 10) return 'Average / Passable';
  return 'Weak / Insuffisant';
}

function ensureExpandedSeedData(): void {
  const now = new Date().toISOString();
  const headId = 'usr_head_01';
  const teacher1Id = 'usr_teach_01';
  const teacher2Id = 'usr_teach_02';
  const teacher3Id = 'usr_teach_03';
  const teacher4Id = 'usr_teach_04';
  const teacher5Id = 'usr_teach_05';
  const teacher6Id = 'usr_teach_06';
  const teacher7Id = 'usr_teach_07';
  const teacher8Id = 'usr_teach_08';

  const secAnglo = 'sec_anglo';
  const secFranco = 'sec_franco';
  const secGeneral = 'sec_general';
  const secTech = 'sec_tech';

  const clsForm3 = 'cls_form3a';
  const clsForm5s = 'cls_form5s';
  const clsLowerSixth = 'cls_lowersixth';
  const cls3eme = 'cls_3emea';
  const clsTleC = 'cls_tlec';
  const cls2ndeA4 = 'cls_2ndea4';
  const clsTech1 = 'cls_1eref3';
  const cls1ereCG = 'cls_1erecg';

  // Ensure all 8 subject teachers exist
  const insertTeacher = db.prepare(`
    INSERT OR IGNORE INTO users (id, username, email, full_name, password_hash, role, active, created_at)
    VALUES (?, ?, ?, ?, ?, 'teacher', 1, ?)
  `);

  const extraTeachers: Array<[string, string, string, string]> = [
    [teacher3Id, 'p.tchouankam', 'tchouankam@school.edu', 'Patrick Tchouankam'],
    [teacher4Id, 'b.ndam', 'ndam@school.edu', 'Bernice Ndam'],
    [teacher5Id, 's.ekane', 'ekane@school.edu', 'Samuel Ekane'],
    [teacher6Id, 'a.kouam', 'kouam@school.edu', 'Aurélie Kouam'],
    [teacher7Id, 'f.tabi', 'tabi@school.edu', 'Francis Tabi'],
    [teacher8Id, 'm.nana', 'nana@school.edu', 'Mireille Nana'],
  ];
  for (const t of extraTeachers) {
    insertTeacher.run(t[0], t[1], t[2], t[3], hashPassword('teacher123'), now);
  }

  // Ensure all 8 classes across all 4 sections exist
  const insertClass = db.prepare(`
    INSERT OR IGNORE INTO classes (id, section_id, name, level, created_at)
    VALUES (?, ?, ?, ?, ?)
  `);

  const allClasses: Array<[string, string, string, string]> = [
    [clsForm3, secAnglo, 'Form 3 A', 'Secondary Cycle 1'],
    [clsForm5s, secAnglo, 'Form 5 Science', 'Secondary Cycle 1'],
    [clsLowerSixth, secAnglo, 'Lower Sixth Science', 'Second Cycle'],
    [cls3eme, secFranco, '3ème A', 'Premier Cycle'],
    [clsTleC, secFranco, 'Terminale C', 'Second Cycle'],
    [cls2ndeA4, secGeneral, 'Seconde A4', 'Second Cycle'],
    [clsTech1, secTech, '1ère F3 (Electrotechnics)', 'Second Cycle'],
    [cls1ereCG, secTech, '1ère CG (Accounting)', 'Second Cycle'],
  ];
  for (const c of allClasses) {
    insertClass.run(c[0], c[1], c[2], c[3], now);
  }

  const insertStudent = db.prepare(`
    INSERT OR IGNORE INTO students (id, class_id, matricule, full_name, date_of_birth, place_of_birth, sex, repeater, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const allStudents: Array<[string, string, string, string, string, string, 'M' | 'F', number]> = [
    // Form 3 A (10 students)
    ['stu_01', clsForm3, 'SCH-26-001', 'ATANGANA Mireille Claire', '2011-04-12', 'Douala', 'F', 0],
    ['stu_02', clsForm3, 'SCH-26-002', 'NGUFOR Brian Tanyi', '2010-11-03', 'Bamenda', 'M', 0],
    ['stu_03', clsForm3, 'SCH-26-003', 'KAMGAING Vanessa Joëlle', '2010-08-19', 'Bafoussam', 'F', 1],
    ['stu_04', clsForm3, 'SCH-26-004', 'BIKOI Samuel Junior', '2011-01-25', 'Douala', 'M', 0],
    ['stu_07', clsForm3, 'SCH-26-005', 'NDONG Brice Emmanuel', '2011-03-08', 'Douala', 'M', 0],
    ['stu_08', clsForm3, 'SCH-26-006', 'FOTSO Chancelle', '2010-09-21', 'Dschang', 'F', 0],
    ['stu_09', clsForm3, 'SCH-26-007', 'TCHOUMBA Kevin', '2010-12-14', 'Nkongsamba', 'M', 1],
    ['stu_10', clsForm3, 'SCH-26-008', 'ESSOMBA Lydie Rose', '2011-05-02', 'Douala', 'F', 0],
    ['stu_11', clsForm3, 'SCH-26-009', 'NKENGUE Arnaud', '2010-07-17', 'Edéa', 'M', 0],
    ['stu_12', clsForm3, 'SCH-26-010', 'MBELLA Grace Sandra', '2011-02-27', 'Douala', 'F', 0],

    // 3ème A (8 students)
    ['stu_05', cls3eme, 'SCH-26-101', 'MVONDO Marc Antoine', '2011-02-14', 'Ebolowa', 'M', 0],
    ['stu_06', cls3eme, 'SCH-26-102', 'TSAFACK Diane Laure', '2010-06-30', 'Dschang', 'F', 0],
    ['stu_13', cls3eme, 'SCH-26-103', 'EBODE Junior', '2010-10-11', 'Douala', 'M', 0],
    ['stu_14', cls3eme, 'SCH-26-104', 'NGAH Nadine', '2011-01-19', 'Yaoundé', 'F', 0],
    ['stu_15', cls3eme, 'SCH-26-105', 'KAMGANG Thierry', '2010-04-22', 'Douala', 'M', 1],
    ['stu_16', cls3eme, 'SCH-26-106', 'OYONO Estelle', '2011-06-05', 'Kribi', 'F', 0],
    ['stu_17', cls3eme, 'SCH-26-107', 'TALLA Dimitri', '2010-09-09', 'Bafang', 'M', 0],
    ['stu_18', cls3eme, 'SCH-26-108', 'MEKOUA Larissa', '2011-03-15', 'Douala', 'F', 0],

    // 1ère F3 (6 students)
    ['stu_19', clsTech1, 'SCH-26-201', 'FOPA Rodrigue', '2008-05-12', 'Douala', 'M', 0],
    ['stu_20', clsTech1, 'SCH-26-202', 'NJOYA Aïcha', '2008-11-23', 'Foumban', 'F', 0],
    ['stu_21', clsTech1, 'SCH-26-203', 'KENFACK Loïc', '2007-12-03', 'Douala', 'M', 1],
    ['stu_22', clsTech1, 'SCH-26-204', 'BIYONG Sandrine', '2008-08-14', 'Edéa', 'F', 0],
    ['stu_23', clsTech1, 'SCH-26-205', 'ZANG Christian', '2008-03-29', 'Douala', 'M', 0],
    ['stu_24', clsTech1, 'SCH-26-206', 'MOUKOURI Jessica', '2008-07-04', 'Douala', 'F', 0],

    // Form 5 Science (8 students)
    ['stu_25', clsForm5s, 'SCH-26-301', 'ASHU Brandon Enow', '2009-02-18', 'Buea', 'M', 0],
    ['stu_26', clsForm5s, 'SCH-26-302', 'TAMBE Blessing Agbor', '2009-07-09', 'Limbe', 'F', 0],
    ['stu_27', clsForm5s, 'SCH-26-303', 'NGWA Kelvin Suh', '2009-04-26', 'Bamenda', 'M', 0],
    ['stu_28', clsForm5s, 'SCH-26-304', 'FONKENG Cynthia', '2009-10-12', 'Douala', 'F', 0],
    ['stu_29', clsForm5s, 'SCH-26-305', 'ETOUNDI Boris', '2008-12-05', 'Yaoundé', 'M', 1],
    ['stu_30', clsForm5s, 'SCH-26-306', 'CHE Faith Lum', '2009-06-21', 'Bamenda', 'F', 0],
    ['stu_31', clsForm5s, 'SCH-26-307', 'MBAPPE Cedric', '2009-09-14', 'Douala', 'M', 0],
    ['stu_32', clsForm5s, 'SCH-26-308', 'NGANNOU Pamela', '2009-03-30', 'Bafoussam', 'F', 0],

    // Lower Sixth Science (7 students)
    ['stu_33', clsLowerSixth, 'SCH-26-401', 'TANYI Derick Orock', '2007-05-11', 'Mamfe', 'M', 0],
    ['stu_34', clsLowerSixth, 'SCH-26-402', 'ABOMO Clarisse', '2008-01-08', 'Douala', 'F', 0],
    ['stu_35', clsLowerSixth, 'SCH-26-403', 'NEBA Desmond Fru', '2007-08-22', 'Bamenda', 'M', 0],
    ['stu_36', clsLowerSixth, 'SCH-26-404', 'WAMBA Sonia Flore', '2008-02-19', 'Dschang', 'F', 0],
    ['stu_37', clsLowerSixth, 'SCH-26-405', 'BESONG Victor', '2007-06-15', 'Kumba', 'M', 1],
    ['stu_38', clsLowerSixth, 'SCH-26-406', 'EYENGA Raïssa', '2008-04-03', 'Douala', 'F', 0],
    ['stu_39', clsLowerSixth, 'SCH-26-407', 'NDIAYE Idriss', '2007-11-28', 'Garoua', 'M', 0],

    // Terminale C (7 students)
    ['stu_40', clsTleC, 'SCH-26-501', 'KOUAMO Franck Olivier', '2007-03-14', 'Douala', 'M', 0],
    ['stu_41', clsTleC, 'SCH-26-502', 'DJOUKOUO Inès Gaëlle', '2007-09-25', 'Bafoussam', 'F', 0],
    ['stu_42', clsTleC, 'SCH-26-503', 'ONANA Steve Wilfried', '2007-01-17', 'Yaoundé', 'M', 0],
    ['stu_43', clsTleC, 'SCH-26-504', 'BELIBI Manuela', '2007-12-09', 'Douala', 'F', 0],
    ['stu_44', clsTleC, 'SCH-26-505', 'SIMO Yannick', '2006-10-30', 'Mbouda', 'M', 1],
    ['stu_45', clsTleC, 'SCH-26-506', 'NTAMACK Leslie', '2007-07-06', 'Douala', 'F', 0],
    ['stu_46', clsTleC, 'SCH-26-507', 'MAHAMAT Aminou', '2007-04-19', 'Maroua', 'M', 0],

    // Seconde A4 (7 students)
    ['stu_47', cls2ndeA4, 'SCH-26-601', 'BELLA Chloé Ingrid', '2009-08-12', 'Douala', 'F', 0],
    ['stu_48', cls2ndeA4, 'SCH-26-602', 'NDOUMBE Dylan', '2009-05-24', 'Douala', 'M', 0],
    ['stu_49', cls2ndeA4, 'SCH-26-603', 'FEUDJIO Ornella', '2009-11-01', 'Dschang', 'F', 0],
    ['stu_50', cls2ndeA4, 'SCH-26-604', 'ASSIGA Stéphane', '2008-12-20', 'Yaoundé', 'M', 1],
    ['stu_51', cls2ndeA4, 'SCH-26-605', 'MOUNIRATOU Fadimatou', '2009-06-15', 'Ngaoundéré', 'F', 0],
    ['stu_52', cls2ndeA4, 'SCH-26-606', 'TCHOUNKEU Jordan', '2009-09-03', 'Nkongsamba', 'M', 0],
    ['stu_53', cls2ndeA4, 'SCH-26-607', 'ETAME Prisca', '2009-02-28', 'Douala', 'F', 0],

    // 1ère CG Accounting (7 students)
    ['stu_54', cls1ereCG, 'SCH-26-701', 'DONGMO Audrey Blanche', '2008-04-07', 'Bafoussam', 'F', 0],
    ['stu_55', cls1ereCG, 'SCH-26-702', 'NGUEA Hermann', '2008-09-18', 'Douala', 'M', 0],
    ['stu_56', cls1ereCG, 'SCH-26-703', 'KOUEKAM Charlène', '2008-01-29', 'Douala', 'F', 0],
    ['stu_57', cls1ereCG, 'SCH-26-704', 'BASSILEKIN Kevin', '2007-11-11', 'Edéa', 'M', 1],
    ['stu_58', cls1ereCG, 'SCH-26-705', 'MENDOUGA Sabine', '2008-06-23', 'Ebolowa', 'F', 0],
    ['stu_59', cls1ereCG, 'SCH-26-706', 'NFORMI Elvis', '2008-03-10', 'Kumbo', 'M', 0],
    ['stu_60', cls1ereCG, 'SCH-26-707', 'YEPDO Tatiana', '2008-10-04', 'Douala', 'F', 0],
  ];

  for (const s of allStudents) {
    insertStudent.run(s[0], s[1], s[2], s[3], s[4], s[5], s[6], s[7], now);
  }

  // Subjects across all 8 classes
  const insertSubject = db.prepare(`
    INSERT OR IGNORE INTO subjects (id, class_id, name_en, name_fr, coefficient, code, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const allSubjects: Array<[string, string, string, string, number, string]> = [
    // Form 3 A
    ['sub_f3_math', clsForm3, 'Mathematics', 'Mathématiques', 4, 'MAT'],
    ['sub_f3_eng', clsForm3, 'English Language', 'Anglais', 4, 'ENG'],
    ['sub_f3_fre', clsForm3, 'French Language', 'Français', 3, 'FRE'],
    ['sub_f3_phy', clsForm3, 'Physics', 'Physique', 3, 'PHY'],
    ['sub_f3_bio', clsForm3, 'Biology', 'Sciences de la Vie', 2, 'BIO'],
    ['sub_f3_hist', clsForm3, 'History & Citizenship', 'Histoire & Éducation Civique', 2, 'HIS'],

    // 3ème A
    ['sub_3e_math', cls3eme, 'Mathematics', 'Mathématiques', 4, 'MAT'],
    ['sub_3e_fre', cls3eme, 'French Language', 'Français', 4, 'FRA'],
    ['sub_3e_eng', cls3eme, 'English Language', 'Anglais', 3, 'ANG'],
    ['sub_3e_pc', cls3eme, 'Physics & Chemistry', 'Physique-Chimie', 3, 'PCT'],

    // 1ère F3
    ['sub_1f3_math', clsTech1, 'Mathematics', 'Mathématiques', 4, 'MAT'],
    ['sub_1f3_elec', clsTech1, 'Electrotechnics', 'Électrotechnique', 5, 'ELC'],
    ['sub_1f3_phy', clsTech1, 'Applied Physics', 'Physique Appliquée', 3, 'PHY'],
    ['sub_1f3_eng', clsTech1, 'English Language', 'Anglais', 2, 'ENG'],
    ['sub_1f3_fre', clsTech1, 'French Language', 'Français', 2, 'FRA'],

    // Form 5 Science
    ['sub_f5_math', clsForm5s, 'Mathematics', 'Mathématiques', 5, 'MAT'],
    ['sub_f5_phy', clsForm5s, 'Physics', 'Physique', 4, 'PHY'],
    ['sub_f5_chem', clsForm5s, 'Chemistry', 'Chimie', 4, 'CHM'],
    ['sub_f5_bio', clsForm5s, 'Biology', 'Biologie', 3, 'BIO'],
    ['sub_f5_eng', clsForm5s, 'English Language', 'Anglais', 3, 'ENG'],
    ['sub_f5_csc', clsForm5s, 'Computer Science', 'Informatique', 2, 'ICT'],

    // Lower Sixth Science
    ['sub_ls_math', clsLowerSixth, 'Further Mathematics', 'Mathématiques Approfondies', 5, 'FMA'],
    ['sub_ls_phy', clsLowerSixth, 'Physics', 'Physique', 5, 'PHY'],
    ['sub_ls_chem', clsLowerSixth, 'Chemistry', 'Chimie', 4, 'CHM'],
    ['sub_ls_bio', clsLowerSixth, 'Biology', 'Biologie', 3, 'BIO'],
    ['sub_ls_csc', clsLowerSixth, 'Computer Science', 'Informatique', 3, 'CSC'],

    // Terminale C
    ['sub_tc_math', clsTleC, 'Mathematics', 'Mathématiques', 6, 'MAT'],
    ['sub_tc_phy', clsTleC, 'Physics & Chemistry', 'Physique-Chimie', 5, 'PCT'],
    ['sub_tc_svt', clsTleC, 'Life & Earth Sciences', 'SVT', 2, 'SVT'],
    ['sub_tc_phi', clsTleC, 'Philosophy', 'Philosophie', 2, 'PHI'],
    ['sub_tc_fre', clsTleC, 'French Literature', 'Français', 2, 'FRA'],
    ['sub_tc_info', clsTleC, 'Computer Science', 'Informatique', 2, 'INF'],

    // Seconde A4
    ['sub_2a_fre', cls2ndeA4, 'French Literature', 'Français', 4, 'FRA'],
    ['sub_2a_eng', cls2ndeA4, 'English Language', 'Anglais', 3, 'ANG'],
    ['sub_2a_hist', cls2ndeA4, 'History & Geography', 'Histoire-Géographie', 4, 'HGE'],
    ['sub_2a_math', cls2ndeA4, 'Mathematics', 'Mathématiques', 2, 'MAT'],
    ['sub_2a_eco', cls2ndeA4, 'Economics & Citizenship', 'Économie & ECM', 3, 'ECO'],

    // 1ère CG (Accounting)
    ['sub_cg_acc', cls1ereCG, 'General Accounting', 'Comptabilité Générale', 5, 'CPT'],
    ['sub_cg_eco', cls1ereCG, 'Economics & Commerce', 'Économie d’Entreprise', 4, 'ECO'],
    ['sub_cg_math', cls1ereCG, 'Financial Mathematics', 'Mathématiques Financières', 3, 'MFI'],
    ['sub_cg_ict', cls1ereCG, 'Accounting Software / ICT', 'Informatique de Gestion', 3, 'INF'],
    ['sub_cg_fre', cls1ereCG, 'French Expression', 'Français', 2, 'FRA'],
  ];

  for (const sub of allSubjects) {
    insertSubject.run(sub[0], sub[1], sub[2], sub[3], sub[4], sub[5], now);
  }

  // Teacher Assignments across all 8 classes
  const insertAssign = db.prepare(`
    INSERT OR IGNORE INTO teacher_assignments (id, teacher_id, class_id, subject_id, created_at)
    VALUES (?, ?, ?, ?, ?)
  `);

  const assignments: Array<[string, string, string, string]> = [
    ['asg_01', teacher1Id, clsForm3, 'sub_f3_math'],
    ['asg_02', teacher1Id, clsForm3, 'sub_f3_phy'],
    ['asg_03', teacher1Id, cls3eme, 'sub_3e_math'],
    ['asg_04', teacher2Id, clsForm3, 'sub_f3_eng'],
    ['asg_05', teacher2Id, clsForm3, 'sub_f3_fre'],
    ['asg_06', teacher4Id, clsForm3, 'sub_f3_bio'],
    ['asg_07', teacher5Id, clsForm3, 'sub_f3_hist'],
    ['asg_08', teacher2Id, cls3eme, 'sub_3e_fre'],
    ['asg_09', teacher2Id, cls3eme, 'sub_3e_eng'],
    ['asg_10', teacher3Id, cls3eme, 'sub_3e_pc'],
    ['asg_11', teacher1Id, clsTech1, 'sub_1f3_math'],
    ['asg_12', teacher3Id, clsTech1, 'sub_1f3_elec'],
    ['asg_13', teacher1Id, clsTech1, 'sub_1f3_phy'],
    ['asg_14', teacher2Id, clsTech1, 'sub_1f3_eng'],
    ['asg_15', teacher8Id, clsTech1, 'sub_1f3_fre'],

    // Form 5 Science
    ['asg_16', teacher1Id, clsForm5s, 'sub_f5_math'],
    ['asg_17', teacher3Id, clsForm5s, 'sub_f5_phy'],
    ['asg_18', teacher4Id, clsForm5s, 'sub_f5_chem'],
    ['asg_19', teacher4Id, clsForm5s, 'sub_f5_bio'],
    ['asg_20', teacher2Id, clsForm5s, 'sub_f5_eng'],
    ['asg_21', teacher6Id, clsForm5s, 'sub_f5_csc'],

    // Lower Sixth Science
    ['asg_22', teacher1Id, clsLowerSixth, 'sub_ls_math'],
    ['asg_23', teacher3Id, clsLowerSixth, 'sub_ls_phy'],
    ['asg_24', teacher4Id, clsLowerSixth, 'sub_ls_chem'],
    ['asg_25', teacher4Id, clsLowerSixth, 'sub_ls_bio'],
    ['asg_26', teacher6Id, clsLowerSixth, 'sub_ls_csc'],

    // Terminale C
    ['asg_27', teacher1Id, clsTleC, 'sub_tc_math'],
    ['asg_28', teacher3Id, clsTleC, 'sub_tc_phy'],
    ['asg_29', teacher4Id, clsTleC, 'sub_tc_svt'],
    ['asg_30', teacher8Id, clsTleC, 'sub_tc_phi'],
    ['asg_31', teacher8Id, clsTleC, 'sub_tc_fre'],
    ['asg_32', teacher6Id, clsTleC, 'sub_tc_info'],

    // Seconde A4
    ['asg_33', teacher8Id, cls2ndeA4, 'sub_2a_fre'],
    ['asg_34', teacher2Id, cls2ndeA4, 'sub_2a_eng'],
    ['asg_35', teacher5Id, cls2ndeA4, 'sub_2a_hist'],
    ['asg_36', teacher1Id, cls2ndeA4, 'sub_2a_math'],
    ['asg_37', teacher7Id, cls2ndeA4, 'sub_2a_eco'],

    // 1ère CG
    ['asg_38', teacher7Id, cls1ereCG, 'sub_cg_acc'],
    ['asg_39', teacher7Id, cls1ereCG, 'sub_cg_eco'],
    ['asg_40', teacher1Id, cls1ereCG, 'sub_cg_math'],
    ['asg_41', teacher6Id, cls1ereCG, 'sub_cg_ict'],
    ['asg_42', teacher8Id, cls1ereCG, 'sub_cg_fre'],
  ];

  for (const a of assignments) {
    insertAssign.run(a[0], a[1], a[2], a[3], now);
  }

  // Sequence 1 & Sequence 2 marks for Term 1 across all 8 classes
  const insertMark = db.prepare(`
    INSERT OR IGNORE INTO marks (id, student_id, subject_id, class_id, term, sequence, score, remark, updated_by, updated_at)
    VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, ?)
  `);

  const form3Scores: Record<string, Record<string, [number, number]>> = {
    stu_01: { sub_f3_math: [16.5, 17.5], sub_f3_eng: [17.0, 16.5], sub_f3_fre: [15.5, 16.0], sub_f3_phy: [14.5, 15.5], sub_f3_bio: [16.0, 16.5], sub_f3_hist: [15.0, 15.5] },
    stu_02: { sub_f3_math: [13.0, 13.5], sub_f3_eng: [14.0, 14.5], sub_f3_fre: [11.5, 12.5], sub_f3_phy: [12.5, 13.0], sub_f3_bio: [13.5, 14.0], sub_f3_hist: [14.0, 13.5] },
    stu_03: { sub_f3_math: [8.5, 9.0], sub_f3_eng: [10.5, 11.0], sub_f3_fre: [11.0, 10.5], sub_f3_phy: [9.0, 8.5], sub_f3_bio: [10.0, 10.5], sub_f3_hist: [9.5, 10.0] },
    stu_04: { sub_f3_math: [14.5, 15.0], sub_f3_eng: [12.0, 12.5], sub_f3_fre: [13.0, 13.5], sub_f3_phy: [15.0, 14.5], sub_f3_bio: [13.0, 14.0], sub_f3_hist: [12.5, 13.0] },
    stu_07: { sub_f3_math: [11.0, 12.0], sub_f3_eng: [12.5, 13.0], sub_f3_fre: [10.5, 11.5], sub_f3_phy: [11.5, 12.0], sub_f3_bio: [12.0, 12.5], sub_f3_hist: [11.0, 11.5] },
    stu_08: { sub_f3_math: [15.0, 16.0], sub_f3_eng: [16.0, 16.5], sub_f3_fre: [14.5, 15.0], sub_f3_phy: [13.5, 14.0], sub_f3_bio: [15.5, 16.0], sub_f3_hist: [14.5, 15.0] },
    stu_09: { sub_f3_math: [7.5, 8.0], sub_f3_eng: [9.0, 9.5], sub_f3_fre: [8.5, 9.0], sub_f3_phy: [7.0, 8.0], sub_f3_bio: [9.5, 9.0], sub_f3_hist: [8.0, 8.5] },
    stu_10: { sub_f3_math: [12.5, 13.0], sub_f3_eng: [15.0, 15.5], sub_f3_fre: [14.0, 14.5], sub_f3_phy: [11.0, 12.0], sub_f3_bio: [13.5, 14.5], sub_f3_hist: [13.5, 14.0] },
    stu_11: { sub_f3_math: [10.0, 10.5], sub_f3_eng: [11.0, 11.5], sub_f3_fre: [10.0, 10.5], sub_f3_phy: [9.5, 10.0], sub_f3_bio: [11.0, 11.5], sub_f3_hist: [10.5, 11.0] },
    stu_12: { sub_f3_math: [14.0, 14.5], sub_f3_eng: [15.5, 16.0], sub_f3_fre: [15.0, 15.5], sub_f3_phy: [13.0, 13.5], sub_f3_bio: [14.5, 15.0], sub_f3_hist: [14.0, 14.5] },
  };
  const subjectTeacherMap: Record<string, string> = {
    sub_f3_math: teacher1Id, sub_f3_phy: teacher1Id, sub_f3_eng: teacher2Id, sub_f3_fre: teacher2Id, sub_f3_bio: teacher4Id, sub_f3_hist: teacher5Id,
    sub_3e_math: teacher1Id, sub_3e_fre: teacher2Id, sub_3e_eng: teacher2Id, sub_3e_pc: teacher3Id,
    sub_1f3_math: teacher1Id, sub_1f3_elec: teacher3Id, sub_1f3_phy: teacher1Id, sub_1f3_eng: teacher2Id, sub_1f3_fre: teacher8Id,
    sub_f5_math: teacher1Id, sub_f5_phy: teacher3Id, sub_f5_chem: teacher4Id, sub_f5_bio: teacher4Id, sub_f5_eng: teacher2Id, sub_f5_csc: teacher6Id,
    sub_ls_math: teacher1Id, sub_ls_phy: teacher3Id, sub_ls_chem: teacher4Id, sub_ls_bio: teacher4Id, sub_ls_csc: teacher6Id,
    sub_tc_math: teacher1Id, sub_tc_phy: teacher3Id, sub_tc_svt: teacher4Id, sub_tc_phi: teacher8Id, sub_tc_fre: teacher8Id, sub_tc_info: teacher6Id,
    sub_2a_fre: teacher8Id, sub_2a_eng: teacher2Id, sub_2a_hist: teacher5Id, sub_2a_math: teacher1Id, sub_2a_eco: teacher7Id,
    sub_cg_acc: teacher7Id, sub_cg_eco: teacher7Id, sub_cg_math: teacher1Id, sub_cg_ict: teacher6Id, sub_cg_fre: teacher8Id,
  };

  for (const [stuId, subObj] of Object.entries(form3Scores)) {
    for (const [subId, [s1, s2]] of Object.entries(subObj)) {
      const by = subjectTeacherMap[subId] ?? headId;
      insertMark.run(`mrk_${stuId}_${subId}_t1_s1`, stuId, subId, clsForm3, 1, s1, remarkForScore(s1), by, now);
      insertMark.run(`mrk_${stuId}_${subId}_t1_s2`, stuId, subId, clsForm3, 2, s2, remarkForScore(s2), by, now);
    }
  }

  const cls3emeScores: Record<string, Record<string, [number, number]>> = {
    stu_05: { sub_3e_math: [14.0, 15.0], sub_3e_fre: [13.5, 14.0], sub_3e_eng: [12.5, 13.0], sub_3e_pc: [13.0, 14.0] },
    stu_06: { sub_3e_math: [16.0, 16.5], sub_3e_fre: [15.5, 16.0], sub_3e_eng: [15.0, 15.5], sub_3e_pc: [14.5, 15.0] },
    stu_13: { sub_3e_math: [11.5, 12.5], sub_3e_fre: [11.0, 11.5], sub_3e_eng: [10.5, 11.0], sub_3e_pc: [11.0, 12.0] },
    stu_14: { sub_3e_math: [13.0, 13.5], sub_3e_fre: [14.0, 14.5], sub_3e_eng: [13.5, 14.0], sub_3e_pc: [12.5, 13.0] },
    stu_15: { sub_3e_math: [8.0, 9.0], sub_3e_fre: [9.5, 9.0], sub_3e_eng: [8.5, 9.5], sub_3e_pc: [8.0, 8.5] },
    stu_16: { sub_3e_math: [12.0, 12.5], sub_3e_fre: [13.0, 13.5], sub_3e_eng: [14.0, 14.5], sub_3e_pc: [11.5, 12.0] },
    stu_17: { sub_3e_math: [10.5, 11.0], sub_3e_fre: [10.0, 10.5], sub_3e_eng: [11.0, 11.5], sub_3e_pc: [10.0, 10.5] },
    stu_18: { sub_3e_math: [15.0, 15.5], sub_3e_fre: [14.5, 15.0], sub_3e_eng: [13.5, 14.0], sub_3e_pc: [14.0, 14.5] },
  };

  for (const [stuId, subObj] of Object.entries(cls3emeScores)) {
    for (const [subId, [s1, s2]] of Object.entries(subObj)) {
      const by = subjectTeacherMap[subId] ?? headId;
      insertMark.run(`mrk_${stuId}_${subId}_t1_s1`, stuId, subId, cls3eme, 1, s1, remarkForScore(s1), by, now);
      insertMark.run(`mrk_${stuId}_${subId}_t1_s2`, stuId, subId, cls3eme, 2, s2, remarkForScore(s2), by, now);
    }
  }

  const clsTechScores: Record<string, Record<string, [number, number]>> = {
    stu_19: { sub_1f3_math: [15.5, 16.0], sub_1f3_elec: [16.5, 17.0], sub_1f3_phy: [14.5, 15.0], sub_1f3_eng: [13.0, 13.5], sub_1f3_fre: [12.5, 13.0] },
    stu_20: { sub_1f3_math: [13.5, 14.0], sub_1f3_elec: [14.0, 14.5], sub_1f3_phy: [13.0, 13.5], sub_1f3_eng: [14.0, 14.5], sub_1f3_fre: [13.5, 14.0] },
    stu_21: { sub_1f3_math: [9.0, 9.5], sub_1f3_elec: [10.0, 10.5], sub_1f3_phy: [8.5, 9.0], sub_1f3_eng: [9.5, 10.0], sub_1f3_fre: [9.0, 9.5] },
    stu_22: { sub_1f3_math: [12.0, 12.5], sub_1f3_elec: [13.0, 13.5], sub_1f3_phy: [12.5, 12.0], sub_1f3_eng: [13.0, 13.5], sub_1f3_fre: [12.0, 12.5] },
    stu_23: { sub_1f3_math: [11.0, 11.5], sub_1f3_elec: [11.5, 12.0], sub_1f3_phy: [10.5, 11.0], sub_1f3_eng: [10.0, 10.5], sub_1f3_fre: [10.5, 11.0] },
    stu_24: { sub_1f3_math: [14.5, 15.0], sub_1f3_elec: [15.0, 15.5], sub_1f3_phy: [14.0, 14.5], sub_1f3_eng: [13.5, 14.0], sub_1f3_fre: [13.0, 13.5] },
  };

  for (const [stuId, subObj] of Object.entries(clsTechScores)) {
    for (const [subId, [s1, s2]] of Object.entries(subObj)) {
      const by = subjectTeacherMap[subId] ?? headId;
      insertMark.run(`mrk_${stuId}_${subId}_t1_s1`, stuId, subId, clsTech1, 1, s1, remarkForScore(s1), by, now);
      insertMark.run(`mrk_${stuId}_${subId}_t1_s2`, stuId, subId, clsTech1, 2, s2, remarkForScore(s2), by, now);
    }
  }

  // Deterministic score generation for the 5 newly added classes (stu_25 .. stu_60)
  const classBaselines: Array<{
    classId: string;
    subjectIds: string[];
    studentProfiles: Array<[string, number]>;
  }> = [
    {
      classId: clsForm5s,
      subjectIds: ['sub_f5_math', 'sub_f5_phy', 'sub_f5_chem', 'sub_f5_bio', 'sub_f5_eng', 'sub_f5_csc'],
      studentProfiles: [
        ['stu_25', 14.5], ['stu_26', 16.0], ['stu_27', 12.5], ['stu_28', 13.5],
        ['stu_29', 9.0], ['stu_30', 15.0], ['stu_31', 11.5], ['stu_32', 13.0],
      ],
    },
    {
      classId: clsLowerSixth,
      subjectIds: ['sub_ls_math', 'sub_ls_phy', 'sub_ls_chem', 'sub_ls_bio', 'sub_ls_csc'],
      studentProfiles: [
        ['stu_33', 15.5], ['stu_34', 14.0], ['stu_35', 12.5], ['stu_36', 16.5],
        ['stu_37', 9.5], ['stu_38', 13.5], ['stu_39', 11.5],
      ],
    },
    {
      classId: clsTleC,
      subjectIds: ['sub_tc_math', 'sub_tc_phy', 'sub_tc_svt', 'sub_tc_phi', 'sub_tc_fre', 'sub_tc_info'],
      studentProfiles: [
        ['stu_40', 16.0], ['stu_41', 15.0], ['stu_42', 12.5], ['stu_43', 14.0],
        ['stu_44', 8.8], ['stu_45', 13.5], ['stu_46', 11.2],
      ],
    },
    {
      classId: cls2ndeA4,
      subjectIds: ['sub_2a_fre', 'sub_2a_eng', 'sub_2a_hist', 'sub_2a_math', 'sub_2a_eco'],
      studentProfiles: [
        ['stu_47', 15.2], ['stu_48', 12.8], ['stu_49', 14.0], ['stu_50', 9.2],
        ['stu_51', 16.2], ['stu_52', 11.5], ['stu_53', 13.5],
      ],
    },
    {
      classId: cls1ereCG,
      subjectIds: ['sub_cg_acc', 'sub_cg_eco', 'sub_cg_math', 'sub_cg_ict', 'sub_cg_fre'],
      studentProfiles: [
        ['stu_54', 15.8], ['stu_55', 13.2], ['stu_56', 14.5], ['stu_57', 8.5],
        ['stu_58', 12.0], ['stu_59', 11.0], ['stu_60', 14.8],
      ],
    },
  ];

  for (const cfg of classBaselines) {
    cfg.studentProfiles.forEach(([stuId, base], stuIdx) => {
      cfg.subjectIds.forEach((subId, subIdx) => {
        const variance1 = (((stuIdx * 3 + subIdx * 5) % 5) - 2) * 0.5;
        const variance2 = (((stuIdx * 7 + subIdx * 3) % 5) - 1.5) * 0.5;
        const s1 = Math.max(4, Math.min(19.5, Math.round((base + variance1) * 2) / 2));
        const s2 = Math.max(4.5, Math.min(19.5, Math.round((base + 0.5 + variance2) * 2) / 2));
        const by = subjectTeacherMap[subId] ?? headId;
        insertMark.run(`mrk_${stuId}_${subId}_t1_s1`, stuId, subId, cfg.classId, 1, s1, remarkForScore(s1), by, now);
        insertMark.run(`mrk_${stuId}_${subId}_t1_s2`, stuId, subId, cfg.classId, 2, s2, remarkForScore(s2), by, now);
      });
    });
  }

  // Seed realistic student discipline records (Term 1 Seq 1 & Seq 2)
  const insertDisc = db.prepare(`
    INSERT OR IGNORE INTO student_discipline (
      id, student_id, class_id, term, sequence, justified_absences, unjustified_absences, late_comings, sanction, updated_by, updated_at
    ) VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?)
  `);

  const disciplineSeeds: Array<[string, string, number, [number, number, number, string], [number, number, number, string]]> = [
    ['stu_01', clsForm3, 1, [0, 0, 0, ''], [1, 0, 0, '']],
    ['stu_02', clsForm3, 1, [1, 0, 1, ''], [0, 0, 1, '']],
    ['stu_03', clsForm3, 1, [2, 3, 2, 'Warning / Avertissement'], [1, 2, 3, 'Detention / Consigne']],
    ['stu_04', clsForm3, 1, [0, 1, 1, ''], [1, 0, 0, '']],
    ['stu_07', clsForm3, 1, [2, 0, 2, ''], [1, 1, 1, '']],
    ['stu_08', clsForm3, 1, [0, 0, 0, ''], [0, 0, 0, '']],
    ['stu_09', clsForm3, 1, [1, 4, 4, 'Reprimand / Blâme'], [2, 3, 3, 'Parent Summons / Convocation']],
    ['stu_10', clsForm3, 1, [1, 0, 0, ''], [0, 0, 1, '']],
    ['stu_11', clsForm3, 1, [0, 2, 2, 'Warning / Avertissement'], [1, 1, 2, '']],
    ['stu_12', clsForm3, 1, [0, 0, 0, ''], [0, 0, 0, '']],

    ['stu_05', cls3eme, 1, [1, 0, 1, ''], [0, 0, 0, '']],
    ['stu_06', cls3eme, 1, [0, 0, 0, ''], [0, 0, 0, '']],
    ['stu_15', cls3eme, 1, [1, 3, 3, 'Warning / Avertissement'], [2, 2, 2, 'Detention / Consigne']],
    ['stu_21', clsTech1, 1, [2, 2, 3, 'Warning / Avertissement'], [1, 3, 2, 'Reprimand / Blâme']],

    ['stu_26', clsForm5s, 1, [0, 0, 0, ''], [0, 0, 0, '']],
    ['stu_29', clsForm5s, 1, [1, 3, 2, 'Warning / Avertissement'], [2, 2, 3, 'Detention / Consigne']],
    ['stu_37', clsLowerSixth, 1, [2, 2, 2, 'Warning / Avertissement'], [1, 2, 2, '']],
    ['stu_44', clsTleC, 1, [1, 3, 4, 'Reprimand / Blâme'], [2, 3, 2, 'Parent Summons / Convocation']],
    ['stu_50', cls2ndeA4, 1, [1, 2, 3, 'Warning / Avertissement'], [1, 2, 1, '']],
    ['stu_57', cls1ereCG, 1, [2, 3, 3, 'Reprimand / Blâme'], [2, 2, 2, 'Detention / Consigne']],
  ];

  for (const [stuId, clsId, _t, s1, s2] of disciplineSeeds) {
    insertDisc.run(`dsc_${stuId}_t1_s1`, stuId, clsId, 1, s1[0], s1[1], s1[2], s1[3], headId, now);
    insertDisc.run(`dsc_${stuId}_t1_s2`, stuId, clsId, 2, s2[0], s2[1], s2[2], s2[3], headId, now);
  }
}
