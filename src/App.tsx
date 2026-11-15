import { useEffect, useState } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import {
  Atom,
  BookOpen,
  ClipboardEdit,
  FileText,
  Languages,
  Layers,
  LayoutDashboard,
  LogOut,
  Menu,
  Search,
  Settings,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { api, getStoredToken, setStoredToken, setUnauthorizedHandler } from './api';
import { AppFooter } from './components/AppFooter';
import { AssignmentsView } from './components/AssignmentsView';
import { CommandPalette } from './components/CommandPalette';
import { DisciplineView } from './components/DisciplineView';
import { ElectronFieldCanvas } from './components/ElectronFieldCanvas';
import { LoginView } from './components/LoginView';
import { MarksEntryView } from './components/MarksEntryView';
import { OverviewView } from './components/OverviewView';
import { ReportsView } from './components/ReportsView';
import { SettingsView } from './components/SettingsView';
import { StructureView } from './components/StructureView';
import { StudentsView } from './components/StudentsView';
import { SubjectsView } from './components/SubjectsView';
import { TeachersView } from './components/TeachersView';
import { SCHOOL_ASSETS } from './constants/assets';
import { translations } from './i18n';
import type { Language, SchoolSettings, UserProfile } from './types';

const LANG_KEY = 'scholaris_lang';
const ELECTRONS_KEY = 'gbhs_electrons';

export default function App() {
  const [lang, setLang] = useState<Language>(() => {
    const saved = localStorage.getItem(LANG_KEY);
    return saved === 'fr' ? 'fr' : 'en';
  });
  const [electronsEnabled, setElectronsEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem(ELECTRONS_KEY);
    return saved !== 'false';
  });
  const [user, setUser] = useState<UserProfile | null>(null);
  const [school, setSchool] = useState<SchoolSettings | null>(null);
  const [sessionNotice, setSessionNotice] = useState<string | null>(null);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);

  const t = translations[lang];

  function handleChangeLang(next: Language) {
    setLang(next);
    localStorage.setItem(LANG_KEY, next);
  }

  function toggleElectrons() {
    setElectronsEnabled((prev) => {
      const next = !prev;
      localStorage.setItem(ELECTRONS_KEY, String(next));
      return next;
    });
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandOpen((o) => !o);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser((prevUser) => {
        if (prevUser) {
          setSessionNotice(translations[lang].sessionExpiredNotice);
        }
        return null;
      });
    });
    return () => setUnauthorizedHandler(null);
  }, [lang]);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        const settingsRes = await api.getSchoolSettings();
        if (!cancelled) setSchool(settingsRes);

        const token = getStoredToken();
        if (token) {
          try {
            const meRes = await api.me();
            if (!cancelled) {
              setUser(meRes.user);
              setActiveTab(meRes.user.role === 'teacher' ? 'marks' : 'overview');
            }
          } catch {
            setStoredToken(null);
          }
        }
      } finally {
        if (!cancelled) setBootstrapping(false);
      }
    }
    init();
    return () => {
      cancelled = true;
    };
  }, []);

  function handleAuthenticated(token: string, nextUser: UserProfile) {
    setStoredToken(token);
    setSessionNotice(null);
    setUser(nextUser);
    setActiveTab(nextUser.role === 'teacher' ? 'marks' : 'overview');
  }

  async function handleLogout() {
    try {
      await api.logout();
    } catch {
      // ignore
    }
    setStoredToken(null);
    setSessionNotice(null);
    setUser(null);
  }

  if (bootstrapping) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0b0d12] text-sm text-[#9aa0a6]">
        {t.loading}
      </div>
    );
  }

  if (!user) {
    return (
      <MotionConfig reducedMotion="user">
        <LoginView
          school={school}
          lang={lang}
          sessionNotice={sessionNotice}
          electronsEnabled={electronsEnabled}
          onToggleElectrons={toggleElectrons}
          onChangeLang={handleChangeLang}
          onAuthenticated={handleAuthenticated}
        />
      </MotionConfig>
    );
  }

  const headNavItems = [
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
  ];

  const teacherNavItems = [
    { id: 'marks', label: t.navMarks, icon: ClipboardEdit },
    { id: 'reports', label: t.navReports, icon: FileText },
  ];

  const navItems = user.role === 'head_teacher' ? headNavItems : teacherNavItems;
  const activeNav = navItems.find((item) => item.id === activeTab) ?? navItems[0];
  const ActiveIcon = activeNav.icon;

  const headerQuickLinks =
    user.role === 'head_teacher'
      ? [
          { id: 'overview', label: t.navOverview, icon: LayoutDashboard },
          { id: 'students', label: t.navStudents, icon: Users },
          { id: 'marks', label: t.navMarks, icon: ClipboardEdit },
          { id: 'discipline', label: t.navDiscipline, icon: ShieldAlert },
          { id: 'reports', label: t.navReports, icon: FileText },
          { id: 'settings', label: t.navSettings, icon: Settings },
        ]
      : [
          { id: 'marks', label: t.navMarks, icon: ClipboardEdit },
          { id: 'reports', label: t.navReports, icon: FileText },
        ];

  const schoolDisplayName = school ? (lang === 'fr' ? school.nameFr : school.nameEn) : t.appName;

  return (
    <MotionConfig reducedMotion="user">
      <div className="relative flex min-h-screen overflow-x-hidden bg-[#0b0d12] text-[#e8eaed]">
        <ElectronFieldCanvas enabled={electronsEnabled} intensity="ambient" />

        {/* Desktop Sidebar */}
        <aside className="no-print relative z-10 hidden w-64 shrink-0 flex-col border-r border-[#222733] bg-[#101319]/90 backdrop-blur-md lg:flex">
          <div className="flex items-center gap-3 border-b border-[#222733] px-5 py-4">
            <img
              src={school?.logoDataUrl || SCHOOL_ASSETS.defaultLogo}
              alt={schoolDisplayName}
              referrerPolicy="no-referrer"
              className="h-9 w-9 shrink-0 rounded-xl border border-[#2c3240] bg-white p-0.5 object-contain"
            />
            <div className="min-w-0">
              <p className="font-script truncate text-xl leading-tight font-bold text-[#f1f3f4]">
                {t.appName}
              </p>
              <p className="truncate text-[11px] text-[#9aa0a6]">
                {lang === 'fr' ? 'Établissement Bilingue' : 'Bilingual School'}
              </p>
            </div>
          </div>

          <nav className="flex-1 space-y-1 p-3">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = activeNav.id === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`relative flex w-full items-center gap-3 whitespace-nowrap rounded-xl px-3 py-2 text-left text-xs font-semibold transition-colors duration-150 ${
                    active ? 'text-[#8ab4f8]' : 'text-[#9aa0a6] hover:bg-[#171b24] hover:text-[#e8eaed]'
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="sidebarActiveBg"
                      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                      className="absolute inset-0 rounded-xl border border-[#2d3e5e] bg-[#1b2436]"
                    />
                  )}
                  <Icon className="relative z-10 h-4 w-4 shrink-0" />
                  <span className="relative z-10 truncate">{item.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="border-t border-[#222733] p-4">
            <p className="truncate text-xs font-semibold text-[#f1f3f4]">{user.fullName}</p>
            <p className="truncate text-[11px] text-[#9aa0a6]">
              {user.role === 'head_teacher' ? t.roleHeadTeacher : t.roleTeacher}
            </p>
            <button
              type="button"
              onClick={handleLogout}
              className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-[#2c3240] bg-[#151922] px-3 py-2 text-xs font-semibold text-[#bdc1c6] transition-colors hover:border-[#3c465c] hover:bg-[#1d222e] hover:text-[#f1f3f4]"
            >
              <LogOut className="h-3.5 w-3.5" />
              {t.signOut}
            </button>
          </div>
        </aside>

        {/* Mobile Hamburger Drawer */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <div className="no-print fixed inset-0 z-50 flex lg:hidden">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="fixed inset-0 bg-black/70 backdrop-blur-sm"
                onClick={() => setMobileMenuOpen(false)}
              />
              <motion.aside
                initial={{ x: -256 }}
                animate={{ x: 0 }}
                exit={{ x: -256 }}
                transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                className="relative z-10 flex w-64 flex-col border-r border-[#242936] bg-[#101319] shadow-2xl"
              >
                <div className="flex items-center justify-between border-b border-[#222733] px-4 py-4">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <img
                      src={school?.logoDataUrl || SCHOOL_ASSETS.defaultLogo}
                      alt={schoolDisplayName}
                      referrerPolicy="no-referrer"
                      className="h-7 w-7 shrink-0 rounded-lg bg-white p-0.5 object-contain"
                    />
                    <span className="font-script truncate text-xl leading-none font-bold text-[#f1f3f4]">
                      {t.appName}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMobileMenuOpen(false)}
                    aria-label={t.close}
                    className="rounded-lg p-1.5 text-[#9aa0a6] hover:bg-[#1b202b]"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <nav className="flex-1 space-y-1 overflow-y-auto p-3">
                  {navItems.map((item) => {
                    const Icon = item.icon;
                    const active = activeNav.id === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setActiveTab(item.id);
                          setMobileMenuOpen(false);
                        }}
                        className={`flex w-full items-center gap-3 whitespace-nowrap rounded-xl px-3 py-2 text-left text-xs font-semibold ${
                          active ? 'bg-[#1b2436] text-[#8ab4f8]' : 'text-[#9aa0a6] hover:bg-[#171b24]'
                        }`}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </button>
                    );
                  })}
                </nav>
                <div className="border-t border-[#222733] p-4">
                  <p className="truncate text-xs font-semibold text-[#f1f3f4]">{user.fullName}</p>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-xl border border-[#2c3240] px-3 py-2 text-xs font-semibold text-[#bdc1c6] hover:bg-[#1d222e]"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    {t.signOut}
                  </button>
                </div>
              </motion.aside>
            </div>
          )}
        </AnimatePresence>

        {/* Main Content Column */}
        <div className="relative z-10 flex min-w-0 flex-1 flex-col">
          <header className="no-print sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-[#222733] bg-[#0e1117]/90 px-4 py-3 backdrop-blur-md sm:px-5">
            <div className="flex min-w-0 flex-1 items-center gap-2.5">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                className="shrink-0 rounded-xl border border-[#2c3240] bg-[#141821] p-2 text-[#bdc1c6] transition-colors hover:border-[#3c465c] hover:text-[#f1f3f4] lg:hidden"
                aria-label="Open menu"
              >
                <Menu className="h-4 w-4" />
              </button>
              <div className="flex min-w-0 items-center gap-2 text-xs text-[#9aa0a6]">
                <span className="font-script hidden shrink-0 text-lg leading-none font-bold text-[#f1f3f4] sm:inline">
                  {t.appName}
                </span>
                <span aria-hidden="true" className="hidden sm:inline">
                  /
                </span>
                <span className="inline-flex min-w-0 items-center gap-1.5 font-medium text-[#8ab4f8]">
                  <ActiveIcon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{activeNav.label}</span>
                </span>
              </div>
            </div>

            {/* Compact Icon-Only Header Navigation Links (Zero Overflow) */}
            <nav aria-label="Header navigation" className="hidden items-center gap-1 md:flex">
              {headerQuickLinks.map((q) => {
                const QIcon = q.icon;
                const isActive = activeNav.id === q.id;
                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => setActiveTab(q.id)}
                    title={q.label}
                    aria-label={q.label}
                    className={`relative inline-flex items-center justify-center rounded-xl p-2 transition-colors duration-150 ${
                      isActive
                        ? 'bg-[#1b2436] text-[#8ab4f8]'
                        : 'text-[#9aa0a6] hover:bg-[#171b24] hover:text-[#e8eaed]'
                    }`}
                  >
                    <QIcon className="h-4 w-4 shrink-0" />
                    {isActive && (
                      <motion.span
                        layoutId="headerActiveUnderline"
                        transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                        className="absolute right-2 bottom-0.5 left-2 h-[2px] rounded-full bg-[#8ab4f8]"
                      />
                    )}
                  </button>
                );
              })}
            </nav>

            {/* Compact Icon Controls */}
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={() => setCommandOpen(true)}
                title={t.commandPlaceholder}
                aria-label={t.commandHint}
                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-[#282e3c] bg-[#141821] p-2 text-xs text-[#9aa0a6] transition-colors hover:border-[#3c465c] hover:text-[#e8eaed] lg:px-2.5"
              >
                <Search className="h-4 w-4 text-[#8ab4f8]" />
                <span className="font-mono-num hidden rounded-md border border-[#2d3342] bg-[#0d1016] px-1.5 py-0.5 text-[10px] text-[#7f8794] xl:inline">
                  ⌘K
                </span>
              </button>

              <button
                type="button"
                onClick={toggleElectrons}
                title={electronsEnabled ? t.electronsOn : t.electronsOff}
                aria-label={electronsEnabled ? t.electronsOn : t.electronsOff}
                className={`inline-flex items-center justify-center rounded-xl border p-2 transition-colors ${
                  electronsEnabled
                    ? 'border-[#33415c] bg-[#161e2e] text-[#8ab4f8]'
                    : 'border-[#282e3c] bg-[#141821] text-[#7f8794]'
                }`}
              >
                <Atom className="h-4 w-4" />
              </button>

              <div className="flex items-center gap-0.5 rounded-xl border border-[#242936] bg-[#13161d] p-0.5">
                <Languages className="ml-1.5 hidden h-3.5 w-3.5 text-[#8ab4f8] sm:block" />
                <button
                  type="button"
                  onClick={() => handleChangeLang('en')}
                  className={`whitespace-nowrap rounded-lg px-2 py-1 text-xs font-semibold transition-colors ${
                    lang === 'en' ? 'bg-[#232836] text-[#8ab4f8]' : 'text-[#9aa0a6] hover:text-[#e8eaed]'
                  }`}
                >
                  EN
                </button>
                <button
                  type="button"
                  onClick={() => handleChangeLang('fr')}
                  className={`whitespace-nowrap rounded-lg px-2 py-1 text-xs font-semibold transition-colors ${
                    lang === 'fr' ? 'bg-[#232836] text-[#8ab4f8]' : 'text-[#9aa0a6] hover:text-[#e8eaed]'
                  }`}
                >
                  FR
                </button>
              </div>

              <button
                type="button"
                onClick={handleLogout}
                title={t.signOut}
                aria-label={t.signOut}
                className="inline-flex items-center justify-center rounded-xl border border-[#282e3c] bg-[#141821] p-2 text-[#9aa0a6] transition-colors hover:border-[#3c465c] hover:text-[#f1f3f4]"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </header>

          <main className="mx-auto w-full max-w-6xl flex-1 p-4 sm:p-7 print:max-w-none print:p-0">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeNav.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
              >
                {activeNav.id === 'overview' && user.role === 'head_teacher' && (
                  <OverviewView lang={lang} onNavigate={setActiveTab} />
                )}
                {activeNav.id === 'structure' && user.role === 'head_teacher' && (
                  <StructureView lang={lang} />
                )}
                {activeNav.id === 'students' && user.role === 'head_teacher' && (
                  <StudentsView lang={lang} />
                )}
                {activeNav.id === 'subjects' && user.role === 'head_teacher' && (
                  <SubjectsView lang={lang} />
                )}
                {activeNav.id === 'teachers' && user.role === 'head_teacher' && (
                  <TeachersView lang={lang} />
                )}
                {activeNav.id === 'assignments' && user.role === 'head_teacher' && (
                  <AssignmentsView lang={lang} />
                )}
                {activeNav.id === 'marks' && (
                  <MarksEntryView
                    lang={lang}
                    role={user.role}
                    defaultTerm={school?.activeTerm ?? 1}
                  />
                )}
                {activeNav.id === 'discipline' && user.role === 'head_teacher' && (
                  <DisciplineView lang={lang} defaultTerm={school?.activeTerm ?? 1} />
                )}
                {activeNav.id === 'reports' && (
                  <ReportsView lang={lang} role={user.role} defaultTerm={school?.activeTerm ?? 1} />
                )}
                {activeNav.id === 'settings' && user.role === 'head_teacher' && school && (
                  <SettingsView lang={lang} school={school} onUpdated={setSchool} />
                )}
              </motion.div>
            </AnimatePresence>
          </main>

          <AppFooter
            mode="workspace"
            lang={lang}
            school={school}
            role={user.role}
            activeTab={activeNav.id}
            electronsEnabled={electronsEnabled}
            onToggleElectrons={toggleElectrons}
            onChangeLang={handleChangeLang}
            onNavigate={setActiveTab}
            onOpenCommand={() => setCommandOpen(true)}
          />
        </div>

        <CommandPalette
          open={commandOpen}
          onClose={() => setCommandOpen(false)}
          lang={lang}
          role={user.role}
          onNavigate={setActiveTab}
          onChangeLang={handleChangeLang}
        />
      </div>
    </MotionConfig>
  );
}
