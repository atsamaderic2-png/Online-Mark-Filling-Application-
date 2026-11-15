import { useEffect, useMemo, useState } from 'react';
import { Check, Clock, Loader2, Save, ShieldAlert, UserCheck, UserX } from 'lucide-react';
import { api } from '../api';
import { translations } from '../i18n';
import type {
  ClassItem,
  DisciplineRow,
  Language,
  SectionItem,
  SequenceNumber,
} from '../types';

interface DisciplineViewProps {
  lang: Language;
  defaultTerm: 1 | 2 | 3;
}

interface EditableDiscipline {
  studentId: string;
  matricule: string;
  fullName: string;
  sex: 'M' | 'F';
  justifiedAbsences: number;
  unjustifiedAbsences: number;
  lateComings: number;
  sanction: string;
}

export function DisciplineView({ lang, defaultTerm }: DisciplineViewProps) {
  const t = translations[lang];
  const [sections, setSections] = useState<SectionItem[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [term, setTerm] = useState<1 | 2 | 3>(defaultTerm);
  const [sequence, setSequence] = useState<SequenceNumber>(1);
  const [rows, setRows] = useState<EditableDiscipline[]>([]);
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingRows, setLoadingRows] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sanctionPresets = useMemo(
    () => [
      { value: '', label: t.sanctionNone },
      { value: 'Written Warning / Avertissement écrit', label: t.sanctionWarning },
      { value: 'Conduct Blame / Blâme de conduite', label: t.sanctionBlame },
      { value: 'Detention (2 hrs) / Consigne (2 h)', label: t.sanctionDetention },
      { value: '3-Day Suspension / Exclusion 3 jours', label: t.sanctionSuspension3 },
      { value: 'Disciplinary Council / Conseil de discipline', label: t.sanctionCouncil },
    ],
    [t]
  );

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.getSections(), api.getClasses()])
      .then(([secRes, clsRes]) => {
        if (cancelled) return;
        setSections(secRes);
        setClasses(clsRes);
        if (clsRes[0]) setSelectedClassId(clsRes[0].id);
        setLoading(false);
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
  }, []);

  useEffect(() => {
    if (!selectedClassId) return;
    let cancelled = false;
    setLoadingRows(true);
    setError(null);
    setDirty(false);
    setSavedNotice(false);
    api
      .getDiscipline(selectedClassId, term, sequence)
      .then((res: DisciplineRow[]) => {
        if (cancelled) return;
        setRows(
          res.map((r) => ({
            studentId: r.studentId,
            matricule: r.matricule,
            fullName: r.fullName,
            sex: r.sex,
            justifiedAbsences: r.justifiedAbsences ?? 0,
            unjustifiedAbsences: r.unjustifiedAbsences ?? 0,
            lateComings: r.lateComings ?? 0,
            sanction: r.sanction ?? '',
          }))
        );
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load discipline data');
      })
      .finally(() => {
        if (!cancelled) setLoadingRows(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedClassId, term, sequence]);

  const sectionMap = useMemo(() => new Map(sections.map((s) => [s.id, s])), [sections]);

  function updateField<K extends keyof EditableDiscipline>(
    studentId: string,
    field: K,
    value: EditableDiscipline[K]
  ) {
    setDirty(true);
    setSavedNotice(false);
    setRows((prev) =>
      prev.map((r) => (r.studentId === studentId ? { ...r, [field]: value } : r))
    );
  }

  function updateIntField(
    studentId: string,
    field: 'justifiedAbsences' | 'unjustifiedAbsences' | 'lateComings',
    raw: string
  ) {
    const parsed = raw.trim() === '' ? 0 : Math.max(0, Math.floor(Number(raw) || 0));
    updateField(studentId, field, parsed);
  }

  const summary = useMemo(() => {
    let justified = 0;
    let unjustified = 0;
    let lates = 0;
    let sanctioned = 0;
    for (const r of rows) {
      justified += r.justifiedAbsences;
      unjustified += r.unjustifiedAbsences;
      lates += r.lateComings;
      if (r.sanction.trim().length > 0 && r.sanction.trim().toLowerCase() !== 'none') {
        sanctioned += 1;
      }
    }
    return { justified, unjustified, lates, sanctioned };
  }, [rows]);

  async function handleSave() {
    if (!selectedClassId) return;
    setError(null);
    setSavedNotice(false);
    setSaving(true);
    try {
      await api.saveDiscipline({
        classId: selectedClassId,
        term,
        sequence,
        entries: rows.map((r) => ({
          studentId: r.studentId,
          justifiedAbsences: r.justifiedAbsences,
          unjustifiedAbsences: r.unjustifiedAbsences,
          lateComings: r.lateComings,
          sanction: r.sanction.trim(),
        })),
      });
      setDirty(false);
      setSavedNotice(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save discipline records');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-[#f1f3f4]">
            {t.disciplineTitle}
          </h1>
          <p className="mt-1 text-sm text-[#9aa0a6]">{t.disciplineDesc}</p>
        </div>

        {/* Term & Sequence Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-xl border border-[#242936] bg-[#13161d] p-1">
            {([1, 2, 3] as const).map((tNum) => (
              <button
                key={tNum}
                type="button"
                onClick={() => setTerm(tNum)}
                className={`whitespace-nowrap rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors ${
                  term === tNum
                    ? 'bg-[#232836] text-[#8ab4f8]'
                    : 'text-[#9aa0a6] hover:text-[#e8eaed]'
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

      {/* Class Selector + Telemetry Strip */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="flex items-center gap-3 rounded-2xl border border-[#242936] bg-[#13161d]/90 p-4 lg:col-span-4">
          <label className="shrink-0 text-xs font-semibold text-[#bdc1c6]">{t.selectClass}:</label>
          <select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            disabled={loading}
            className="w-full rounded-xl border border-[#2c3240] bg-[#0d1016] px-3 py-2 text-sm font-medium text-[#e8eaed] outline-none focus:border-[#8ab4f8]"
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

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:col-span-8">
          <div className="rounded-2xl border border-[#242936] bg-[#13161d]/90 p-4">
            <div className="flex items-center justify-between text-xs text-[#9aa0a6]">
              <span>{t.justifiedAbsences}</span>
              <UserCheck className="h-3.5 w-3.5 text-[#8ab4f8]" />
            </div>
            <p className="font-mono-num mt-1.5 text-xl font-bold text-[#8ab4f8]">
              {summary.justified}
            </p>
          </div>
          <div className="rounded-2xl border border-[#242936] bg-[#13161d]/90 p-4">
            <div className="flex items-center justify-between text-xs text-[#9aa0a6]">
              <span>{t.unjustifiedAbsences}</span>
              <UserX className="h-3.5 w-3.5 text-[#f28b82]" />
            </div>
            <p className="font-mono-num mt-1.5 text-xl font-bold text-[#f28b82]">
              {summary.unjustified}
            </p>
          </div>
          <div className="rounded-2xl border border-[#242936] bg-[#13161d]/90 p-4">
            <div className="flex items-center justify-between text-xs text-[#9aa0a6]">
              <span>{t.lateComings}</span>
              <Clock className="h-3.5 w-3.5 text-amber-300" />
            </div>
            <p className="font-mono-num mt-1.5 text-xl font-bold text-amber-300">
              {summary.lates}
            </p>
          </div>
          <div className="rounded-2xl border border-[#242936] bg-[#13161d]/90 p-4">
            <div className="flex items-center justify-between text-xs text-[#9aa0a6]">
              <span>{t.disciplineSanction}</span>
              <ShieldAlert className="h-3.5 w-3.5 text-amber-400" />
            </div>
            <p className="font-mono-num mt-1.5 text-xl font-bold text-[#f1f3f4]">
              {summary.sanctioned}
            </p>
          </div>
        </div>
      </div>

      {/* Discipline Spreadsheet */}
      <div className="overflow-hidden rounded-2xl border border-[#242936] bg-[#13161d]/90 backdrop-blur-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#222733] px-5 py-4">
          <div>
            <h2 className="font-display text-base font-semibold text-[#f1f3f4]">
              {classes.find((c) => c.id === selectedClassId)?.name || '—'} ·{' '}
              {term === 1 ? t.term1 : term === 2 ? t.term2 : t.term3} ·{' '}
              {sequence === 1 ? t.sequence1 : t.sequence2}
            </h2>
            <p className="mt-0.5 text-xs text-[#9aa0a6]">
              {rows.length} {t.studentsCount.toLowerCase()}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {dirty && (
              <span className="text-xs font-medium text-amber-300">{t.unsavedChanges}</span>
            )}
            {savedNotice && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-[#81c995]">
                <Check className="h-3.5 w-3.5" />
                {t.disciplineSaved}
              </span>
            )}
            <button
              type="button"
              disabled={saving || loadingRows || rows.length === 0}
              onClick={handleSave}
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl bg-[#8ab4f8] px-4 py-2 text-xs font-semibold text-[#0b0d12] hover:bg-[#a8c7fa] disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              {saving ? t.savingMarks : t.saveDiscipline}
            </button>
          </div>
        </div>

        <div className="studio-table-wrap overflow-x-auto">
          <table className="studio-table text-left text-sm">
            <thead>
              <tr className="bg-[#0e1117] text-xs font-semibold text-[#9aa0a6]">
                <th className="px-3 py-3">{t.matricule}</th>
                <th className="px-3 py-3">{t.fullName}</th>
                <th className="w-24 px-2.5 py-3 text-right">{t.justifiedAbsences}</th>
                <th className="w-24 px-2.5 py-3 text-right">{t.unjustifiedAbsences}</th>
                <th className="w-20 px-2.5 py-3 text-right">{t.lateComings}</th>
                <th className="px-3 py-3">{t.disciplineSanction}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1f2430]">
              {loadingRows ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-xs text-[#9aa0a6]">
                    {t.loading}
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-[#9aa0a6]">
                    {t.noStudentsFound}
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.studentId} className="hover:bg-[#191d27]">
                    <td className="font-mono-num whitespace-nowrap px-4 py-2.5 text-xs text-[#8ab4f8]">
                      {r.matricule}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 font-medium text-[#f1f3f4]">
                      {r.fullName}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right">
                      <input
                        type="number"
                        min="0"
                        max="300"
                        value={r.justifiedAbsences}
                        onChange={(e) =>
                          updateIntField(r.studentId, 'justifiedAbsences', e.target.value)
                        }
                        className="font-mono-num w-16 sm:w-20 rounded-xl border border-[#2c3240] bg-[#0d1016] px-2 py-1.5 text-right text-sm text-[#f1f3f4] outline-none focus:border-[#8ab4f8]"
                      />
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right">
                      <input
                        type="number"
                        min="0"
                        max="300"
                        value={r.unjustifiedAbsences}
                        onChange={(e) =>
                          updateIntField(r.studentId, 'unjustifiedAbsences', e.target.value)
                        }
                        className={`font-mono-num w-16 sm:w-20 rounded-xl border px-2 py-1.5 text-right text-sm outline-none ${
                          r.unjustifiedAbsences > 0
                            ? 'border-red-500/40 bg-red-500/10 text-red-200 focus:border-red-400'
                            : 'border-[#2c3240] bg-[#0d1016] text-[#f1f3f4] focus:border-[#8ab4f8]'
                        }`}
                      />
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right">
                      <input
                        type="number"
                        min="0"
                        max="300"
                        value={r.lateComings}
                        onChange={(e) =>
                          updateIntField(r.studentId, 'lateComings', e.target.value)
                        }
                        className="font-mono-num w-16 sm:w-20 rounded-xl border border-[#2c3240] bg-[#0d1016] px-2 py-1.5 text-right text-sm text-[#f1f3f4] outline-none focus:border-[#8ab4f8]"
                      />
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex min-w-[260px] items-center gap-2">
                        <select
                          value={
                            sanctionPresets.some((p) => p.value === r.sanction)
                              ? r.sanction
                              : '__custom__'
                          }
                          onChange={(e) => {
                            if (e.target.value !== '__custom__') {
                              updateField(r.studentId, 'sanction', e.target.value);
                            }
                          }}
                          className="w-36 shrink-0 rounded-xl border border-[#262b38] bg-[#0d1016] px-2.5 py-1.5 text-xs text-[#e8eaed] outline-none focus:border-[#8ab4f8]"
                        >
                          {sanctionPresets.map((p) => (
                            <option key={p.label} value={p.value}>
                              {p.label}
                            </option>
                          ))}
                          {!sanctionPresets.some((p) => p.value === r.sanction) && (
                            <option value="__custom__">Custom</option>
                          )}
                        </select>
                        <input
                          type="text"
                          value={r.sanction}
                          onChange={(e) => updateField(r.studentId, 'sanction', e.target.value)}
                          placeholder={t.sanctionCustomPlaceholder}
                          className="min-w-[130px] flex-1 rounded-xl border border-[#262b38] bg-[#0d1016] px-2.5 py-1.5 text-xs text-[#e8eaed] placeholder-[#5f6368] outline-none focus:border-[#8ab4f8]"
                        />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
