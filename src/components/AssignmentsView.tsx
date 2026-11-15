import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Plus } from 'lucide-react';
import { api } from '../api';
import { translations } from '../i18n';
import type { AssignmentItem, ClassItem, Language, SubjectItem, UserProfile } from '../types';
import { ConfirmDialog } from './ConfirmDialog';

export function AssignmentsView({ lang }: { lang: Language }) {
  const t = translations[lang];
  const [viewMode, setViewMode] = useState<'matrix' | 'list'>('matrix');
  const [teachers, setTeachers] = useState<UserProfile[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [assignments, setAssignments] = useState<AssignmentItem[]>([]);
  const [filterTeacherId, setFilterTeacherId] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AssignmentItem | null>(null);
  const [formTeacherId, setFormTeacherId] = useState('');
  const [formClassId, setFormClassId] = useState('');
  const [formSubjectId, setFormSubjectId] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<AssignmentItem | null>(null);

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      const [tchRes, clsRes, subRes, asgRes] = await Promise.all([
        api.getTeachers(),
        api.getClasses(),
        api.getSubjects(),
        api.getAssignments(),
      ]);
      setTeachers(tchRes);
      setClasses(clsRes);
      setSubjects(subRes);
      setAssignments(asgRes);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load assignments');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  const classSubjects = useMemo(
    () => subjects.filter((s) => s.classId === formClassId),
    [subjects, formClassId]
  );

  const filteredAssignments = useMemo(() => {
    if (filterTeacherId === 'all') return assignments;
    return assignments.filter((a) => a.teacherId === filterTeacherId);
  }, [assignments, filterTeacherId]);

  function openNew() {
    const firstClassId = classes[0]?.id ?? '';
    const firstSubId = subjects.find((s) => s.classId === firstClassId)?.id ?? '';
    setEditing(null);
    setFormTeacherId(teachers[0]?.id ?? '');
    setFormClassId(firstClassId);
    setFormSubjectId(firstSubId);
    setModalOpen(true);
  }

  function openEdit(asg: AssignmentItem) {
    setEditing(asg);
    setFormTeacherId(asg.teacherId);
    setFormClassId(asg.classId);
    setFormSubjectId(asg.subjectId);
    setModalOpen(true);
  }

  function handleClassChange(nextClassId: string) {
    setFormClassId(nextClassId);
    const firstSub = subjects.find((s) => s.classId === nextClassId);
    setFormSubjectId(firstSub?.id ?? '');
  }

  async function handleQuickMatrixAssign(classId: string, subjectId: string, nextTeacherId: string) {
    setError(null);
    const existingForSub = assignments.find((a) => a.classId === classId && a.subjectId === subjectId);
    try {
      if (!nextTeacherId) {
        if (existingForSub) {
          await api.deleteAssignment(existingForSub.id);
        }
      } else if (existingForSub) {
        await api.updateAssignment(existingForSub.id, {
          teacherId: nextTeacherId,
          classId,
          subjectId,
        });
      } else {
        await api.createAssignment({ teacherId: nextTeacherId, classId, subjectId });
      }
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update access');
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      if (editing) {
        await api.updateAssignment(editing.id, {
          teacherId: formTeacherId,
          classId: formClassId,
          subjectId: formSubjectId,
        });
      } else {
        await api.createAssignment({
          teacherId: formTeacherId,
          classId: formClassId,
          subjectId: formSubjectId,
        });
      }
      setModalOpen(false);
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save access assignment');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-[#f1f3f4]">
            {t.assignmentsTitle}
          </h1>
          <p className="mt-1 text-sm text-[#9aa0a6]">{t.assignmentsDesc}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-xl border border-[#242936] bg-[#13161d] p-1">
            <button
              type="button"
              onClick={() => setViewMode('matrix')}
              className={`whitespace-nowrap rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors ${
                viewMode === 'matrix'
                  ? 'bg-[#232836] text-[#8ab4f8]'
                  : 'text-[#9aa0a6] hover:text-[#e8eaed]'
              }`}
            >
              {t.viewMatrix}
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`whitespace-nowrap rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors ${
                viewMode === 'list'
                  ? 'bg-[#232836] text-[#8ab4f8]'
                  : 'text-[#9aa0a6] hover:text-[#e8eaed]'
              }`}
            >
              {t.viewList}
            </button>
          </div>

          <button
            type="button"
            disabled={teachers.length === 0 || subjects.length === 0}
            onClick={openNew}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl bg-[#8ab4f8] px-4 py-2 text-xs font-semibold text-[#0b0d12] hover:bg-[#a8c7fa] disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" />
            {t.grantAccess}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs font-medium text-red-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="h-48 animate-pulse rounded-2xl border border-[#242936] bg-[#13161d]" />
      ) : viewMode === 'matrix' ? (
        <div className="space-y-4">
          {classes.map((cls) => {
            const clsSubs = subjects.filter((s) => s.classId === cls.id);
            return (
              <div
                key={cls.id}
                className="overflow-hidden rounded-2xl border border-[#242936] bg-[#13161d]/90 backdrop-blur-sm"
              >
                <div className="flex items-center justify-between border-b border-[#222733] bg-[#0e1117] px-5 py-3">
                  <h2 className="font-display text-sm font-semibold text-[#f1f3f4]">{cls.name}</h2>
                  <span className="font-mono-num text-xs text-[#9aa0a6]">
                    {clsSubs.length} {t.subjectsCount}
                  </span>
                </div>
                {clsSubs.length === 0 ? (
                  <p className="px-5 py-4 text-xs text-[#7f8794]">{t.noSubjectsFound}</p>
                ) : (
                  <div className="studio-table-wrap overflow-x-auto">
                    <table className="studio-table text-left text-sm">
                      <thead>
                        <tr className="bg-[#0e1117] text-xs font-semibold text-[#9aa0a6]">
                          <th className="w-20 px-4 py-2.5">{t.subjectCode}</th>
                          <th className="px-4 py-2.5">{t.subject}</th>
                          <th className="w-24 px-4 py-2.5 text-right">{t.coefficient}</th>
                          <th className="px-4 py-2.5">{t.assignedTeacherCol}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {clsSubs.map((sub) => {
                          const matched = assignments.find(
                            (a) => a.classId === cls.id && a.subjectId === sub.id
                          );
                          return (
                            <tr key={sub.id} className="hover:bg-[#191d27]">
                              <td className="font-mono-num whitespace-nowrap px-4 py-2.5 text-xs font-semibold text-[#8ab4f8]">
                                {sub.code || '—'}
                              </td>
                              <td className="px-4 py-2.5 font-medium text-[#f1f3f4]">
                                {lang === 'fr' ? sub.nameFr : sub.nameEn}
                              </td>
                              <td className="font-mono-num whitespace-nowrap px-4 py-2.5 text-right text-xs text-[#bdc1c6]">
                                {sub.coefficient}
                              </td>
                              <td className="px-4 py-2.5">
                                <select
                                  value={matched?.teacherId ?? ''}
                                  onChange={(e) => handleQuickMatrixAssign(cls.id, sub.id, e.target.value)}
                                  className={`w-full max-w-xs rounded-xl border px-3 py-1.5 text-xs font-medium outline-none focus:border-[#8ab4f8] ${
                                    matched
                                      ? 'border-[#33415c] bg-[#182133] text-[#8ab4f8]'
                                      : 'border-[#2c3240] bg-[#0d1016] text-[#9aa0a6]'
                                  }`}
                                >
                                  <option value="">{t.unassigned}</option>
                                  {teachers.map((tch) => (
                                    <option key={tch.id} value={tch.id}>
                                      {tch.fullName} ({tch.username})
                                    </option>
                                  ))}
                                </select>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3 rounded-2xl border border-[#242936] bg-[#13161d]/90 p-4">
            <label className="text-xs font-semibold text-[#bdc1c6]">{t.filterByTeacher}:</label>
            <select
              value={filterTeacherId}
              onChange={(e) => setFilterTeacherId(e.target.value)}
              className="rounded-xl border border-[#2c3240] bg-[#0d1016] px-3 py-2 text-sm text-[#e8eaed] outline-none focus:border-[#8ab4f8]"
            >
              <option value="all">{t.allTeachers}</option>
              {teachers.map((tch) => (
                <option key={tch.id} value={tch.id}>
                  {tch.fullName} ({tch.username})
                </option>
              ))}
            </select>
          </div>

          <div className="overflow-hidden rounded-2xl border border-[#242936] bg-[#13161d]/90">
            <div className="studio-table-wrap overflow-x-auto">
              <table className="studio-table text-left text-sm">
                <thead>
                  <tr className="bg-[#0e1117] text-xs font-semibold text-[#9aa0a6]">
                    <th className="px-4 py-3">{t.teacher}</th>
                    <th className="px-4 py-3">{t.sectionCol}</th>
                    <th className="px-4 py-3">{t.classCol}</th>
                    <th className="px-4 py-3">{t.subject}</th>
                    <th className="px-4 py-3 text-right">{t.coefficient}</th>
                    <th className="px-4 py-3 text-right">{t.actions}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1f2430]">
                  {filteredAssignments.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-sm text-[#9aa0a6]">
                        {t.noAssignmentsFound}
                      </td>
                    </tr>
                  ) : (
                    filteredAssignments.map((asg) => (
                      <tr key={asg.id} className="hover:bg-[#191d27]">
                        <td className="whitespace-nowrap px-4 py-3">
                          <span className="font-medium text-[#f1f3f4]">{asg.teacherName}</span>
                          <span className="mx-1.5 text-[#5f6368]">·</span>
                          <span className="font-mono-num text-xs text-[#8ab4f8]">
                            {asg.teacherUsername}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-xs text-[#9aa0a6]">
                          {lang === 'fr' ? asg.sectionNameFr : asg.sectionNameEn}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 font-medium text-[#e8eaed]">
                          {asg.className}
                        </td>
                        <td className="px-4 py-3 text-[#e8eaed]">
                          {lang === 'fr' ? asg.subjectNameFr : asg.subjectNameEn}
                        </td>
                        <td className="font-mono-num whitespace-nowrap px-4 py-3 text-right font-semibold text-[#f1f3f4]">
                          {asg.coefficient}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => openEdit(asg)}
                              className="rounded-xl px-2.5 py-1 text-xs font-medium text-[#8ab4f8] hover:bg-[#1f2533]"
                            >
                              {t.edit}
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(asg)}
                              className="rounded-xl px-2.5 py-1 text-xs font-medium text-red-400 hover:bg-red-500/10"
                            >
                              {t.revokeAccess}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Assign / Modify Access Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-[#2d3342] bg-[#13161d] p-6 shadow-2xl">
            <h2 className="font-display text-lg font-semibold text-[#f1f3f4]">
              {editing ? t.modifyAccess : t.grantAccess}
            </h2>
            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#bdc1c6]">{t.selectTeacher}</label>
                <select
                  required
                  value={formTeacherId}
                  onChange={(e) => setFormTeacherId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-[#2c3240] bg-[#0d1016] px-3 py-2 text-sm text-[#e8eaed] outline-none focus:border-[#8ab4f8]"
                >
                  {teachers.map((tch) => (
                    <option key={tch.id} value={tch.id}>
                      {tch.fullName} ({tch.username})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#bdc1c6]">{t.selectClass}</label>
                <select
                  required
                  value={formClassId}
                  onChange={(e) => handleClassChange(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-[#2c3240] bg-[#0d1016] px-3 py-2 text-sm text-[#e8eaed] outline-none focus:border-[#8ab4f8]"
                >
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#bdc1c6]">{t.selectSubject}</label>
                <select
                  required
                  value={formSubjectId}
                  onChange={(e) => setFormSubjectId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-[#2c3240] bg-[#0d1016] px-3 py-2 text-sm text-[#e8eaed] outline-none focus:border-[#8ab4f8]"
                >
                  {classSubjects.map((sub) => (
                    <option key={sub.id} value={sub.id}>
                      {lang === 'fr' ? sub.nameFr : sub.nameEn} (Coef {sub.coefficient})
                    </option>
                  ))}
                </select>
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
                  disabled={!formTeacherId || !formClassId || !formSubjectId}
                  className="rounded-xl bg-[#8ab4f8] px-4 py-2 text-xs font-semibold text-[#0b0d12] hover:bg-[#a8c7fa] disabled:opacity-50"
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
        message={t.deleteConfirmAssignment}
        lang={lang}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (deleteTarget) {
            await api.deleteAssignment(deleteTarget.id);
            setDeleteTarget(null);
            await loadAll();
          }
        }}
      />
    </div>
  );
}
