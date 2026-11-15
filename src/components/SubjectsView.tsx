import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Plus } from 'lucide-react';
import { api } from '../api';
import { translations } from '../i18n';
import type { AssignmentItem, ClassItem, Language, SectionItem, SubjectItem } from '../types';
import { ConfirmDialog } from './ConfirmDialog';

export function SubjectsView({ lang }: { lang: Language }) {
  const t = translations[lang];
  const [sections, setSections] = useState<SectionItem[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [assignments, setAssignments] = useState<AssignmentItem[]>([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SubjectItem | null>(null);
  const [nameEn, setNameEn] = useState('');
  const [nameFr, setNameFr] = useState('');
  const [code, setCode] = useState('');
  const [coefficient, setCoefficient] = useState('2');
  const [deleteTarget, setDeleteTarget] = useState<SubjectItem | null>(null);

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      const [secRes, clsRes, subRes, asgRes] = await Promise.all([
        api.getSections(),
        api.getClasses(),
        api.getSubjects(),
        api.getAssignments(),
      ]);
      setSections(secRes);
      setClasses(clsRes);
      setSubjects(subRes);
      setAssignments(asgRes);
      setSelectedClassId((prev) => (prev && clsRes.some((c) => c.id === prev) ? prev : clsRes[0]?.id ?? ''));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load subjects');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  const sectionMap = useMemo(() => new Map(sections.map((s) => [s.id, s])), [sections]);
  const classSubjects = useMemo(
    () => subjects.filter((s) => s.classId === selectedClassId),
    [subjects, selectedClassId]
  );
  const totalCoef = useMemo(
    () => classSubjects.reduce((sum, s) => sum + s.coefficient, 0),
    [classSubjects]
  );

  function openNew() {
    setEditing(null);
    setNameEn('');
    setNameFr('');
    setCode('');
    setCoefficient('2');
    setModalOpen(true);
  }

  function openEdit(sub: SubjectItem) {
    setEditing(sub);
    setNameEn(sub.nameEn);
    setNameFr(sub.nameFr);
    setCode(sub.code);
    setCoefficient(String(sub.coefficient));
    setModalOpen(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const coefNum = Number(coefficient);
      if (editing) {
        await api.updateSubject(editing.id, { nameEn, nameFr, code, coefficient: coefNum });
      } else {
        await api.createSubject({
          classId: selectedClassId,
          nameEn,
          nameFr,
          code,
          coefficient: coefNum,
        });
      }
      setModalOpen(false);
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save subject');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-[#f1f3f4]">
            {t.subjectsTitle}
          </h1>
          <p className="mt-1 text-sm text-[#9aa0a6]">{t.subjectsDesc}</p>
        </div>
        <button
          type="button"
          disabled={!selectedClassId}
          onClick={openNew}
          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl bg-[#8ab4f8] px-4 py-2 text-xs font-semibold text-[#0b0d12] hover:bg-[#a8c7fa] disabled:opacity-50"
        >
          <Plus className="h-3.5 w-3.5" />
          {t.addSubject}
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs font-medium text-red-300">
          {error}
        </div>
      )}

      {/* Class Selector */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#242936] bg-[#13161d]/90 p-4 backdrop-blur-sm">
        <div className="flex items-center gap-3">
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
        <div className="text-xs text-[#9aa0a6]">
          <span>{t.totalCoef}:</span>{' '}
          <span className="font-mono-num font-bold text-[#8ab4f8]">{totalCoef}</span>
        </div>
      </div>

      {/* Subjects Table */}
      <div className="overflow-hidden rounded-2xl border border-[#242936] bg-[#13161d]/90 backdrop-blur-sm">
        <div className="studio-table-wrap overflow-x-auto">
          <table className="studio-table text-left text-sm">
            <thead>
              <tr className="bg-[#0e1117] text-xs font-semibold text-[#9aa0a6]">
                <th className="px-4 py-3">{t.subjectCode}</th>
                <th className="px-4 py-3">{t.subjectNameEn}</th>
                <th className="px-4 py-3">{t.subjectNameFr}</th>
                <th className="px-4 py-3 text-right">{t.coefficient}</th>
                <th className="px-4 py-3">{t.assignedTeacherCol}</th>
                <th className="px-4 py-3 text-right">{t.actions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1f2430]">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-xs text-[#9aa0a6]">
                    {t.loading}
                  </td>
                </tr>
              ) : classSubjects.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-[#9aa0a6]">
                    {t.noSubjectsFound}
                  </td>
                </tr>
              ) : (
                classSubjects.map((sub) => {
                  const subTeachers = assignments
                    .filter((a) => a.subjectId === sub.id && a.classId === selectedClassId)
                    .map((a) => a.teacherName);

                  return (
                    <tr key={sub.id} className="hover:bg-[#191d27]">
                      <td className="font-mono-num whitespace-nowrap px-4 py-3 text-xs font-semibold text-[#8ab4f8]">
                        {sub.code || '—'}
                      </td>
                      <td className="px-4 py-3 font-medium text-[#f1f3f4]">{sub.nameEn}</td>
                      <td className="px-4 py-3 text-[#bdc1c6]">{sub.nameFr}</td>
                      <td className="font-mono-num whitespace-nowrap px-4 py-3 text-right font-semibold text-[#f1f3f4]">
                        {sub.coefficient}
                      </td>
                      <td className="px-4 py-3 text-xs text-[#9aa0a6]">
                        {subTeachers.length > 0 ? subTeachers.join(', ') : t.unassigned}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openEdit(sub)}
                            className="rounded-xl px-2.5 py-1 text-xs font-medium text-[#8ab4f8] hover:bg-[#1f2533]"
                          >
                            {t.edit}
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(sub)}
                            className="rounded-xl px-2.5 py-1 text-xs font-medium text-red-400 hover:bg-red-500/10"
                          >
                            {t.delete}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-[#2d3342] bg-[#13161d] p-6 shadow-2xl">
            <h2 className="font-display text-lg font-semibold text-[#f1f3f4]">
              {editing ? t.editSubject : t.addSubject}
            </h2>
            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#bdc1c6]">{t.subjectNameEn}</label>
                <input
                  type="text"
                  required
                  value={nameEn}
                  onChange={(e) => setNameEn(e.target.value)}
                  placeholder="Mathematics"
                  className="mt-1 w-full rounded-xl border border-[#2c3240] bg-[#0d1016] px-3 py-2 text-sm text-[#e8eaed] outline-none focus:border-[#8ab4f8]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#bdc1c6]">{t.subjectNameFr}</label>
                <input
                  type="text"
                  required
                  value={nameFr}
                  onChange={(e) => setNameFr(e.target.value)}
                  placeholder="Mathématiques"
                  className="mt-1 w-full rounded-xl border border-[#2c3240] bg-[#0d1016] px-3 py-2 text-sm text-[#e8eaed] outline-none focus:border-[#8ab4f8]"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#bdc1c6]">{t.subjectCode}</label>
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="MAT"
                    className="mt-1 w-full rounded-xl border border-[#2c3240] bg-[#0d1016] px-3 py-2 text-sm uppercase text-[#e8eaed] outline-none focus:border-[#8ab4f8]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#bdc1c6]">{t.coefficient}</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    max="20"
                    required
                    value={coefficient}
                    onChange={(e) => setCoefficient(e.target.value)}
                    className="font-mono-num mt-1 w-full rounded-xl border border-[#2c3240] bg-[#0d1016] px-3 py-2 text-sm text-[#e8eaed] outline-none focus:border-[#8ab4f8]"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-xl border border-[#2c3240] px-4 py-2 text-xs font-semibold text-[#bdc1c6] hover:bg-[#1e232f]"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-[#8ab4f8] px-4 py-2 text-xs font-semibold text-[#0b0d12] hover:bg-[#a8c7fa]"
                >
                  {t.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        message={t.deleteConfirmSubject}
        lang={lang}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (deleteTarget) {
            await api.deleteSubject(deleteTarget.id);
            setDeleteTarget(null);
            await loadAll();
          }
        }}
      />
    </div>
  );
}
