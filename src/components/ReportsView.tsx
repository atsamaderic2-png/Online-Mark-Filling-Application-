import { useEffect, useMemo, useState } from 'react';
import { Award, BarChart3, CheckSquare, Download, Loader2, Printer } from 'lucide-react';
import { api } from '../api';
import { formatRank, translations } from '../i18n';
import type {
  ClassItem,
  ClassReportBundle,
  Language,
  ReportPeriod,
  SectionItem,
  UserRole,
} from '../types';
import { exportClassReportCardsPdf, exportClassSummaryPdf } from '../utils/pdfExport';
import { ReportCardSheet } from './ReportCardSheet';

interface GradeBand {
  id: string;
  label: string;
  tier: 'support' | 'pass' | 'honours';
  min: number;
  max: number;
  inclusiveMax?: boolean;
  students: Array<{ studentId: string; fullName: string; score: number }>;
}

export function ReportsView({
  lang,
  role = 'head_teacher',
  defaultTerm,
}: {
  lang: Language;
  role?: UserRole;
  defaultTerm: 1 | 2 | 3;
}) {
  const t = translations[lang];
  const [sections, setSections] = useState<SectionItem[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [assignedSubjectIds, setAssignedSubjectIds] = useState<Set<string>>(new Set());
  const [selectedClassId, setSelectedClassId] = useState('');
  const [term, setTerm] = useState<1 | 2 | 3>(defaultTerm);
  const [period, setPeriod] = useState<ReportPeriod>('term');
  const [bundle, setBundle] = useState<ClassReportBundle | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [checkedStudentIds, setCheckedStudentIds] = useState<Set<string>>(new Set());
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [activeBandId, setActiveBandId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api.getSections(),
      api.getClasses(),
      role === 'teacher' ? api.getTeacherSlots(defaultTerm) : Promise.resolve(null),
    ])
      .then(([secRes, clsRes, teacherSlots]) => {
        if (cancelled) return;
        setSections(secRes);
        let availableClasses = clsRes;
        if (role === 'teacher' && teacherSlots) {
          const allowedClassIds = new Set(teacherSlots.map((s) => s.classId));
          setAssignedSubjectIds(new Set(teacherSlots.map((s) => s.subjectId)));
          availableClasses = clsRes.filter((c) => allowedClassIds.has(c.id));
        }
        setClasses(availableClasses);
        if (availableClasses[0]) setSelectedClassId(availableClasses[0].id);
        else setLoading(false);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load classes');
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [role, defaultTerm]);

  useEffect(() => {
    if (!selectedClassId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .getClassReportCards(selectedClassId, term, period)
      .then((res) => {
        if (cancelled) return;
        setBundle(res);
        setSelectedStudentId((prev) =>
          prev && res.cards.some((c) => c.student.id === prev)
            ? prev
            : (res.cards[0]?.student.id ?? '')
        );
        const validIds = new Set(res.cards.map((c) => c.student.id));
        setCheckedStudentIds((prev) => {
          const retained = new Set<string>();
          prev.forEach((id) => {
            if (validIds.has(id)) retained.add(id);
          });
          return retained;
        });
        const classSubjects = res.cards[0]?.subjects ?? [];
        setSelectedSubjectId((prev) => {
          if (prev && classSubjects.some((s) => s.subjectId === prev)) return prev;
          if (role === 'teacher' && assignedSubjectIds.size > 0) {
            const preferred = classSubjects.find((s) => assignedSubjectIds.has(s.subjectId));
            if (preferred) return preferred.subjectId;
          }
          return classSubjects[0]?.subjectId ?? '';
        });
        setActiveBandId(null);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load report cards');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedClassId, term, period, role, assignedSubjectIds]);

  async function handleDownloadAll() {
    if (!bundle || bundle.cards.length === 0) return;
    setExporting(true);
    try {
      await exportClassReportCardsPdf(bundle, lang);
    } finally {
      setExporting(false);
    }
  }

  async function handleDownloadSelected() {
    if (!bundle || checkedStudentIds.size === 0) return;
    setExporting(true);
    try {
      await exportClassReportCardsPdf(bundle, lang, Array.from(checkedStudentIds));
    } finally {
      setExporting(false);
    }
  }

  async function handleDownloadSingle() {
    if (!bundle || !selectedStudentId) return;
    setExporting(true);
    try {
      await exportClassReportCardsPdf(bundle, lang, selectedStudentId);
    } finally {
      setExporting(false);
    }
  }

  async function handleDownloadSummary() {
    if (!bundle || bundle.cards.length === 0) return;
    setExporting(true);
    try {
      await exportClassSummaryPdf(bundle, lang);
    } finally {
      setExporting(false);
    }
  }

  function toggleStudentChecked(studentId: string) {
    setCheckedStudentIds((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      return next;
    });
  }

  function toggleSelectAll() {
    if (!bundle) return;
    if (checkedStudentIds.size === bundle.cards.length) {
      setCheckedStudentIds(new Set());
    } else {
      setCheckedStudentIds(new Set(bundle.cards.map((c) => c.student.id)));
    }
  }

  function selectHonoursStudents() {
    if (!bundle) return;
    const honoursIds = bundle.cards
      .filter((c) => c.honourRoll || (c.average !== null && c.average >= 12))
      .map((c) => c.student.id);
    setCheckedStudentIds(new Set(honoursIds));
  }

  function clearSelection() {
    setCheckedStudentIds(new Set());
  }

  const sectionMap = new Map(sections.map((s) => [s.id, s]));
  const previewCard = bundle?.cards.find((c) => c.student.id === selectedStudentId) ?? null;
  const selectedCount = checkedStudentIds.size;
  const cardsForPrint = useMemo(() => {
    if (!bundle) return [];
    if (checkedStudentIds.size === 0) return bundle.cards;
    return bundle.cards.filter((c) => checkedStudentIds.has(c.student.id));
  }, [bundle, checkedStudentIds]);

  const rankedCards = useMemo(() => {
    if (!bundle) return [];
    return [...bundle.cards].sort((a, b) => {
      if (a.average === null && b.average === null) {
        return a.student.fullName.localeCompare(b.student.fullName);
      }
      if (a.average === null) return 1;
      if (b.average === null) return -1;
      return b.average - a.average;
    });
  }, [bundle]);

  const subjectAverages = useMemo(() => {
    const first = bundle?.cards[0];
    if (!first) return [];
    return first.subjects.map((sub) => ({
      id: sub.subjectId,
      code: sub.code,
      name: lang === 'fr' ? sub.nameFr : sub.nameEn,
      avg: sub.classSubjectAverage,
      min: sub.subjectLowest,
      max: sub.subjectHighest,
      teacherName: sub.teacherName,
    }));
  }, [bundle, lang]);

  // Subject Grade Distribution Histogram calculation
  const histogramData = useMemo(() => {
    const activeSubjectMeta = subjectAverages.find((s) => s.id === selectedSubjectId) ?? null;
    const bands: GradeBand[] = [
      { id: '0-5', label: '0–5', tier: 'support', min: 0, max: 5, students: [] },
      { id: '5-8', label: '5–8', tier: 'support', min: 5, max: 8, students: [] },
      { id: '8-10', label: '8–10', tier: 'support', min: 8, max: 10, students: [] },
      { id: '10-12', label: '10–12', tier: 'pass', min: 10, max: 12, students: [] },
      { id: '12-14', label: '12–14', tier: 'honours', min: 12, max: 14, students: [] },
      { id: '14-16', label: '14–16', tier: 'honours', min: 14, max: 16, students: [] },
      {
        id: '16-20',
        label: '16–20',
        tier: 'honours',
        min: 16,
        max: 20,
        inclusiveMax: true,
        students: [],
      },
    ];

    if (!bundle || !selectedSubjectId) {
      return {
        meta: activeSubjectMeta,
        bands,
        gradedCount: 0,
        median: null as number | null,
        passCount: 0,
        passPct: null as number | null,
        honoursCount: 0,
        honoursPct: null as number | null,
        maxBandCount: 1,
      };
    }

    const numericScores: number[] = [];
    for (const card of bundle.cards) {
      const subLine = card.subjects.find((s) => s.subjectId === selectedSubjectId);
      if (!subLine || subLine.score === null) continue;
      const val = subLine.score;
      numericScores.push(val);
      for (const b of bands) {
        const matchesUpper = b.inclusiveMax ? val <= b.max : val < b.max;
        if (val >= b.min && matchesUpper) {
          b.students.push({
            studentId: card.student.id,
            fullName: card.student.fullName,
            score: val,
          });
          break;
        }
      }
    }

    for (const b of bands) {
      b.students.sort((a, bStu) => bStu.score - a.score);
    }

    const sorted = [...numericScores].sort((a, b) => a - b);
    const median =
      sorted.length === 0
        ? null
        : sorted.length % 2 === 1
          ? sorted[Math.floor(sorted.length / 2)]
          : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
    const passCount = numericScores.filter((s) => s >= 10).length;
    const honoursCount = numericScores.filter((s) => s >= 12).length;
    const maxBandCount = Math.max(1, ...bands.map((b) => b.students.length));

    return {
      meta: activeSubjectMeta,
      bands,
      gradedCount: numericScores.length,
      median,
      passCount,
      passPct: numericScores.length > 0 ? Math.round((passCount / numericScores.length) * 100) : null,
      honoursCount,
      honoursPct:
        numericScores.length > 0 ? Math.round((honoursCount / numericScores.length) * 100) : null,
      maxBandCount,
    };
  }, [bundle, selectedSubjectId, subjectAverages]);

  const inspectedBand = useMemo(
    () => histogramData.bands.find((b) => b.id === activeBandId) ?? null,
    [histogramData.bands, activeBandId]
  );

  return (
    <div className="space-y-6">
      <div className="no-print flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-[#f1f3f4]">
            {t.reportsTitle}
          </h1>
          <p className="mt-1 text-sm text-[#9aa0a6]">{t.reportsDesc}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={exporting || !bundle || bundle.cards.length === 0 || !selectedStudentId}
            onClick={handleDownloadSingle}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-[#3c4f73] bg-[#182133] px-3.5 py-2 text-xs font-semibold text-[#8ab4f8] hover:bg-[#1f2b42] disabled:opacity-50"
          >
            {exporting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            {t.downloadAsPdf}
          </button>
          <button
            type="button"
            disabled={exporting || !bundle || selectedCount === 0}
            onClick={handleDownloadSelected}
            className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl px-3.5 py-2 text-xs font-semibold transition-colors disabled:opacity-45 ${
              selectedCount > 0
                ? 'bg-[#8ab4f8] text-[#0b0d12] hover:bg-[#a8c7fa]'
                : 'border border-[#2c3240] bg-[#161a23] text-[#9aa0a6]'
            }`}
          >
            {exporting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <CheckSquare className="h-3.5 w-3.5" />
            )}
            {t.downloadSelectedPdf} ({selectedCount})
          </button>
          <button
            type="button"
            disabled={exporting || !bundle || bundle.cards.length === 0}
            onClick={handleDownloadSummary}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-[#2c3240] bg-[#161a23] px-3.5 py-2 text-xs font-semibold text-[#e8eaed] hover:bg-[#1e2430] disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" />
            {t.downloadClassSummaryPdf}
          </button>
          <button
            type="button"
            disabled={!bundle || bundle.cards.length === 0}
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-[#2c3240] bg-[#161a23] px-3.5 py-2 text-xs font-semibold text-[#e8eaed] hover:bg-[#1e2430] disabled:opacity-50"
          >
            <Printer className="h-3.5 w-3.5" />
            {selectedCount > 0
              ? `${t.printSelected} (${selectedCount})`
              : `${t.printClass} (${bundle?.cards.length ?? 0})`}
          </button>
          <button
            type="button"
            disabled={exporting || !bundle || bundle.cards.length === 0}
            onClick={handleDownloadAll}
            className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl px-4 py-2 text-xs font-semibold transition-colors disabled:opacity-50 ${
              selectedCount > 0
                ? 'border border-[#2c3240] bg-[#161a23] text-[#e8eaed] hover:bg-[#1e2430]'
                : 'bg-[#8ab4f8] text-[#0b0d12] hover:bg-[#a8c7fa]'
            }`}
          >
            {exporting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            {exporting ? t.generatingPdf : t.downloadAllPdf}
          </button>
        </div>
      </div>

      {error && (
        <div className="no-print rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs font-medium text-red-300">
          {error}
        </div>
      )}

      {/* Controls Bar: Class, Term, and Period (Whole Term vs Sequence 1 vs Sequence 2) */}
      <div className="no-print flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#242936] bg-[#13161d]/90 p-4 backdrop-blur-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-[#bdc1c6]">{t.selectClass}:</label>
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="rounded-xl border border-[#2c3240] bg-[#0d1016] px-3 py-2 text-sm font-medium text-[#e8eaed] outline-none focus:border-[#8ab4f8]"
            >
              {classes.map((c) => {
                const sec = sectionMap.get(c.sectionId);
                return (
                  <option key={c.id} value={c.id}>
                    {c.name} ({sec ? (lang === 'fr' ? sec.nameFr : sec.nameEn) : ''})
                  </option>
                );
              })}
            </select>
          </div>

          <div className="flex items-center gap-1 rounded-xl border border-[#242936] bg-[#0d1016] p-1">
            {([1, 2, 3] as const).map((tNum) => (
              <button
                key={tNum}
                type="button"
                onClick={() => setTerm(tNum)}
                className={`whitespace-nowrap rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors ${
                  term === tNum ? 'bg-[#232836] text-[#8ab4f8]' : 'text-[#9aa0a6] hover:text-[#e8eaed]'
                }`}
              >
                {tNum === 1 ? t.term1 : tNum === 2 ? t.term2 : t.term3}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 rounded-xl border border-[#242936] bg-[#0d1016] p-1">
            {(
              [
                { id: 'term', label: t.reportPeriodTerm },
                { id: 'seq1', label: t.reportPeriodSeq1 },
                { id: 'seq2', label: t.reportPeriodSeq2 },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setPeriod(opt.id)}
                className={`whitespace-nowrap rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors ${
                  period === opt.id
                    ? 'bg-[#1b2b44] text-[#8ab4f8]'
                    : 'text-[#9aa0a6] hover:text-[#e8eaed]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Class Summary + Subject Averages Breakdown */}
      {bundle && (
        <div className="no-print grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="grid grid-cols-2 gap-3 lg:col-span-5">
            <div className="rounded-2xl border border-[#242936] bg-[#13161d]/90 p-4">
              <p className="text-xs text-[#9aa0a6]">{t.classAverage}</p>
              <p className="font-mono-num mt-1 text-xl font-bold text-[#8ab4f8]">
                {bundle.summary.classAverage !== null
                  ? `${bundle.summary.classAverage.toFixed(2)} / 20`
                  : '—'}
              </p>
            </div>
            <div className="rounded-2xl border border-[#242936] bg-[#13161d]/90 p-4">
              <p className="text-xs text-[#9aa0a6]">{t.passRate}</p>
              <p className="font-mono-num mt-1 text-xl font-bold text-[#81c995]">
                {bundle.summary.passRate !== null ? `${bundle.summary.passRate}%` : '—'}
              </p>
            </div>
            <div className="rounded-2xl border border-[#242936] bg-[#13161d]/90 p-4">
              <p className="text-xs text-[#9aa0a6]">{t.highestAverage}</p>
              <p className="font-mono-num mt-1 text-lg font-bold text-[#f1f3f4]">
                {bundle.summary.highestAverage !== null
                  ? `${bundle.summary.highestAverage.toFixed(2)} / 20`
                  : '—'}
              </p>
              <p className="mt-0.5 text-[11px] text-[#7f8794]">
                {t.lowestAverage}:{' '}
                <span className="font-mono-num text-[#bdc1c6]">
                  {bundle.summary.lowestAverage !== null
                    ? `${bundle.summary.lowestAverage.toFixed(2)}`
                    : '—'}
                </span>
              </p>
            </div>
            <div className="rounded-2xl border border-[#242936] bg-[#13161d]/90 p-4">
              <p className="text-xs text-[#9aa0a6]">{t.honorRollCountLabel}</p>
              <p className="font-mono-num mt-1 inline-flex items-center gap-1.5 text-xl font-bold text-amber-300">
                <Award className="h-4 w-4 shrink-0" />
                {bundle.summary.honorRollCount}/{bundle.summary.studentCount}
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-[#242936] bg-[#13161d]/90 p-4 lg:col-span-7">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-[#bdc1c6]">{t.subjectBreakdown}</p>
              <span className="text-[11px] text-[#7f8794]">{t.clickBarHint}</span>
            </div>
            <div className="mt-3 space-y-1.5">
              {subjectAverages.map((item) => {
                const pct = item.avg !== null ? Math.min(100, (item.avg / 20) * 100) : 0;
                const isSelected = item.id === selectedSubjectId;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setSelectedSubjectId(item.id);
                      setActiveBandId(null);
                    }}
                    className={`flex w-full items-center gap-3 rounded-xl px-2 py-1 text-left text-xs transition-colors ${
                      isSelected ? 'bg-[#1a2438]' : 'hover:bg-[#191d27]'
                    }`}
                  >
                    <span
                      className={`w-36 truncate ${
                        isSelected ? 'font-semibold text-[#8ab4f8]' : 'text-[#bdc1c6]'
                      }`}
                    >
                      {item.name}
                    </span>
                    <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-[#222733]">
                      <div
                        className={`h-full rounded-full transition-all duration-200 ${
                          item.avg !== null && item.avg >= 10 ? 'bg-[#8ab4f8]' : 'bg-[#f28b82]/80'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="font-mono-num w-12 text-right font-semibold text-[#f1f3f4]">
                      {item.avg !== null ? `${item.avg.toFixed(2)}` : '—'}
                    </span>
                    <span className="font-mono-num hidden w-20 text-right text-[11px] text-[#7f8794] sm:inline">
                      {item.min !== null && item.max !== null
                        ? `${item.min.toFixed(1)}–${item.max.toFixed(1)}`
                        : '—'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Subject Grade Distribution Histogram Visualization */}
      {bundle && subjectAverages.length > 0 && (
        <section
          aria-label={t.subjectHistogramTitle}
          className="no-print rounded-2xl border border-[#242936] bg-[#13161d]/90 p-5 backdrop-blur-sm"
        >
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#222733] pb-4">
            <div>
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-[#8ab4f8]" />
                <h2 className="font-display text-base font-semibold text-[#f1f3f4]">
                  {t.subjectHistogramTitle}
                </h2>
              </div>
              <p className="mt-1 text-xs text-[#9aa0a6]">{t.subjectHistogramDesc}</p>
            </div>

            <div className="flex items-center gap-2">
              <label
                htmlFor="histogram-subject-select"
                className="text-xs font-semibold text-[#bdc1c6]"
              >
                {t.selectSubjectHistogram}:
              </label>
              <select
                id="histogram-subject-select"
                value={selectedSubjectId}
                onChange={(e) => {
                  setSelectedSubjectId(e.target.value);
                  setActiveBandId(null);
                }}
                className="rounded-xl border border-[#2c3240] bg-[#0d1016] px-3 py-2 text-xs font-semibold text-[#e8eaed] outline-none focus:border-[#8ab4f8]"
              >
                {subjectAverages.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.code ? `[${sub.code}] ` : ''}
                    {sub.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {histogramData.gradedCount === 0 ? (
            <div className="py-10 text-center text-xs text-[#9aa0a6]">
              {t.noSubjectMarksYet}
            </div>
          ) : (
            <div className="mt-4 space-y-5">
              {/* Unboxed Quantitative Telemetry Strip */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-[#9aa0a6]">
                <span>
                  {t.gradedStudentsCount}:{' '}
                  <strong className="font-mono-num text-[#f1f3f4]">
                    {histogramData.gradedCount}/{bundle.cards.length}
                  </strong>
                </span>
                <span aria-hidden="true" className="text-[#4c5464]">
                  ·
                </span>
                <span>
                  {t.classStatsAvg}:{' '}
                  <strong className="font-mono-num text-[#8ab4f8]">
                    {histogramData.meta?.avg !== null && histogramData.meta?.avg !== undefined
                      ? `${histogramData.meta.avg.toFixed(2)} / 20`
                      : '—'}
                  </strong>
                </span>
                <span aria-hidden="true" className="text-[#4c5464]">
                  ·
                </span>
                <span>
                  {t.medianLabel}:{' '}
                  <strong className="font-mono-num text-[#f1f3f4]">
                    {histogramData.median !== null ? `${histogramData.median.toFixed(2)} / 20` : '—'}
                  </strong>
                </span>
                <span aria-hidden="true" className="text-[#4c5464]">
                  ·
                </span>
                <span>
                  {t.classStatsPass}:{' '}
                  <strong className="font-mono-num text-[#81c995]">
                    {histogramData.passPct !== null
                      ? `${histogramData.passPct}% (${histogramData.passCount})`
                      : '—'}
                  </strong>
                </span>
                <span aria-hidden="true" className="text-[#4c5464]">
                  ·
                </span>
                <span>
                  {t.honoursShareLabel}:{' '}
                  <strong className="font-mono-num text-amber-300">
                    {histogramData.honoursPct !== null
                      ? `${histogramData.honoursPct}% (${histogramData.honoursCount})`
                      : '—'}
                  </strong>
                </span>
                <span aria-hidden="true" className="text-[#4c5464]">
                  ·
                </span>
                <span>
                  {t.subjectMin} / {t.subjectMax}:{' '}
                  <strong className="font-mono-num text-[#f1f3f4]">
                    {histogramData.meta?.min !== null && histogramData.meta?.min !== undefined
                      ? histogramData.meta.min.toFixed(2)
                      : '—'}{' '}
                    –{' '}
                    {histogramData.meta?.max !== null && histogramData.meta?.max !== undefined
                      ? histogramData.meta.max.toFixed(2)
                      : '—'}
                  </strong>
                </span>
              </div>

              {/* 7-Band Histogram Chart */}
              <div className="relative pt-2">
                <div className="grid grid-cols-7 items-end gap-2 sm:gap-3">
                  {histogramData.bands.map((band, index) => {
                    const count = band.students.length;
                    const pct = Math.round((count / histogramData.gradedCount) * 100);
                    const barHeightPct =
                      count > 0 ? Math.max(14, Math.round((count / histogramData.maxBandCount) * 100)) : 4;
                    const isSelected = activeBandId === band.id;

                    const barColor =
                      band.tier === 'support'
                        ? isSelected
                          ? 'bg-[#f28b82]'
                          : 'bg-[#f28b82]/75 hover:bg-[#f28b82]'
                        : band.tier === 'pass'
                          ? isSelected
                            ? 'bg-[#8ab4f8]'
                            : 'bg-[#8ab4f8]/80 hover:bg-[#8ab4f8]'
                          : isSelected
                            ? 'bg-[#81c995]'
                            : 'bg-[#81c995]/80 hover:bg-[#81c995]';

                    return (
                      <div key={band.id} className="relative flex flex-col items-center">
                        {/* Vertical pass threshold guide before the 10-12 band */}
                        {index === 3 && (
                          <div
                            title={t.passThresholdLabel}
                            className="pointer-events-none absolute -top-2 bottom-7 -left-1.5 border-l border-dashed border-[#8ab4f8]/50 sm:-left-2"
                          />
                        )}

                        <button
                          type="button"
                          onClick={() =>
                            setActiveBandId((prev) => (prev === band.id ? null : band.id))
                          }
                          aria-label={`${band.label}: ${count} (${pct}%)`}
                          className={`group flex w-full flex-col items-center rounded-xl px-1 pt-2 pb-1.5 transition-colors ${
                            isSelected ? 'bg-[#1a2232]' : 'hover:bg-[#181c26]'
                          }`}
                        >
                          <span className="font-mono-num text-xs font-bold text-[#f1f3f4]">
                            {count}
                          </span>
                          <span className="font-mono-num text-[10px] text-[#7f8794]">
                            {pct}%
                          </span>

                          <div className="mt-2 flex h-36 w-full items-end px-1 sm:px-2">
                            <div
                              className={`w-full rounded-t-lg transition-all duration-200 ${barColor}`}
                              style={{ height: `${barHeightPct}%` }}
                            />
                          </div>

                          <div className="mt-2 w-full border-t border-[#282e3c] pt-1.5 text-center">
                            <span className="font-mono-num text-[11px] font-semibold text-[#bdc1c6]">
                              {band.label}
                            </span>
                          </div>
                        </button>
                      </div>
                    );
                  })}
                </div>

                {/* Color + Meaning Legend & Threshold Note */}
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-[#222733] pt-3 text-[11px] text-[#9aa0a6]">
                  <div className="flex flex-wrap items-center gap-4">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-sm bg-[#f28b82]" />
                      {t.needsSupportBand}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-sm bg-[#8ab4f8]" />
                      {t.passBandLabel}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-sm bg-[#81c995]" />
                      {t.honoursBandLabel}
                    </span>
                  </div>
                  <span className="text-[#7f8794]">
                    │ {t.passThresholdLabel}
                  </span>
                </div>
              </div>

              {/* Clicked Band Student Breakdown */}
              {inspectedBand && (
                <div className="border-t border-[#222733] pt-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[#e8eaed]">
                      {t.bandStudentsLabel} ({inspectedBand.label} / 20) —{' '}
                      <span className="font-mono-num text-[#8ab4f8]">
                        {inspectedBand.students.length}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveBandId(null)}
                      className="text-xs font-medium text-[#9aa0a6] hover:text-[#e8eaed]"
                    >
                      {t.close}
                    </button>
                  </div>
                  {inspectedBand.students.length === 0 ? (
                    <p className="mt-2 text-xs text-[#7f8794]">—</p>
                  ) : (
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      {inspectedBand.students.map((stu) => (
                        <button
                          key={stu.studentId}
                          type="button"
                          onClick={() => setSelectedStudentId(stu.studentId)}
                          className={`inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs transition-colors ${
                            selectedStudentId === stu.studentId
                              ? 'border-[#8ab4f8] bg-[#1a2438] text-[#f1f3f4]'
                              : 'border-[#242936] bg-[#0e1117] text-[#e8eaed] hover:border-[#3c465c]'
                          }`}
                        >
                          <span className="font-medium">{stu.fullName}</span>
                          <span className="font-mono-num font-bold text-[#8ab4f8]">
                            {stu.score.toFixed(2)}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* Split Studio: Left Merit Leaderboard + Right Live White A4 Sheet */}
      {loading ? (
        <div className="no-print h-96 animate-pulse rounded-2xl border border-[#242936] bg-[#13161d]" />
      ) : !bundle || bundle.cards.length === 0 ? (
        <div className="no-print rounded-2xl border border-[#242936] bg-[#13161d] p-8 text-center text-sm text-[#9aa0a6]">
          {t.noReportStudents}
        </div>
      ) : (
        <>
          <div className="no-print grid grid-cols-1 gap-6 xl:grid-cols-[300px_minmax(0,1fr)] 2xl:grid-cols-[340px_minmax(0,1fr)]">
            {/* Merit Leaderboard & Multi-Student Download Selector */}
            <div className="min-w-0 overflow-hidden rounded-2xl border border-[#242936] bg-[#13161d]/90">
              <div className="border-b border-[#222733] px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <label className="flex cursor-pointer items-center gap-2">
                      <input
                        type="checkbox"
                        checked={bundle.cards.length > 0 && selectedCount === bundle.cards.length}
                        onChange={toggleSelectAll}
                        aria-label={t.selectAll}
                        className="h-4 w-4 rounded border-[#3b4254] bg-[#0d1016] accent-[#8ab4f8]"
                      />
                      <h2 className="font-display text-sm font-semibold text-[#f1f3f4]">
                        {t.studentSelector}
                      </h2>
                    </label>
                    {selectedCount > 0 && (
                      <span className="font-mono-num text-xs font-semibold text-[#8ab4f8]">
                        ({selectedCount} {t.selectedCount})
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-[11px]">
                    <button
                      type="button"
                      onClick={selectHonoursStudents}
                      className="rounded-lg border border-[#2b3140] bg-[#181c26] px-2 py-1 font-medium text-amber-300 hover:border-amber-400/50"
                    >
                      {t.selectHonours}
                    </button>
                    {selectedCount > 0 ? (
                      <button
                        type="button"
                        onClick={clearSelection}
                        className="rounded-lg border border-[#2b3140] bg-[#181c26] px-2 py-1 font-medium text-[#bdc1c6] hover:text-[#f1f3f4]"
                      >
                        {t.clearSelection}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={toggleSelectAll}
                        className="rounded-lg border border-[#2b3140] bg-[#181c26] px-2 py-1 font-medium text-[#8ab4f8] hover:border-[#8ab4f8]/50"
                      >
                        {t.selectAll}
                      </button>
                    )}
                  </div>
                </div>
                <p className="mt-1.5 text-[11px] text-[#7f8794]">{t.selectStudentsHint}</p>
              </div>
              <div className="max-h-[820px] divide-y divide-[#1f2430] overflow-y-auto">
                {rankedCards.map((c) => {
                  const active = c.student.id === selectedStudentId;
                  const checked = checkedStudentIds.has(c.student.id);
                  const honor = c.honourRoll || (c.average !== null && c.average >= 12);
                  return (
                    <div
                      key={c.student.id}
                      className={`flex w-full items-center gap-2 px-3 py-2.5 transition-colors ${
                        active
                          ? 'bg-[#1a2438]'
                          : checked
                            ? 'bg-[#141c2b]'
                            : 'hover:bg-[#191d27]'
                      }`}
                    >
                      <label className="flex shrink-0 cursor-pointer items-center p-1">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleStudentChecked(c.student.id)}
                          aria-label={`${c.student.fullName}`}
                          className="h-4 w-4 rounded border-[#3b4254] bg-[#0d1016] accent-[#8ab4f8]"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => setSelectedStudentId(c.student.id)}
                        className="flex min-w-0 flex-1 items-center justify-between gap-3 py-0.5 text-left"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono-num text-xs font-semibold text-[#8ab4f8]">
                              {formatRank(c.rank, c.totalStudents, lang)}
                            </span>
                            {honor && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-300">
                                <Award className="h-3 w-3" />
                                {t.honorRoll}
                              </span>
                            )}
                          </div>
                          <p className="mt-0.5 truncate text-sm font-medium text-[#f1f3f4]">
                            {c.student.fullName}
                          </p>
                        </div>
                        <span
                          className={`font-mono-num shrink-0 text-sm font-bold ${
                            c.average === null
                              ? 'text-[#7f8794]'
                              : c.average >= 12
                                ? 'text-amber-300'
                                : c.average >= 10
                                  ? 'text-[#81c995]'
                                  : 'text-[#f28b82]'
                          }`}
                        >
                          {c.average !== null ? `${c.average.toFixed(2)}` : '—'}
                        </span>
                      </button>
                    </div>
                  );
                })}
              </div>
              {selectedCount > 0 && (
                <div className="border-t border-[#222733] bg-[#10131a] p-3">
                  <button
                    type="button"
                    disabled={exporting}
                    onClick={handleDownloadSelected}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#8ab4f8] px-4 py-2 text-xs font-semibold text-[#0b0d12] hover:bg-[#a8c7fa] disabled:opacity-50"
                  >
                    {exporting ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Download className="h-3.5 w-3.5" />
                    )}
                    {t.downloadSelectedPdf} ({selectedCount})
                  </button>
                </div>
              )}
            </div>

            {/* White-Paper Report Card Preview */}
            <div className="min-w-0">
              {previewCard && (
                <div className="rounded-2xl border border-[#242936] bg-[#0e1117] p-3 sm:p-5">
                  <ReportCardSheet school={bundle.school} card={previewCard} lang={lang} />
                </div>
              )}
            </div>
          </div>

          {/* Print-only Full Class or Selected Students Stack */}
          <div className="hidden print-only">
            {cardsForPrint.map((card) => (
              <ReportCardSheet key={card.student.id} school={bundle.school} card={card} lang={lang} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
