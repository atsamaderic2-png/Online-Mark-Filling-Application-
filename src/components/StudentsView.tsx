import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Plus, Search } from 'lucide-react';
import { api } from '../api';
import { translations } from '../i18n';
import type { ClassItem, Language, SectionItem, StudentItem } from '../types';
import { ConfirmDialog } from './ConfirmDialog';

export function StudentsView({ lang }: { lang: Language }) {
  const t = translations[lang];
  const [sections, setSections] = useState<SectionItem[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<StudentItem | null>(null);
  const [formClassId, setFormClassId] = useState('');
  const [formMatricule, setFormMatricule] = useState('');
  const [formFullName, setFormFullName] = useState('');
  const [formDob, setFormDob] = useState('');
  const [formPob, setFormPob] = useState('');
  const [formSex, setFormSex] = useState<'M' | 'F'>('M');
  const [formRepeater, setFormRepeater] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<StudentItem | null>(null);

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      const [secRes, clsRes, stuRes] = await Promise.all([
        api.getSections(),
        api.getClasses(),
        api.getStudents(),
      ]);
      setSections(secRes);
      setClasses(clsRes);
      setStudents(stuRes);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load students');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  const classMap = useMemo(() => new Map(classes.map((c) => [c.id, c])), [classes]);
  const sectionMap = useMemo(() => new Map(sections.map((s) => [s.id, s])), [sections]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return students.filter((st) => {
      if (selectedClassId !== 'all' && st.classId !== selectedClassId) return false;
      if (q && !st.fullName.toLowerCase().includes(q) && !st.matricule.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [students, selectedClassId, search]);

  function openNew() {
    setEditing(null);
    setFormClassId(selectedClassId !== 'all' ? selectedClassId : classes[0]?.id ?? '');
    setFormMatricule('');
    setFormFullName('');
    setFormDob('2010-01-01');
    setFormPob('');
    setFormSex('M');
    setFormRepeater(false);
    setModalOpen(true);
  }

  function openEdit(st: StudentItem) {
    setEditing(st);
    setFormClassId(st.classId);
    setFormMatricule(st.matricule);
    setFormFullName(st.fullName);
    setFormDob(st.dateOfBirth);
    setFormPob(st.placeOfBirth);
    setFormSex(st.sex);
    setFormRepeater(st.repeater);
    setModalOpen(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const payload = {
        classId: formClassId,
        matricule: formMatricule,
        fullName: formFullName,
        dateOfBirth: formDob,
        placeOfBirth: formPob,
        sex: formSex,
        repeater: formRepeater,
      };
      if (editing) {
        await api.updateStudent(editing.id, payload);
      } else {
        await api.createStudent(payload);
      }
      setModalOpen(false);
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save student');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-[#f1f3f4]">
            {t.studentsTitle}
          </h1>
          <p className="mt-1 text-sm text-[#9aa0a6]">{t.studentsDesc}</p>
        </div>
        <button
          type="button"
          disabled={classes.length === 0}
          onClick={openNew}
          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl bg-[#8ab4f8] px-4 py-2 text-xs font-semibold text-[#0b0d12] hover:bg-[#a8c7fa] disabled:opacity-50"
        >
          <Plus className="h-3.5 w-3.5" />
          {t.addStudent}
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs font-medium text-red-300">
          {error}
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[#242936] bg-[#13161d]/90 p-4 backdrop-blur-sm">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[#7f8794]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.searchStudents}
            className="w-full rounded-xl border border-[#2c3240] bg-[#0d1016] py-2 pr-3 pl-9 text-sm text-[#e8eaed] placeholder-[#68707d] outline-none focus:border-[#8ab4f8]"
          />
        </div>
        <select
          value={selectedClassId}
          onChange={(e) => setSelectedClassId(e.target.value)}
          className="rounded-xl border border-[#2c3240] bg-[#0d1016] px-3 py-2 text-sm text-[#e8eaed] outline-none focus:border-[#8ab4f8]"
        >
          <option value="all">{t.allClasses}</option>
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

      {/* Students Table */}
      <div className="overflow-hidden rounded-2xl border border-[#242936] bg-[#13161d]/90 backdrop-blur-sm">
        <div className="studio-table-wrap overflow-x-auto">
          <table className="studio-table text-left text-sm">
            <thead>
              <tr className="bg-[#0e1117] text-xs font-semibold text-[#9aa0a6]">
                <th className="px-4 py-3">{t.matricule}</th>
                <th className="px-4 py-3">{t.fullName}</th>
                <th className="px-4 py-3">{t.classCol}</th>
                <th className="px-4 py-3">{t.dateOfBirth}</th>
                <th className="px-4 py-3">{t.placeOfBirth}</th>
                <th className="px-4 py-3">{t.sex}</th>
                <th className="px-4 py-3">{t.repeater}</th>
                <th className="px-4 py-3 text-right">{t.actions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1f2430]">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-xs text-[#9aa0a6]">
                    {t.loading}
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-sm text-[#9aa0a6]">
                    {t.noStudentsFound}
                  </td>
                </tr>
              ) : (
                filtered.map((st) => {
                  const cls = classMap.get(st.classId);
                  return (
                    <tr key={st.id} className="hover:bg-[#191d27]">
                      <td className="font-mono-num whitespace-nowrap px-4 py-3 text-xs font-medium text-[#8ab4f8]">
                        {st.matricule}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 font-medium text-[#f1f3f4]">
                        {st.fullName}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-[#bdc1c6]">
                        {cls?.name ?? '—'}
                      </td>
                      <td className="font-mono-num whitespace-nowrap px-4 py-3 text-xs text-[#9aa0a6]">
                        {st.dateOfBirth}
                      </td>
                      <td className="px-4 py-3 text-[#9aa0a6]">{st.placeOfBirth}</td>
                      <td className="whitespace-nowrap px-4 py-3 font-medium text-[#bdc1c6]">
                        {st.sex}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-[#bdc1c6]">
                        {st.repeater ? t.yes : t.no}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openEdit(st)}
                            className="rounded-xl px-2.5 py-1 text-xs font-medium text-[#8ab4f8] hover:bg-[#1f2533]"
                          >
                            {t.edit}
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(st)}
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
          <div className="w-full max-w-lg rounded-2xl border border-[#2d3342] bg-[#13161d] p-6 shadow-2xl">
            <h2 className="font-display text-lg font-semibold text-[#f1f3f4]">
              {editing ? t.editStudent : t.addStudent}
            </h2>
            <form onSubmit={handleSubmit} className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-[#bdc1c6]">{t.fullName}</label>
                <input
                  type="text"
                  required
                  value={formFullName}
                  onChange={(e) => setFormFullName(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-[#2c3240] bg-[#0d1016] px-3 py-2 text-sm text-[#e8eaed] outline-none focus:border-[#8ab4f8]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#bdc1c6]">{t.selectClass}</label>
                <select
                  required
                  value={formClassId}
                  onChange={(e) => setFormClassId(e.target.value)}
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
                <label className="block text-xs font-medium text-[#bdc1c6]">{t.matricule}</label>
                <input
                  type="text"
                  value={formMatricule}
                  onChange={(e) => setFormMatricule(e.target.value)}
                  placeholder="Auto"
                  className="mt-1 w-full rounded-xl border border-[#2c3240] bg-[#0d1016] px-3 py-2 text-sm text-[#e8eaed] outline-none focus:border-[#8ab4f8]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#bdc1c6]">{t.dateOfBirth}</label>
                <input
                  type="date"
                  required
                  value={formDob}
                  onChange={(e) => setFormDob(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-[#2c3240] bg-[#0d1016] px-3 py-2 text-sm text-[#e8eaed] outline-none focus:border-[#8ab4f8]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#bdc1c6]">{t.placeOfBirth}</label>
                <input
                  type="text"
                  required
                  value={formPob}
                  onChange={(e) => setFormPob(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-[#2c3240] bg-[#0d1016] px-3 py-2 text-sm text-[#e8eaed] outline-none focus:border-[#8ab4f8]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#bdc1c6]">{t.sex}</label>
                <select
                  value={formSex}
                  onChange={(e) => setFormSex(e.target.value as 'M' | 'F')}
                  className="mt-1 w-full rounded-xl border border-[#2c3240] bg-[#0d1016] px-3 py-2 text-sm text-[#e8eaed] outline-none focus:border-[#8ab4f8]"
                >
                  <option value="M">{t.male}</option>
                  <option value="F">{t.female}</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#bdc1c6]">{t.repeater}</label>
                <select
                  value={formRepeater ? 'yes' : 'no'}
                  onChange={(e) => setFormRepeater(e.target.value === 'yes')}
                  className="mt-1 w-full rounded-xl border border-[#2c3240] bg-[#0d1016] px-3 py-2 text-sm text-[#e8eaed] outline-none focus:border-[#8ab4f8]"
                >
                  <option value="no">{t.no}</option>
                  <option value="yes">{t.yes}</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2 sm:col-span-2">
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
        message={t.deleteConfirmStudent}
        lang={lang}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (deleteTarget) {
            await api.deleteStudent(deleteTarget.id);
            setDeleteTarget(null);
            await loadAll();
          }
        }}
      />
    </div>
  );
}
