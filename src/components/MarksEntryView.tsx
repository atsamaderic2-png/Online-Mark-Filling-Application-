import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ClipboardPaste, Loader2, Save, Sparkles } from 'lucide-react';
import { api } from '../api';
import { suggestRemark, translations } from '../i18n';
import type {
  Language,
  MarkRow,
  SequenceNumber,
  TeacherAssignedSlot,
  UserRole,
} from '../types';

interface MarksEntryViewProps {
  lang: Language;
  role: UserRole;
  defaultTerm: 1 | 2 | 3;
}

interface EditableMark {
  studentId: string;
  matricule: string;
  fullName: string;
  sex: 'M' | 'F';
  repeater: boolean;
  scoreStr: string;
  otherSequenceScore: number | null;
  remark: string;
  updatedByName: string | null;
}

export function MarksEntryView({ lang, role, defaultTerm }: MarksEntryViewProps) {
  const t = translations[lang];
  const [term, setTerm] = useState<1 | 2 | 3>(defaultTerm);
  const [sequence, setSequence] = useState<SequenceNumber>(1);
  const [slots, setSlots] = useState<TeacherAssignedSlot[]>([]);
  const [selectedKey, setSelectedKey] = useState<string>('');
  const [rows, setRows] = useState<EditableMark[]>([]);
  const [dirty, setDirty] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(true);
  const [loadingMarks, setLoadingMarks] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Bulk Paste / CSV import modal
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');

  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    let cancelled = false;
    setLoadingSlots(true);
    setError(null);
    api
      .getTeacherSlots(term, sequence)
      .then((res) => {
        if (cancelled) return;
        setSlots(res);
        setSelectedKey((prev) => {
          if (prev && res.some((s) => `${s.classId}:${s.subjectId}` === prev)) {
            return prev;
          }
          return res[0] ? `${res[0].classId}:${res[0].subjectId}` : '';
        });
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load assigned subjects');
      })
      .finally(() => {
        if (!cancelled) setLoadingSlots(false);
      });
    return () => {
      cancelled = true;
    };
  }, [term, sequence]);

  const activeSlot = useMemo(
    () => slots.find((s) => `${s.classId}:${s.subjectId}` === selectedKey) ?? null,
    [slots, selectedKey]
  );

  useEffect(() => {
    if (!activeSlot) {
      setRows([]);
      return;
    }
    let cancelled = false;
    setLoadingMarks(true);
    setError(null);
    setSavedNotice(false);
    setDirty(false);

    api
      .getMarks(activeSlot.classId, activeSlot.subjectId, term, sequence)
      .then((res: MarkRow[]) => {
        if (cancelled) return;
        setRows(
          res.map((r) => ({
            studentId: r.studentId,
            matricule: r.matricule,
            fullName: r.fullName,
            sex: r.sex,
            repeater: r.repeater,
            scoreStr: r.score !== null ? String(r.score) : '',
            otherSequenceScore: r.otherSequenceScore,
            remark: r.remark,
            updatedByName: r.updatedByName,
          }))
        );
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load marks');
      })
      .finally(() => {
        if (!cancelled) setLoadingMarks(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeSlot?.classId, activeSlot?.subjectId, term, sequence]);

  function updateScore(studentId: string, val: string) {
    setDirty(true);
    setSavedNotice(false);
    setRows((prev) =>
      prev.map((r) => {
        if (r.studentId !== studentId) return r;
        const num = val.trim() === '' ? null : Number(val);
        const autoRem =
          num !== null && !Number.isNaN(num) && num >= 0 && num <= 20
            ? suggestRemark(num, lang)
            : '';
        return { ...r, scoreStr: val, remark: val.trim() === '' ? '' : r.remark || autoRem };
      })
    );
  }

  function updateRemark(studentId: string, val: string) {
    setDirty(true);
    setSavedNotice(false);
    setRows((prev) => prev.map((r) => (r.studentId === studentId ? { ...r, remark: val } : r)));
  }

  function autoFillRemarks() {
    setDirty(true);
    setRows((prev) =>
      prev.map((r) => {
        const num = r.scoreStr.trim() === '' ? null : Number(r.scoreStr);
        if (num === null || Number.isNaN(num) || num < 0 || num > 20) return r;
        return { ...r, remark: suggestRemark(num, lang) };
      })
    );
  }

  function applyBonusCurve() {
    setDirty(true);
    setSavedNotice(false);
    setRows((prev) =>
      prev.map((r) => {
        if (r.scoreStr.trim() === '') return r;
        const num = Number(r.scoreStr);
        if (Number.isNaN(num) || num < 0 || num > 20) return r;
        const boosted = Math.min(20, Math.round((num + 0.5) * 100) / 100);
        return { ...r, scoreStr: String(boosted), remark: suggestRemark(boosted, lang) };
      })
    );
  }

  function applyBulkPaste() {
    const lines = importText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) {
      setImportOpen(false);
      return;
    }

    setDirty(true);
    setSavedNotice(false);

    setRows((prev) => {
      const next = [...prev];
      const hasPairs = lines.some((l) => l.includes(',') || l.includes('\t'));
      if (hasPairs) {
        for (const line of lines) {
          const parts = line.split(/[,\t;]+/).map((p) => p.trim());
          if (parts.length < 2) continue;
          const targetName = parts[0].toLowerCase();
          const valNum = Number(parts[parts.length - 1].replace(',', '.'));
          if (Number.isNaN(valNum) || valNum < 0 || valNum > 20) continue;
          const idx = next.findIndex(
            (r) =>
              r.fullName.toLowerCase().includes(targetName) ||
              r.matricule.toLowerCase() === targetName
          );
          if (idx >= 0) {
            next[idx] = {
              ...next[idx],
              scoreStr: String(valNum),
              remark: suggestRemark(valNum, lang),
            };
          }
        }
      } else {
        for (let i = 0; i < Math.min(lines.length, next.length); i++) {
          const valNum = Number(lines[i].replace(',', '.'));
          if (!Number.isNaN(valNum) && valNum >= 0 && valNum <= 20) {
            next[i] = {
              ...next[i],
              scoreStr: String(valNum),
              remark: suggestRemark(valNum, lang),
            };
          }
        }
      }
      return next;
    });
    setImportText('');
    setImportOpen(false);
  }

  const stats = useMemo(() => {
    const validScores: number[] = [];
    for (const r of rows) {
      if (r.scoreStr.trim() === '') continue;
      const n = Number(r.scoreStr);
      if (!Number.isNaN(n) && n >= 0 && n <= 20) validScores.push(n);
    }
    const sorted = [...validScores].sort((a, b) => a - b);
    const avg =
      validScores.length > 0
        ? validScores.reduce((a, b) => a + b, 0) / validScores.length
        : null;
    const median =
      sorted.length === 0
        ? null
        : sorted.length % 2 === 1
          ? sorted[Math.floor(sorted.length / 2)]
          : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
    const highest = sorted.length > 0 ? sorted[sorted.length - 1] : null;
    const passCount = validScores.filter((s) => s >= 10).length;
    const passPct = validScores.length > 0 ? (passCount / validScores.length) * 100 : null;

    const bands = [
      { label: '0–5', count: 0, pass: false },
      { label: '5–10', count: 0, pass: false },
      { label: '10–12', count: 0, pass: true },
      { label: '12–14', count: 0, pass: true },
      { label: '14–16', count: 0, pass: true },
      { label: '16–20', count: 0, pass: true },
    ];
    for (const s of validScores) {
      if (s < 5) bands[0].count += 1;
      else if (s < 10) bands[1].count += 1;
      else if (s < 12) bands[2].count += 1;
      else if (s < 14) bands[3].count += 1;
      else if (s < 16) bands[4].count += 1;
      else bands[5].count += 1;
    }

    return {
      graded: validScores.length,
      total: rows.length,
      avg,
      median,
      highest,
      passPct,
      bands,
      maxBandCount: Math.max(1, ...bands.map((b) => b.count)),
    };
  }, [rows]);

  async function handleSaveAll() {
    if (!activeSlot) return;
    setError(null);
    setSavedNotice(false);

    const entries: Array<{ studentId: string; score: number | null; remark: string }> = [];
    for (const r of rows) {
      if (r.scoreStr.trim() === '') {
        entries.push({ studentId: r.studentId, score: null, remark: '' });
      } else {
        const n = Number(r.scoreStr);
        if (Number.isNaN(n) || n < 0 || n > 20) {
          setError(`${r.fullName}: ${t.markOutOf20} must be between 0 and 20`);
          return;
        }
        entries.push({
          studentId: r.studentId,
          score: n,
          remark: r.remark.trim() || suggestRemark(n, lang),
        });
      }
    }

    setSaving(true);
    try {
      await api.saveMarks({
        classId: activeSlot.classId,
        subjectId: activeSlot.subjectId,
        term,
        sequence,
        entries,
      });
      setDirty(false);
      setSavedNotice(true);
      const [updatedSlots, reloadedMarks] = await Promise.all([
        api.getTeacherSlots(term, sequence),
        api.getMarks(activeSlot.classId, activeSlot.subjectId, term, sequence),
      ]);
      setSlots(updatedSlots);
      setRows(
        reloadedMarks.map((r) => ({
          studentId: r.studentId,
          matricule: r.matricule,
          fullName: r.fullName,
          sex: r.sex,
          repeater: r.repeater,
          scoreStr: r.score !== null ? String(r.score) : '',
          otherSequenceScore: r.otherSequenceScore,
          remark: r.remark,
          updatedByName: r.updatedByName,
        }))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save marks');
    } finally {
      setSaving(false);
    }
  }

  const activeSeqLabel = sequence === 1 ? t.seq1Short : t.seq2Short;
  const siblingSeqLabel = sequence === 1 ? t.seq2Short : t.seq1Short;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-[#f1f3f4]">
            {t.marksTitle}
          </h1>
          <p className="mt-1 text-sm text-[#9aa0a6]">
            {role === 'teacher' ? t.teacherScopeNotice : t.marksDesc}
          </p>
        </div>

        {/* Term & Sequence Segmented Switchers */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-xl border border-[#242936] bg-[#13161d] p-1">
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

          <div className="flex items-center gap-1 rounded-xl border border-[#242936] bg-[#13161d] p-1">
            {([1, 2] as const).map((seqNum) => (
              <button
                key={seqNum}
                type="button"
                onClick={() => setSequence(seqNum)}
                className={`whitespace-nowrap rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors ${
                  sequence === seqNum
                    ? 'bg-[#1b2b44] text-[#8ab4f8]'
                    : 'text-[#9aa0a6] hover:text-[#e8eaed]'
                }`}
              >
                {seqNum === 1 ? t.sequence1 : t.sequence2}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs font-medium text-red-300">
          {error}
        </div>
      )}

      {loadingSlots ? (
        <div className="h-24 animate-pulse rounded-2xl border border-[#242936] bg-[#13161d]" />
      ) : slots.length === 0 ? (
        <div className="rounded-2xl border border-[#242936] bg-[#13161d] p-8 text-center text-sm text-[#9aa0a6]">
          {t.noAssignedSubjects}
        </div>
      ) : (
        <>
          {/* Assigned Class & Subject Selector Cards */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {slots.map((slot) => {
              const key = `${slot.classId}:${slot.subjectId}`;
              const isSelected = key === selectedKey;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedKey(key)}
                  className={`rounded-2xl border p-4 text-left transition-colors ${
                    isSelected
                      ? 'border-[#8ab4f8] bg-[#182133] text-[#f1f3f4]'
                      : 'border-[#242936] bg-[#13161d]/90 text-[#e8eaed] hover:border-[#3c465c]'
                  }`}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-display text-sm font-bold">
                      {lang === 'fr' ? slot.subjectNameFr : slot.subjectNameEn}
                    </span>
                    <span className="font-mono-num text-xs text-[#8ab4f8]">
                      Coef {slot.coefficient}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-xs text-[#9aa0a6]">
                    <span>
                      {slot.className} · {lang === 'fr' ? slot.sectionNameFr : slot.sectionNameEn}
                    </span>
                    <span className="font-mono-num">
                      {slot.gradedCount}/{slot.studentCount} ({activeSeqLabel})
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {activeSlot && (
            <>
              {/* Live Grade Distribution & Telemetry Strip */}
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:col-span-7">
                  <div className="rounded-2xl border border-[#242936] bg-[#13161d]/90 p-4">
                    <p className="text-xs text-[#9aa0a6]">{t.gradedProgress}</p>
                    <p className="font-mono-num mt-1.5 text-xl font-bold text-[#f1f3f4]">
                      {stats.graded}/{stats.total}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-[#242936] bg-[#13161d]/90 p-4">
                    <p className="text-xs text-[#9aa0a6]">{t.classStatsAvg}</p>
                    <p className="font-mono-num mt-1.5 text-xl font-bold text-[#8ab4f8]">
                      {stats.avg !== null ? `${stats.avg.toFixed(2)}` : '—'}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-[#242936] bg-[#13161d]/90 p-4">
                    <p className="text-xs text-[#9aa0a6]">{t.medianLabel}</p>
                    <p className="font-mono-num mt-1.5 text-xl font-bold text-[#f1f3f4]">
                      {stats.median !== null ? `${stats.median.toFixed(2)}` : '—'}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-[#242936] bg-[#13161d]/90 p-4">
                    <p className="text-xs text-[#9aa0a6]">{t.classStatsPass}</p>
                    <p className="font-mono-num mt-1.5 text-xl font-bold text-[#81c995]">
                      {stats.passPct !== null ? `${stats.passPct.toFixed(0)}%` : '—'}
                    </p>
                  </div>
                </div>

                {/* Live Grade Band Histogram */}
                <div className="rounded-2xl border border-[#242936] bg-[#13161d]/90 p-4 lg:col-span-5">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-[#bdc1c6]">{t.distributionTitle}</p>
                    <span className="font-mono-num text-[11px] text-[#7f8794]">
                      {t.topScoreLabel}: {stats.highest !== null ? `${stats.highest}/20` : '—'}
                    </span>
                  </div>
                  <div className="mt-3 flex h-16 items-end gap-2">
                    {stats.bands.map((b) => {
                      const heightPct = Math.round((b.count / stats.maxBandCount) * 100);
                      return (
                        <div key={b.label} className="flex flex-1 flex-col items-center gap-1">
                          <div className="flex h-10 w-full items-end">
                            <div
                              className={`w-full rounded-t-lg transition-all duration-300 ${
                                b.pass ? 'bg-[#8ab4f8]' : 'bg-[#f28b82]/70'
                              }`}
                              style={{ height: `${b.count > 0 ? Math.max(18, heightPct) : 4}%` }}
                              title={`${b.label}: ${b.count}`}
                            />
                          </div>
                          <span className="font-mono-num text-[10px] text-[#9aa0a6]">{b.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Marks Spreadsheet */}
              <div className="overflow-hidden rounded-2xl border border-[#242936] bg-[#13161d]/90 backdrop-blur-sm">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#222733] px-5 py-4">
                  <div>
                    <h2 className="font-display text-base font-semibold text-[#f1f3f4]">
                      {activeSlot.className} —{' '}
                      {lang === 'fr' ? activeSlot.subjectNameFr : activeSlot.subjectNameEn} (
                      {sequence === 1 ? t.sequence1 : t.sequence2})
                    </h2>
                    <p className="mt-0.5 text-xs text-[#9aa0a6]">
                      {t.clearMarkHint} · Enter / ↑ / ↓
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {dirty && (
                      <span className="text-xs font-medium text-amber-300">{t.unsavedChanges}</span>
                    )}
                    {savedNotice && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-[#81c995]">
                        <Check className="h-3.5 w-3.5" />
                        {t.savedSuccess}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => setImportOpen(true)}
                      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-[#2c3240] bg-[#191d27] px-3 py-2 text-xs font-medium text-[#e8eaed] hover:bg-[#232836]"
                    >
                      <ClipboardPaste className="h-3.5 w-3.5 text-[#8ab4f8]" />
                      {t.pasteImport}
                    </button>
                    <button
                      type="button"
                      onClick={applyBonusCurve}
                      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-[#2c3240] bg-[#191d27] px-3 py-2 text-xs font-medium text-[#e8eaed] hover:bg-[#232836]"
                    >
                      <Sparkles className="h-3.5 w-3.5 text-[#8ab4f8]" />
                      {t.applyBonus}
                    </button>
                    <button
                      type="button"
                      onClick={autoFillRemarks}
                      className="whitespace-nowrap rounded-xl border border-[#2c3240] px-3 py-2 text-xs font-medium text-[#bdc1c6] hover:bg-[#1e232f]"
                    >
                      {t.autoRemark} {t.remark}
                    </button>
                    <button
                      type="button"
                      disabled={saving || loadingMarks}
                      onClick={handleSaveAll}
                      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl bg-[#8ab4f8] px-4 py-2 text-xs font-semibold text-[#0b0d12] hover:bg-[#a8c7fa] disabled:opacity-50"
                    >
                      {saving ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Save className="h-3.5 w-3.5" />
                      )}
                      {saving ? t.savingMarks : t.saveMarks}
                    </button>
                  </div>
                </div>

                <div className="studio-table-wrap overflow-x-auto">
                  <table className="studio-table text-left text-sm">
                    <thead>
                      <tr className="bg-[#0e1117] text-xs font-semibold text-[#9aa0a6]">
                        <th className="px-3 py-3">{t.matricule}</th>
                        <th className="px-3 py-3">{t.fullName}</th>
                        <th className="px-2.5 py-3">{t.sex}</th>
                        <th className="w-24 px-2.5 py-3 text-right sm:w-28">
                          {activeSeqLabel} (/20)
                        </th>
                        <th className="w-20 px-2.5 py-3 text-right">{siblingSeqLabel}</th>
                        <th className="w-20 px-2.5 py-3 text-right">{t.liveTermAvgCol}</th>
                        <th className="px-3 py-3">{t.remark}</th>
                        <th className="px-3 py-3">{t.enteredByCol}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1f2430]">
                      {loadingMarks ? (
                        <tr>
                          <td colSpan={8} className="px-4 py-8 text-center text-xs text-[#9aa0a6]">
                            {t.loading}
                          </td>
                        </tr>
                      ) : rows.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="px-4 py-8 text-center text-sm text-[#9aa0a6]">
                            {t.noStudentsFound}
                          </td>
                        </tr>
                      ) : (
                        rows.map((r, rowIndex) => {
                          const num = r.scoreStr.trim() === '' ? null : Number(r.scoreStr);
                          const invalid =
                            num !== null && (Number.isNaN(num) || num < 0 || num > 20);
                          const validCur = num !== null && !invalid ? num : null;
                          const liveTermAvg =
                            validCur !== null && r.otherSequenceScore !== null
                              ? Math.round(((validCur + r.otherSequenceScore) / 2) * 100) / 100
                              : validCur !== null
                                ? validCur
                                : r.otherSequenceScore;

                          return (
                            <tr key={r.studentId} className="hover:bg-[#191d27]">
                              <td className="font-mono-num whitespace-nowrap px-4 py-2.5 text-xs text-[#8ab4f8]">
                                {r.matricule}
                              </td>
                              <td className="whitespace-nowrap px-4 py-2.5 font-medium text-[#f1f3f4]">
                                {r.fullName}
                              </td>
                              <td className="whitespace-nowrap px-3 py-2.5 text-xs text-[#9aa0a6]">
                                {r.sex}
                              </td>
                              <td className="whitespace-nowrap px-3 py-2.5 text-right">
                                <input
                                  ref={(el) => {
                                    inputRefs.current[rowIndex] = el;
                                  }}
                                  type="number"
                                  step="0.25"
                                  min="0"
                                  max="20"
                                  value={r.scoreStr}
                                  onChange={(e) => updateScore(r.studentId, e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === 'ArrowDown') {
                                      e.preventDefault();
                                      inputRefs.current[rowIndex + 1]?.focus();
                                    } else if (e.key === 'ArrowUp') {
                                      e.preventDefault();
                                      inputRefs.current[rowIndex - 1]?.focus();
                                    }
                                  }}
                                  placeholder="0–20"
                                  className={`font-mono-num w-20 sm:w-24 rounded-xl border px-2.5 py-1.5 text-right text-sm outline-none transition-colors ${
                                    invalid
                                      ? 'border-red-500 bg-red-500/15 text-red-200'
                                      : 'border-[#2c3240] bg-[#0d1016] text-[#f1f3f4] focus:border-[#8ab4f8]'
                                  }`}
                                />
                              </td>
                              <td className="font-mono-num whitespace-nowrap px-3 py-2.5 text-right text-xs text-[#9aa0a6]">
                                {r.otherSequenceScore !== null
                                  ? r.otherSequenceScore.toFixed(2)
                                  : '—'}
                              </td>
                              <td className="font-mono-num whitespace-nowrap px-3 py-2.5 text-right text-xs font-semibold text-[#8ab4f8]">
                                {liveTermAvg !== null ? liveTermAvg.toFixed(2) : '—'}
                              </td>
                              <td className="px-4 py-2.5">
                                <input
                                  type="text"
                                  value={r.remark}
                                  onChange={(e) => updateRemark(r.studentId, e.target.value)}
                                  placeholder={
                                    num !== null && !invalid
                                      ? suggestRemark(num, lang)
                                      : t.clearMarkHint
                                  }
                                  className="w-full min-w-[150px] rounded-xl border border-[#262b38] bg-[#0d1016] px-2.5 py-1.5 text-xs text-[#e8eaed] placeholder-[#5f6368] outline-none focus:border-[#8ab4f8]"
                                />
                              </td>
                              <td className="whitespace-nowrap px-4 py-2.5 text-xs text-[#9aa0a6]">
                                {r.updatedByName || '—'}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* Bulk Paste / CSV Modal */}
      {importOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-[#2d3342] bg-[#13161d] p-6 shadow-2xl">
            <h2 className="font-display text-lg font-semibold text-[#f1f3f4]">
              {t.pasteImportTitle}
            </h2>
            <p className="mt-1 text-xs text-[#9aa0a6]">{t.pasteImportDesc}</p>
            <textarea
              rows={8}
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder={'15.5\n12\n17.25\n14'}
              className="font-mono-num mt-4 w-full rounded-xl border border-[#2c3240] bg-[#0d1016] p-3 text-sm text-[#e8eaed] outline-none focus:border-[#8ab4f8]"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setImportOpen(false)}
                className="rounded-xl border border-[#2c3240] px-4 py-2 text-xs font-semibold text-[#bdc1c6] hover:bg-[#1e232f]"
              >
                {t.cancel}
              </button>
              <button
                type="button"
                onClick={applyBulkPaste}
                className="rounded-xl bg-[#8ab4f8] px-4 py-2 text-xs font-semibold text-[#0b0d12] hover:bg-[#a8c7fa]"
              >
                {t.applyImport}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
