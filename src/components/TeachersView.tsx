import { useEffect, useState, type FormEvent } from 'react';
import { Plus } from 'lucide-react';
import { api } from '../api';
import { translations } from '../i18n';
import type { AssignmentItem, Language, UserProfile } from '../types';
import { ConfirmDialog } from './ConfirmDialog';

export function TeachersView({ lang }: { lang: Language }) {
  const t = translations[lang];
  const [teachers, setTeachers] = useState<UserProfile[]>([]);
  const [assignments, setAssignments] = useState<AssignmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<UserProfile | null>(null);
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [active, setActive] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<UserProfile | null>(null);

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      const [tchRes, asgRes] = await Promise.all([api.getTeachers(), api.getAssignments()]);
      setTeachers(tchRes);
      setAssignments(asgRes);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load teachers');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  function openNew() {
    setEditing(null);
    setFullName('');
    setUsername('');
    setEmail('');
    setPassword('');
    setActive(true);
    setModalOpen(true);
  }

  function openEdit(tch: UserProfile) {
    setEditing(tch);
    setFullName(tch.fullName);
    setUsername(tch.username);
    setEmail(tch.email);
    setPassword('');
    setActive(tch.active);
    setModalOpen(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      if (editing) {
        await api.updateTeacher(editing.id, {
          fullName,
          username,
          email,
          active,
          ...(password.trim() ? { password } : {}),
        });
      } else {
        await api.createTeacher({ fullName, username, email, password });
      }
      setModalOpen(false);
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save teacher');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-[#f1f3f4]">
            {t.teachersTitle}
          </h1>
          <p className="mt-1 text-sm text-[#9aa0a6]">{t.teachersDesc}</p>
        </div>
        <button
          type="button"
          onClick={openNew}
          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl bg-[#8ab4f8] px-4 py-2 text-xs font-semibold text-[#0b0d12] hover:bg-[#a8c7fa]"
        >
          <Plus className="h-3.5 w-3.5" />
          {t.addTeacher}
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs font-medium text-red-300">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-[#242936] bg-[#13161d]/90 backdrop-blur-sm">
        <div className="studio-table-wrap overflow-x-auto">
          <table className="studio-table text-left text-sm">
            <thead>
              <tr className="bg-[#0e1117] text-xs font-semibold text-[#9aa0a6]">
                <th className="px-4 py-3">{t.fullName}</th>
                <th className="px-4 py-3">{t.username}</th>
                <th className="px-4 py-3">{t.email}</th>
                <th className="px-4 py-3 text-right">{t.assignedSubjectsCount}</th>
                <th className="px-4 py-3">{t.status}</th>
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
              ) : teachers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-[#9aa0a6]">
                    {t.noTeachersFound}
                  </td>
                </tr>
              ) : (
                teachers.map((tch) => {
                  const count = assignments.filter((a) => a.teacherId === tch.id).length;
                  return (
                    <tr key={tch.id} className="hover:bg-[#191d27]">
                      <td className="whitespace-nowrap px-4 py-3 font-medium text-[#f1f3f4]">
                        {tch.fullName}
                      </td>
                      <td className="font-mono-num whitespace-nowrap px-4 py-3 text-xs text-[#8ab4f8]">
                        {tch.username}
                      </td>
                      <td className="px-4 py-3 text-xs text-[#9aa0a6]">{tch.email}</td>
                      <td className="font-mono-num whitespace-nowrap px-4 py-3 text-right font-semibold text-[#f1f3f4]">
                        {count}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs font-medium">
                        <span className={tch.active ? 'text-[#81c995]' : 'text-[#7f8794]'}>
                          {tch.active ? t.active : t.inactive}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openEdit(tch)}
                            className="rounded-xl px-2.5 py-1 text-xs font-medium text-[#8ab4f8] hover:bg-[#1f2533]"
                          >
                            {t.edit}
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(tch)}
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

      {/* Add / Edit Teacher Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-[#2d3342] bg-[#13161d] p-6 shadow-2xl">
            <h2 className="font-display text-lg font-semibold text-[#f1f3f4]">
              {editing ? t.editTeacher : t.addTeacher}
            </h2>
            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#bdc1c6]">{t.fullName}</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-[#2c3240] bg-[#0d1016] px-3 py-2 text-sm text-[#e8eaed] outline-none focus:border-[#8ab4f8]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#bdc1c6]">{t.username}</label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="j.doe"
                  className="mt-1 w-full rounded-xl border border-[#2c3240] bg-[#0d1016] px-3 py-2 text-sm text-[#e8eaed] outline-none focus:border-[#8ab4f8]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#bdc1c6]">{t.email}</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="teacher@school.edu"
                  className="mt-1 w-full rounded-xl border border-[#2c3240] bg-[#0d1016] px-3 py-2 text-sm text-[#e8eaed] outline-none focus:border-[#8ab4f8]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#bdc1c6]">
                  {editing ? t.newPasswordOptional : t.initialPassword}
                </label>
                <input
                  type="password"
                  required={!editing}
                  minLength={editing ? undefined : 4}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-[#2c3240] bg-[#0d1016] px-3 py-2 text-sm text-[#e8eaed] outline-none focus:border-[#8ab4f8]"
                />
              </div>
              {editing && (
                <div>
                  <label className="block text-xs font-medium text-[#bdc1c6]">{t.status}</label>
                  <select
                    value={active ? 'active' : 'inactive'}
                    onChange={(e) => setActive(e.target.value === 'active')}
                    className="mt-1 w-full rounded-xl border border-[#2c3240] bg-[#0d1016] px-3 py-2 text-sm text-[#e8eaed] outline-none focus:border-[#8ab4f8]"
                  >
                    <option value="active">{t.active}</option>
                    <option value="inactive">{t.inactive}</option>
                  </select>
                </div>
              )}

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
        message={t.deleteConfirmTeacher}
        lang={lang}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (deleteTarget) {
            await api.deleteTeacher(deleteTarget.id);
            setDeleteTarget(null);
            await loadAll();
          }
        }}
      />
    </div>
  );
}
