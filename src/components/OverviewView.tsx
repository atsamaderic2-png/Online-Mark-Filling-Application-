import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowUpRight, ClipboardEdit, FileText } from 'lucide-react';
import { api } from '../api';
import { SCHOOL_ASSETS } from '../constants/assets';
import { translations } from '../i18n';
import type { Language } from '../types';

interface OverviewViewProps {
  lang: Language;
  onNavigate: (tab: string) => void;
}

function AnimatedNumber({ value }: { value: number }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    let frame = 0;
    const start = performance.now();
    const duration = 420;
    function step(now: number) {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(value * eased));
      if (progress < 1) {
        frame = requestAnimationFrame(step);
      }
    }
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return <span>{display}</span>;
}

export function OverviewView({ lang, onNavigate }: OverviewViewProps) {
  const t = translations[lang];
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<Awaited<ReturnType<typeof api.getOverview>> | null>(null);
  const [courtyardError, setCourtyardError] = useState(false);
  const [studyError, setStudyError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .getOverview()
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load overview');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div key={idx} className="h-24 animate-pulse rounded-2xl border border-[#242936] bg-[#13161d]" />
          ))}
        </div>
        <div className="h-64 animate-pulse rounded-2xl border border-[#242936] bg-[#13161d]" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
        {error ?? 'Error'}
      </div>
    );
  }

  const counts = data.counts;
  const metrics = [
    { label: t.sectionsCount, value: counts?.sectionsCount ?? 0, tab: 'structure' },
    { label: t.classesCount, value: counts?.classesCount ?? 0, tab: 'structure' },
    { label: t.studentsCount, value: counts?.studentsCount ?? 0, tab: 'students' },
    { label: t.subjectsCount, value: counts?.subjectsCount ?? 0, tab: 'subjects' },
    { label: t.teachersCount, value: counts?.teachersCount ?? 0, tab: 'teachers' },
    { label: t.assignmentsCount, value: counts?.assignmentsCount ?? 0, tab: 'assignments' },
  ];

  const termLabel = data.activeTerm === 1 ? t.term1 : data.activeTerm === 2 ? t.term2 : t.term3;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-[#f1f3f4]">
            {t.overviewTitle}
          </h1>
          <p className="mt-1 text-sm text-[#9aa0a6]">{t.overviewDesc}</p>
        </div>
        <div className="text-xs text-[#9aa0a6]">
          <span>{t.activeTermLabel}</span>
          <span className="mx-2 text-[#4c5464]">·</span>
          <span className="font-semibold text-[#8ab4f8]">{termLabel}</span>
        </div>
      </div>

      {/* Institutional Campus & Academic Heritage Strip */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          className="studio-surface group relative min-h-[180px] overflow-hidden rounded-2xl border border-[#242936] bg-[#13161d] lg:col-span-7"
        >
          {!courtyardError && (
            <img
              src={SCHOOL_ASSETS.campusCourtyard}
              alt="GBHS Douala Campus Courtyard"
              referrerPolicy="no-referrer"
              onError={() => setCourtyardError(true)}
              className="h-full max-h-56 w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            />
          )}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0b0d12] via-[#0b0d12]/45 to-transparent" />
          <div className="absolute right-0 bottom-0 left-0 flex items-center gap-3 p-4">
            <img
              src={SCHOOL_ASSETS.defaultLogo}
              alt="GBHS Douala School Logo"
              referrerPolicy="no-referrer"
              className="h-12 w-12 rounded-xl border border-white/25 bg-white p-0.5 object-contain"
            />
            <div>
              <p className="flex items-baseline gap-2 text-white">
                <span className="font-script text-2xl leading-none font-bold">GBHS Douala</span>
                <span className="font-display text-xs font-semibold text-[#d2e3fc]">
                  · {lang === 'fr' ? 'Établissement Bilingue' : 'Bilingual Academy'}
                </span>
              </p>
              <p className="mt-0.5 text-xs text-[#d2e3fc]">
                {lang === 'fr' ? 'Douala, Cameroun' : 'Douala, Cameroon'}
              </p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
          className="studio-surface group relative min-h-[180px] overflow-hidden rounded-2xl border border-[#242936] bg-[#13161d] lg:col-span-5"
        >
          {!studyError && (
            <img
              src={SCHOOL_ASSETS.campusStudy}
              alt="GBHS Douala Academic Study Hall"
              referrerPolicy="no-referrer"
              onError={() => setStudyError(true)}
              className="h-full max-h-56 w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            />
          )}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0b0d12] via-[#0b0d12]/45 to-transparent" />
          <div className="absolute right-0 bottom-0 left-0 p-4">
            <p className="font-display text-sm font-semibold text-white">
              {lang === 'fr'
                ? 'Sections Anglophone, Francophone & Technique'
                : 'Anglophone, Francophone & Technical Sections'}
            </p>
            <p className="mt-0.5 text-xs text-[#bdc1c6]">
              {lang === 'fr'
                ? 'Suivi des coefficients et édition des bulletins officiels'
                : 'Weighted coefficient grading and bilingual PDF bulletins'}
            </p>
          </div>
        </motion.div>
      </div>

      {/* Studio KPI Strip */}
      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-6">
        {metrics.map((m, idx) => (
          <motion.button
            key={m.label}
            type="button"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18, delay: idx * 0.03, ease: [0.16, 1, 0.3, 1] }}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.99 }}
            onClick={() => onNavigate(m.tab)}
            className="group rounded-2xl border border-[#242936] bg-[#13161d]/90 p-4 text-left backdrop-blur-sm transition-colors hover:border-[#3c4f73] hover:bg-[#191d27]"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-[#9aa0a6]">{m.label}</p>
              <ArrowUpRight className="h-3.5 w-3.5 text-[#5f6368] transition-transform duration-150 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-[#8ab4f8]" />
            </div>
            <p className="font-mono-num mt-2 text-2xl font-semibold text-[#f1f3f4]">
              <AnimatedNumber value={m.value} />
            </p>
          </motion.button>
        ))}
      </div>

      {/* Term Completion Table */}
      <div className="overflow-hidden rounded-2xl border border-[#242936] bg-[#13161d]/90 backdrop-blur-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#222733] px-5 py-4">
          <h2 className="font-display text-base font-semibold text-[#f1f3f4]">
            {t.termCompletionTitle} ({termLabel})
          </h2>
          <button
            type="button"
            onClick={() => onNavigate('reports')}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl bg-[#8ab4f8] px-3.5 py-2 text-xs font-semibold text-[#0b0d12] transition-colors hover:bg-[#a8c7fa]"
          >
            <FileText className="h-3.5 w-3.5" />
            {t.navReports}
          </button>
        </div>

        <div className="studio-table-wrap overflow-x-auto">
          <table className="studio-table text-left text-sm">
            <thead>
              <tr className="bg-[#0e1117] text-xs font-semibold text-[#9aa0a6]">
                <th className="px-4 py-3">{t.classCol}</th>
                <th className="px-4 py-3">{t.sectionCol}</th>
                <th className="px-4 py-3 text-right">{t.studentsCol}</th>
                <th className="px-4 py-3 text-right">{t.subjectsCol}</th>
                <th className="px-4 py-3 text-right">{t.marksEnteredCol}</th>
                <th className="px-4 py-3 text-right">{t.completionCol}</th>
                <th className="px-4 py-3 text-right">{t.actions}</th>
              </tr>
            </thead>
            <tbody>
              {(data.classProgress ?? []).map((row) => {
                const expected = row.studentCount * row.subjectCount;
                const pct = expected > 0 ? Math.min(100, Math.round((row.marksCount / expected) * 100)) : 0;
                return (
                  <tr key={row.classId} className="transition-colors hover:bg-[#191d27]">
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-[#f1f3f4]">
                      {row.className}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-[#9aa0a6]">
                      {lang === 'fr' ? row.sectionNameFr : row.sectionNameEn}
                    </td>
                    <td className="font-mono-num px-4 py-3 text-right text-[#bdc1c6]">
                      {row.studentCount}
                    </td>
                    <td className="font-mono-num px-4 py-3 text-right text-[#bdc1c6]">
                      {row.subjectCount}
                    </td>
                    <td className="font-mono-num px-4 py-3 text-right text-[#bdc1c6]">
                      {row.marksCount} / {expected}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-3">
                        <div className="h-2 w-24 overflow-hidden rounded-full bg-[#222733]">
                          <motion.div
                            initial={{ scaleX: 0 }}
                            animate={{ scaleX: pct / 100 }}
                            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                            style={{ transformOrigin: 'left' }}
                            className={`h-full w-full ${
                              pct === 100 ? 'bg-[#81c995]' : 'bg-[#8ab4f8]'
                            }`}
                          />
                        </div>
                        <span className="font-mono-num w-10 text-right text-xs font-semibold text-[#e8eaed]">
                          {pct}%
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => onNavigate('marks')}
                          title={t.navMarks}
                          className="inline-flex items-center gap-1 rounded-xl border border-[#2c3240] bg-[#161a23] px-2 py-1 text-xs font-medium text-[#8ab4f8] transition-colors hover:border-[#3c4f73] hover:bg-[#1e2536]"
                        >
                          <ClipboardEdit className="h-3 w-3" />
                          <span className="hidden sm:inline">{t.navMarks}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onNavigate('reports')}
                          title={t.navReports}
                          className="inline-flex items-center gap-1 rounded-xl border border-[#2c3240] bg-[#161a23] px-2 py-1 text-xs font-medium text-[#e8eaed] transition-colors hover:border-[#3c4f73] hover:bg-[#1e2536]"
                        >
                          <FileText className="h-3 w-3 text-[#8ab4f8]" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {(data.classProgress ?? []).length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-[#9aa0a6]">
                    {t.noClassesInSection}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
