import {
  ArrowUp,
  Atom,
  BookOpen,
  Building2,
  ClipboardEdit,
  FileText,
  GraduationCap,
  Languages,
  Layers,
  LayoutDashboard,
  MapPin,
  Search,
  Settings,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  Users,
} from 'lucide-react';
import { SCHOOL_ASSETS } from '../constants/assets';
import { translations } from '../i18n';
import type { Language, SchoolSettings, UserRole } from '../types';

interface AppFooterProps {
  mode: 'workspace' | 'login';
  lang: Language;
  school: SchoolSettings | null;
  role?: UserRole;
  activeTab?: string;
  electronsEnabled: boolean;
  onToggleElectrons: () => void;
  onChangeLang: (lang: Language) => void;
  onNavigate?: (tab: string) => void;
  onOpenCommand?: () => void;
  onQuickRoleFill?: (preset: 'head_teacher' | 'teacher') => void;
  onScrollToCampus?: () => void;
}

export function AppFooter({
  mode,
  lang,
  school,
  role,
  activeTab,
  electronsEnabled,
  onToggleElectrons,
  onChangeLang,
  onNavigate,
  onOpenCommand,
  onQuickRoleFill,
  onScrollToCampus,
}: AppFooterProps) {
  const t = translations[lang];
  const logoSrc = school?.logoDataUrl || SCHOOL_ASSETS.defaultLogo;
  const schoolTitle = school ? (lang === 'fr' ? school.nameFr : school.nameEn) : t.appName;
  const currentYear = new Date().getFullYear();

  const workspaceLinks =
    role === 'head_teacher'
      ? [
          { id: 'overview', label: t.navOverview, icon: LayoutDashboard },
          { id: 'structure', label: t.navStructure, icon: Layers },
          { id: 'students', label: t.navStudents, icon: Users },
          { id: 'subjects', label: t.navSubjects, icon: BookOpen },
          { id: 'teachers', label: t.navTeachers, icon: UserCheck },
          { id: 'assignments', label: t.navAssignments, icon: ShieldCheck },
          { id: 'marks', label: t.navMarks, icon: ClipboardEdit },
          { id: 'discipline', label: t.navDiscipline, icon: ShieldAlert },
          { id: 'reports', label: t.navReports, icon: FileText },
          { id: 'settings', label: t.navSettings, icon: Settings },
        ]
      : [
          { id: 'marks', label: t.navMarks, icon: ClipboardEdit },
          { id: 'reports', label: t.navReports, icon: FileText },
        ];

  return (
    <div className="no-print relative z-10 mx-auto w-full max-w-6xl px-4 pb-6 pt-2 sm:px-7">
      <footer className="rounded-2xl border border-[#242936] bg-[#0e1117]/95 px-6 py-6 backdrop-blur-md shadow-xl">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          {/* Institutional Identity */}
          <div className="flex items-center gap-3.5">
            <img
              src={logoSrc}
              alt={schoolTitle}
              referrerPolicy="no-referrer"
              className="h-12 w-12 shrink-0 rounded-2xl border border-[#2c3240] bg-white p-1 object-contain"
            />
            <div className="min-w-0">
              <p className="font-script truncate text-2xl leading-none font-bold text-[#f1f3f4]">
                {schoolTitle}
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-[#9aa0a6]">
                <span className="inline-flex items-center gap-1 text-[#8ab4f8]">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  {school?.city || t.footerLocation}
                </span>
                <span aria-hidden="true" className="text-[#4c5464]">
                  ·
                </span>
                <span className="font-mono-num">{school?.academicYear || '2026 - 2027'}</span>
                <span aria-hidden="true" className="hidden text-[#4c5464] sm:inline">
                  ·
                </span>
                <span className="hidden sm:inline">{t.footerBilingualEdition}</span>
              </div>
            </div>
          </div>

          {/* Large Icon-Only Navigation & Utility Links */}
          <nav
            aria-label="Footer navigation"
            className="flex flex-wrap items-center gap-2"
          >
            {mode === 'workspace' && onNavigate ? (
              <>
                {workspaceLinks.map((link) => {
                  const Icon = link.icon;
                  const isActive = activeTab === link.id;
                  return (
                    <button
                      key={link.id}
                      type="button"
                      onClick={() => {
                        onNavigate(link.id);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      title={link.label}
                      aria-label={link.label}
                      className={`inline-flex h-11 w-11 items-center justify-center rounded-xl border transition-all duration-150 ${
                        isActive
                          ? 'border-[#3c4f73] bg-[#182133] text-[#8ab4f8]'
                          : 'border-[#242936] bg-[#13161d] text-[#9aa0a6] hover:border-[#3c465c] hover:bg-[#191f2b] hover:text-[#e8eaed]'
                      }`}
                    >
                      <Icon className="h-5 w-5 shrink-0" />
                    </button>
                  );
                })}

                {onOpenCommand && (
                  <button
                    type="button"
                    onClick={onOpenCommand}
                    title={t.commandHint}
                    aria-label={t.commandHint}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[#242936] bg-[#13161d] text-[#8ab4f8] transition-all duration-150 hover:border-[#3c465c] hover:bg-[#191f2b]"
                  >
                    <Search className="h-5 w-5 shrink-0" />
                  </button>
                )}
              </>
            ) : (
              <>
                {onScrollToCampus && (
                  <button
                    type="button"
                    onClick={onScrollToCampus}
                    title={t.footerCampusLink}
                    aria-label={t.footerCampusLink}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[#242936] bg-[#13161d] text-[#8ab4f8] transition-all duration-150 hover:border-[#3c465c] hover:bg-[#191f2b]"
                  >
                    <Building2 className="h-5 w-5 shrink-0" />
                  </button>
                )}
                {onQuickRoleFill && (
                  <>
                    <button
                      type="button"
                      onClick={() => onQuickRoleFill('head_teacher')}
                      title={t.footerAdminLink}
                      aria-label={t.footerAdminLink}
                      className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[#242936] bg-[#13161d] text-[#8ab4f8] transition-all duration-150 hover:border-[#3c465c] hover:bg-[#191f2b]"
                    >
                      <ShieldCheck className="h-5 w-5 shrink-0" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onQuickRoleFill('teacher')}
                      title={t.footerFacultyLink}
                      aria-label={t.footerFacultyLink}
                      className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[#242936] bg-[#13161d] text-[#8ab4f8] transition-all duration-150 hover:border-[#3c465c] hover:bg-[#191f2b]"
                    >
                      <GraduationCap className="h-5 w-5 shrink-0" />
                    </button>
                  </>
                )}
              </>
            )}

            <button
              type="button"
              onClick={onToggleElectrons}
              title={electronsEnabled ? t.electronsOn : t.electronsOff}
              aria-label={electronsEnabled ? t.electronsOn : t.electronsOff}
              className={`inline-flex h-11 w-11 items-center justify-center rounded-xl border transition-all duration-150 ${
                electronsEnabled
                  ? 'border-[#33415c] bg-[#161e2e] text-[#8ab4f8]'
                  : 'border-[#242936] bg-[#13161d] text-[#9aa0a6] hover:text-[#e8eaed]'
              }`}
            >
              <Atom className="h-5 w-5 shrink-0" />
            </button>

            <button
              type="button"
              onClick={() => onChangeLang(lang === 'en' ? 'fr' : 'en')}
              title={lang === 'en' ? 'Français' : 'English'}
              aria-label={lang === 'en' ? 'Français' : 'English'}
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[#242936] bg-[#13161d] text-[#8ab4f8] transition-all duration-150 hover:border-[#3c465c] hover:bg-[#191f2b]"
            >
              <Languages className="h-5 w-5 shrink-0" />
            </button>

            <button
              type="button"
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              title={t.footerTop}
              aria-label={t.footerTop}
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[#242936] bg-[#13161d] text-[#9aa0a6] transition-all duration-150 hover:border-[#3c465c] hover:bg-[#191f2b] hover:text-[#8ab4f8]"
            >
              <ArrowUp className="h-5 w-5 shrink-0" />
            </button>
          </nav>
        </div>

        {/* Hairline Copyright Row */}
        <div className="mt-5 flex flex-col items-start justify-between gap-2 border-t border-[#1e2330] pt-4 text-xs text-[#7f8794] sm:flex-row sm:items-center">
          <p>
            © {currentYear} {schoolTitle} · {t.footerLocation} · {t.footerCopyright}
          </p>
          <p className="text-[#9aa0a6]">
            {t.footerPortalNote} · {t.activeTermLabel} {school?.activeTerm ?? 1}
          </p>
        </div>
      </footer>
    </div>
  );
}
