import { useRef, useState, type FormEvent } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Atom,
  Building2,
  GraduationCap,
  KeyRound,
  Languages,
  Loader2,
  LogIn,
  Menu,
  ShieldCheck,
  X,
} from 'lucide-react';
import { api } from '../api';
import { SCHOOL_ASSETS } from '../constants/assets';
import { translations } from '../i18n';
import type { Language, SchoolSettings, UserProfile } from '../types';
import { AppFooter } from './AppFooter';
import { ElectronFieldCanvas } from './ElectronFieldCanvas';

interface LoginViewProps {
  school: SchoolSettings | null;
  lang: Language;
  sessionNotice?: string | null;
  electronsEnabled: boolean;
  onToggleElectrons: () => void;
  onChangeLang: (lang: Language) => void;
  onAuthenticated: (token: string, user: UserProfile) => void;
}

export function LoginView({
  school,
  lang,
  sessionNotice,
  electronsEnabled,
  onToggleElectrons,
  onChangeLang,
  onAuthenticated,
}: LoginViewProps) {
  const t = translations[lang];
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [campusFailed, setCampusFailed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const campusRef = useRef<HTMLDivElement | null>(null);
  const formInputRef = useRef<HTMLInputElement | null>(null);

  const logoSrc = school?.logoDataUrl || SCHOOL_ASSETS.defaultLogo;

  function fillPreset(preset: 'head_teacher' | 'teacher') {
    if (preset === 'head_teacher') {
      setIdentifier('headteacher');
      setPassword('admin1234');
    } else {
      setIdentifier('m.mbarga');
      setPassword('teacher123');
    }
    setError(null);
    setMobileMenuOpen(false);
    formInputRef.current?.focus();
  }

  function scrollToCampus() {
    setMobileMenuOpen(false);
    campusRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api.login(identifier, password);
      onAuthenticated(res.token, res.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col overflow-x-hidden bg-[#0b0d12] text-[#e8eaed]">
      <ElectronFieldCanvas enabled={electronsEnabled} intensity="hero" />

      <header className="relative z-20 flex items-center justify-between gap-3 border-b border-[#222631] bg-[#0b0d12]/85 px-4 py-3.5 backdrop-blur-md sm:px-6">
        <div className="flex min-w-0 items-center gap-2.5">
          <button
            type="button"
            onClick={() => setMobileMenuOpen((v) => !v)}
            aria-label="Open menu"
            className="shrink-0 rounded-xl border border-[#2c3240] bg-[#13161d] p-2 text-[#bdc1c6] transition-colors hover:border-[#3c465c] hover:text-[#f1f3f4] md:hidden"
          >
            {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
          <img
            src={logoSrc}
            alt="GBHS Douala"
            referrerPolicy="no-referrer"
            className="h-8 w-8 shrink-0 rounded-xl border border-[#2c3240] bg-white p-0.5 object-contain"
          />
          <span className="font-script truncate text-2xl leading-none font-bold text-[#f1f3f4]">
            {t.appName}
          </span>
        </div>

        {/* Compact Icon-Only Desktop Header Links */}
        <nav aria-label="Portal links" className="hidden items-center gap-1.5 md:flex">
          <button
            type="button"
            onClick={scrollToCampus}
            title={t.footerCampusLink}
            aria-label={t.footerCampusLink}
            className="inline-flex items-center justify-center rounded-xl p-2 text-[#9aa0a6] transition-colors hover:bg-[#171b24] hover:text-[#8ab4f8]"
          >
            <Building2 className="h-4 w-4 shrink-0" />
          </button>
          <button
            type="button"
            onClick={() => fillPreset('head_teacher')}
            title={t.footerAdminLink}
            aria-label={t.footerAdminLink}
            className="inline-flex items-center justify-center rounded-xl p-2 text-[#9aa0a6] transition-colors hover:bg-[#171b24] hover:text-[#8ab4f8]"
          >
            <ShieldCheck className="h-4 w-4 shrink-0" />
          </button>
          <button
            type="button"
            onClick={() => fillPreset('teacher')}
            title={t.footerFacultyLink}
            aria-label={t.footerFacultyLink}
            className="inline-flex items-center justify-center rounded-xl p-2 text-[#9aa0a6] transition-colors hover:bg-[#171b24] hover:text-[#8ab4f8]"
          >
            <GraduationCap className="h-4 w-4 shrink-0" />
          </button>
        </nav>

        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={onToggleElectrons}
            title={electronsEnabled ? t.electronsOn : t.electronsOff}
            aria-label={electronsEnabled ? t.electronsOn : t.electronsOff}
            className={`hidden items-center justify-center rounded-xl border p-2 transition-colors sm:inline-flex ${
              electronsEnabled
                ? 'border-[#33415c] bg-[#161e2e] text-[#8ab4f8]'
                : 'border-[#242936] bg-[#13161d] text-[#7f8794]'
            }`}
          >
            <Atom className="h-4 w-4" />
          </button>

          <div className="flex items-center gap-0.5 rounded-xl border border-[#242936] bg-[#13161d] p-0.5">
            <Languages className="ml-1.5 hidden h-3.5 w-3.5 text-[#8ab4f8] sm:block" />
            <button
              type="button"
              onClick={() => onChangeLang('en')}
              className={`whitespace-nowrap rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
                lang === 'en' ? 'bg-[#232836] text-[#8ab4f8]' : 'text-[#9aa0a6] hover:text-[#e8eaed]'
              }`}
            >
              EN
            </button>
            <button
              type="button"
              onClick={() => onChangeLang('fr')}
              className={`whitespace-nowrap rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
                lang === 'fr' ? 'bg-[#232836] text-[#8ab4f8]' : 'text-[#9aa0a6] hover:text-[#e8eaed]'
              }`}
            >
              FR
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Hamburger Dropdown Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-20 border-b border-[#242936] bg-[#101319]/95 px-4 py-3 backdrop-blur-md md:hidden"
          >
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={scrollToCampus}
                className="flex items-center gap-2 rounded-xl border border-[#242936] bg-[#151922] px-3 py-2 text-xs font-medium text-[#e8eaed]"
              >
                <Building2 className="h-4 w-4 text-[#8ab4f8]" />
                <span className="truncate">{t.footerCampusLink}</span>
              </button>
              <button
                type="button"
                onClick={() => fillPreset('head_teacher')}
                className="flex items-center gap-2 rounded-xl border border-[#242936] bg-[#151922] px-3 py-2 text-xs font-medium text-[#e8eaed]"
              >
                <ShieldCheck className="h-4 w-4 text-[#8ab4f8]" />
                <span className="truncate">{t.footerAdminLink}</span>
              </button>
              <button
                type="button"
                onClick={() => fillPreset('teacher')}
                className="flex items-center gap-2 rounded-xl border border-[#242936] bg-[#151922] px-3 py-2 text-xs font-medium text-[#e8eaed]"
              >
                <GraduationCap className="h-4 w-4 text-[#8ab4f8]" />
                <span className="truncate">{t.footerFacultyLink}</span>
              </button>
              <button
                type="button"
                onClick={onToggleElectrons}
                className="flex items-center gap-2 rounded-xl border border-[#242936] bg-[#151922] px-3 py-2 text-xs font-medium text-[#e8eaed]"
              >
                <Atom className="h-4 w-4 text-[#8ab4f8]" />
                <span className="truncate">
                  {electronsEnabled ? t.electronsOn : t.electronsOff}
                </span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 items-center px-4 py-10">
        <div className="grid w-full grid-cols-1 items-stretch gap-8 lg:grid-cols-12">
          {/* Left Campus Showcase Column */}
          <motion.div
            ref={campusRef}
            initial={{ opacity: 0, x: -14 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="studio-surface relative hidden overflow-hidden rounded-2xl border border-[#242936] bg-[#13161d] lg:col-span-7 lg:flex lg:flex-col lg:justify-end"
          >
            {!campusFailed ? (
              <img
                src={SCHOOL_ASSETS.campusCourtyard}
                alt="GBHS Douala Campus"
                referrerPolicy="no-referrer"
                onError={() => setCampusFailed(true)}
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 hover:scale-[1.02]"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#12192b] via-[#0d111a] to-[#162238]">
                <Atom className="h-16 w-16 text-[#8ab4f8]/30" />
              </div>
            )}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0b0d12] via-[#0b0d12]/65 to-transparent" />
            <div className="relative z-10 p-8">
              <div className="flex items-center gap-4">
                <img
                  src={logoSrc}
                  alt="GBHS Douala Crest"
                  referrerPolicy="no-referrer"
                  className="h-16 w-16 rounded-2xl border border-white/25 bg-white p-1 object-contain shadow-lg"
                />
                <div>
                  <h2 className="font-script text-4xl leading-none font-bold text-white">
                    {school ? (lang === 'fr' ? school.nameFr : school.nameEn) : 'GBHS Douala'}
                  </h2>
                  <p className="mt-1 text-sm font-medium text-[#d2e3fc]">
                    {lang === 'fr' ? 'Établissement Bilingue' : 'Bilingual Academy'} · {school?.city || 'Douala'}
                  </p>
                </div>
              </div>
              <p className="mt-4 max-w-lg text-sm leading-relaxed text-[#d2d6dc]">
                {lang === 'fr'
                  ? 'Plateforme numérique officielle de saisie des notes, gestion des coefficients et édition des bulletins bilingues.'
                  : 'Official academic platform for subject marks entry, coefficient tracking, and bilingual report card printing.'}
              </p>
            </div>
          </motion.div>

          {/* Right Login Studio Column */}
          <motion.div
            initial={{ opacity: 0, x: 14 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.28, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col justify-center space-y-5 lg:col-span-5"
          >
            <div className="flex flex-col items-center text-center lg:items-start lg:text-left">
              <div className="mb-3 flex items-center gap-3 lg:hidden">
                <img
                  src={logoSrc}
                  alt="GBHS Douala"
                  referrerPolicy="no-referrer"
                  className="h-14 w-14 rounded-2xl border border-[#2a303f] bg-white p-1 object-contain"
                />
              </div>
              <h1 className="font-script text-4xl leading-tight font-bold text-[#f1f3f4]">
                {school ? (lang === 'fr' ? school.nameFr : school.nameEn) : t.appName}
              </h1>
              <p className="mt-1 text-sm text-[#9aa0a6]">{t.portalSubtitle}</p>
            </div>

            <div className="studio-surface rounded-2xl border border-[#272c38] bg-[#13161d]/90 p-6 backdrop-blur-md">
              <h2 className="font-display text-base font-semibold text-[#f1f3f4]">
                {t.signInTitle}
              </h2>
              <p className="mt-1 text-xs text-[#9aa0a6]">{t.signInDesc}</p>

              {sessionNotice && !error && (
                <div
                  role="status"
                  className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-xs font-medium text-amber-200"
                >
                  {sessionNotice}
                </div>
              )}

              {error && (
                <div
                  role="alert"
                  className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-xs font-medium text-red-300"
                >
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="mt-5 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-[#bdc1c6]">
                    {t.usernameOrEmail}
                  </label>
                  <input
                    ref={formInputRef}
                    type="text"
                    required
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="headteacher or m.mbarga"
                    className="mt-1.5 w-full rounded-xl border border-[#2c3240] bg-[#0d1016] px-3.5 py-2.5 text-sm text-[#e8eaed] placeholder-[#68707d] outline-none transition-colors focus:border-[#8ab4f8]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#bdc1c6]">{t.password}</label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="mt-1.5 w-full rounded-xl border border-[#2c3240] bg-[#0d1016] px-3.5 py-2.5 text-sm text-[#e8eaed] placeholder-[#68707d] outline-none transition-colors focus:border-[#8ab4f8]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#8ab4f8] px-4 py-2.5 text-sm font-semibold text-[#0b0d12] transition-all duration-150 hover:bg-[#a8c7fa] active:scale-[0.99] disabled:opacity-60"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <LogIn className="h-4 w-4" />
                  )}
                  {loading ? t.signingIn : t.signIn}
                </button>
              </form>
            </div>

            <div className="studio-surface rounded-2xl border border-[#242936] bg-[#13161d]/85 p-4 text-xs text-[#9aa0a6] backdrop-blur-md">
              <div className="flex items-center gap-2 font-semibold text-[#e8eaed]">
                <KeyRound className="h-3.5 w-3.5 text-[#8ab4f8]" />
                <span>{t.quickAccessTitle}</span>
              </div>
              <div className="mt-3 space-y-2">
                <div className="flex items-center justify-between gap-3 border-t border-[#222733] pt-2">
                  <div className="min-w-0 truncate">
                    <span className="font-medium text-[#e8eaed]">{t.headTeacherLabel}</span>
                    <span className="mx-1.5 text-[#5f6368]">·</span>
                    <span className="font-mono-num text-[#9aa0a6]">headteacher / admin1234</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => fillPreset('head_teacher')}
                    className="shrink-0 whitespace-nowrap rounded-lg border border-[#2e3444] bg-[#1a1f2b] px-2.5 py-1 text-xs font-medium text-[#8ab4f8] transition-colors hover:bg-[#232938]"
                  >
                    {t.useCredentials}
                  </button>
                </div>
                <div className="flex items-center justify-between gap-3 border-t border-[#222733] pt-2">
                  <div className="min-w-0 truncate">
                    <span className="font-medium text-[#e8eaed]">{t.teacherLabel}</span>
                    <span className="mx-1.5 text-[#5f6368]">·</span>
                    <span className="font-mono-num text-[#9aa0a6]">m.mbarga / teacher123</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => fillPreset('teacher')}
                    className="shrink-0 whitespace-nowrap rounded-lg border border-[#2e3444] bg-[#1a1f2b] px-2.5 py-1 text-xs font-medium text-[#8ab4f8] transition-colors hover:bg-[#232938]"
                  >
                    {t.useCredentials}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </main>

      <AppFooter
        mode="login"
        lang={lang}
        school={school}
        electronsEnabled={electronsEnabled}
        onToggleElectrons={onToggleElectrons}
        onChangeLang={onChangeLang}
        onQuickRoleFill={fillPreset}
        onScrollToCampus={scrollToCampus}
      />
    </div>
  );
}
