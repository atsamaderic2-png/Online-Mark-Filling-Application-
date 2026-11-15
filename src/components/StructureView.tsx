import { useEffect, useState, type FormEvent } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { api } from '../api';
import { translations } from '../i18n';
import type { ClassItem, Language, SectionItem, SectionType } from '../types';
import { ConfirmDialog } from './ConfirmDialog';

export function StructureView({ lang }: { lang: Language }) {
  const t = translations[lang];
  const [sections, setSections] = useState<SectionItem[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [secModalOpen, setSecModalOpen] = useState(false);
  const [editingSec, setEditingSec] = useState<SectionItem | null>(null);
  const [secNameEn, setSecNameEn] = useState('');
  const [secNameFr, setSecNameFr] = useState('');
  const [secType, setSecType] = useState<SectionType>('anglophone');

  const [clsModalOpen, setClsModalOpen] = useState(false);
  const [editingCls, setEditingCls] = useState<ClassItem | null>(null);
  const [clsSectionId, setClsSectionId] = useState('');
  const [clsName, setClsName] = useState('');
  const [clsLevel, setClsLevel] = useState('');

  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    message: string;
    action: () => Promise<void>;
  }>({ open: false, message: '', action: async () => {} });

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      const [secRes, clsRes] = await Promise.all([api.getSections(), api.getClasses()]);
      setSections(secRes);
      setClasses(clsRes);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load structure');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  function openNewSection() {
    setEditingSec(null);
    setSecNameEn('');
    setSecNameFr('');
    setSecType('anglophone');
    setSecModalOpen(true);
  }

  function openEditSection(sec: SectionItem) {
    setEditingSec(sec);
    setSecNameEn(sec.nameEn);
    setSecNameFr(sec.nameFr);
    setSecType(sec.type);
    setSecModalOpen(true);
  }

  async function saveSection(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      if (editingSec) {
        await api.updateSection(editingSec.id, { nameEn: secNameEn, nameFr: secNameFr, type: secType });
      } else {
        await api.createSection({ nameEn: secNameEn, nameFr: secNameFr, type: secType });
      }
      setSecModalOpen(false);
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save section');
    }
  }

  function openNewClass(defaultSectionId?: string) {
    setEditingCls(null);
    setClsSectionId(defaultSectionId || sections[0]?.id || '');
    setClsName('');
    setClsLevel('');
    setClsModalOpen(true);
  }

  function openEditClass(cls: ClassItem) {
    setEditingCls(cls);
    setClsSectionId(cls.sectionId);
    setClsName(cls.name);
    setClsLevel(cls.level);
    setClsModalOpen(true);
  }

  async function saveClass(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      if (editingCls) {
        await api.updateClass(editingCls.id, { sectionId: clsSectionId, name: clsName, level: clsLevel });
      } else {
        await api.createClass({ sectionId: clsSectionId, name: clsName, level: clsLevel });
      }
      setClsModalOpen(false);
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save class');
    }
  }

  const typeLabel = (type: SectionType) => {
    if (type === 'anglophone') return t.typeAnglophone;
    if (type === 'francophone') return t.typeFrancophone;
    if (type === 'general') return t.typeGeneral;
    return t.typeTechnical;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-[#f1f3f4]">
            {t.structureTitle}
          </h1>
          <p className="mt-1 text-sm text-[#9aa0a6]">{t.structureDesc}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={openNewSection}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-[#2c3240] bg-[#161a23] px-3.5 py-2 text-xs font-semibold text-[#e8eaed] hover:bg-[#1e2430]"
          >
            <Plus className="h-3.5 w-3.5" />
            {t.addSection}
          </button>
          <button
            type="button"
            disabled={sections.length === 0}
            onClick={() => openNewClass()}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl bg-[#8ab4f8] px-3.5 py-2 text-xs font-semibold text-[#0b0d12] hover:bg-[#a8c7fa] disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" />
            {t.addClass}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs font-medium text-red-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          <div className="h-32 animate-pulse rounded-2xl border border-[#242936] bg-[#13161d]" />
          <div className="h-32 animate-pulse rounded-2xl border border-[#242936] bg-[#13161d]" />
        </div>
      ) : (
        <div className="space-y-4">
          {sections.map((sec) => {
            const secClasses = classes.filter((c) => c.sectionId === sec.id);
            return (
              <div
                key={sec.id}
                className="overflow-hidden rounded-2xl border border-[#242936] bg-[#13161d]/90 backdrop-blur-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#222733] px-5 py-4">
                  <div>
                    <h2 className="font-display text-base font-semibold text-[#f1f3f4]">
                      {lang === 'fr' ? sec.nameFr : sec.nameEn}
                    </h2>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-[#9aa0a6]">
                      <span>{lang === 'fr' ? sec.nameEn : sec.nameFr}</span>
                      <span aria-hidden="true">·</span>
                      <span className="text-[#8ab4f8]">{typeLabel(sec.type)}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono-num">
                        {secClasses.length} {t.classesCount}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openNewClass(sec.id)}
                      className="inline-flex items-center gap-1 whitespace-nowrap rounded-xl border border-[#2c3240] bg-[#191d27] px-3 py-1.5 text-xs font-medium text-[#e8eaed] hover:bg-[#232836]"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      {t.addClass}
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditSection(sec)}
                      aria-label={t.editSection}
                      className="rounded-xl border border-[#2c3240] p-1.5 text-[#9aa0a6] hover:bg-[#1e232f] hover:text-[#f1f3f4]"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setConfirmState({
                          open: true,
                          message: t.deleteConfirmSection,
                          action: async () => {
                            await api.deleteSection(sec.id);
                            await loadAll();
                          },
                        })
                      }
                      aria-label={t.delete}
                      className="rounded-xl border border-[#2c3240] p-1.5 text-[#9aa0a6] hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-300"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {secClasses.length === 0 ? (
                  <p className="px-5 py-6 text-xs text-[#7f8794]">{t.noClassesInSection}</p>
                ) : (
                  <div className="studio-table-wrap overflow-x-auto">
                    <table className="studio-table text-left text-sm">
                      <thead>
                        <tr className="bg-[#0e1117] text-xs font-semibold text-[#9aa0a6]">
                          <th className="px-4 py-2.5">{t.classCol}</th>
                          <th className="px-4 py-2.5">{t.classLevel}</th>
                          <th className="px-4 py-2.5 text-right">{t.actions}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {secClasses.map((cls) => (
                          <tr key={cls.id} className="hover:bg-[#191d27]">
                            <td className="px-4 py-3 font-medium text-[#f1f3f4]">{cls.name}</td>
                            <td className="px-4 py-3 text-xs text-[#9aa0a6]">{cls.level || '—'}</td>
                            <td className="px-4 py-3 text-right">
                              <div className="inline-flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => openEditClass(cls)}
                                  className="rounded-xl px-2.5 py-1 text-xs font-medium text-[#8ab4f8] hover:bg-[#1f2533]"
                                >
                                  {t.edit}
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setConfirmState({
                                      open: true,
                                      message: t.deleteConfirmClass,
                                      action: async () => {
                                        await api.deleteClass(cls.id);
                                        await loadAll();
                                      },
                                    })
                                  }
                                  className="rounded-xl px-2.5 py-1 text-xs font-medium text-red-400 hover:bg-red-500/10"
                                >
                                  {t.delete}
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Section Modal */}
      {secModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-[#2d3342] bg-[#13161d] p-6 shadow-2xl">
            <h2 className="font-display text-lg font-semibold text-[#f1f3f4]">
              {editingSec ? t.editSection : t.addSection}
            </h2>
            <form onSubmit={saveSection} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#bdc1c6]">{t.sectionNameEn}</label>
                <input
                  type="text"
                  required
                  value={secNameEn}
                  onChange={(e) => setSecNameEn(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-[#2c3240] bg-[#0d1016] px-3 py-2 text-sm text-[#e8eaed] outline-none focus:border-[#8ab4f8]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#bdc1c6]">{t.sectionNameFr}</label>
                <input
                  type="text"
                  required
                  value={secNameFr}
                  onChange={(e) => setSecNameFr(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-[#2c3240] bg-[#0d1016] px-3 py-2 text-sm text-[#e8eaed] outline-none focus:border-[#8ab4f8]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#bdc1c6]">{t.sectionType}</label>
                <select
                  value={secType}
                  onChange={(e) => setSecType(e.target.value as SectionType)}
                  className="mt-1 w-full rounded-xl border border-[#2c3240] bg-[#0d1016] px-3 py-2 text-sm text-[#e8eaed] outline-none focus:border-[#8ab4f8]"
                >
                  <option value="anglophone">{t.typeAnglophone}</option>
                  <option value="francophone">{t.typeFrancophone}</option>
                  <option value="general">{t.typeGeneral}</option>
                  <option value="technical">{t.typeTechnical}</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSecModalOpen(false)}
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

      {/* Class Modal */}
      {clsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-[#2d3342] bg-[#13161d] p-6 shadow-2xl">
            <h2 className="font-display text-lg font-semibold text-[#f1f3f4]">
              {editingCls ? t.editClass : t.addClass}
            </h2>
            <form onSubmit={saveClass} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#bdc1c6]">{t.selectSection}</label>
                <select
                  required
                  value={clsSectionId}
                  onChange={(e) => setClsSectionId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-[#2c3240] bg-[#0d1016] px-3 py-2 text-sm text-[#e8eaed] outline-none focus:border-[#8ab4f8]"
                >
                  {sections.map((s) => (
                    <option key={s.id} value={s.id}>
                      {lang === 'fr' ? s.nameFr : s.nameEn}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#bdc1c6]">{t.className}</label>
                <input
                  type="text"
                  required
                  value={clsName}
                  onChange={(e) => setClsName(e.target.value)}
                  placeholder="Form 4 A / 4ème B"
                  className="mt-1 w-full rounded-xl border border-[#2c3240] bg-[#0d1016] px-3 py-2 text-sm text-[#e8eaed] outline-none focus:border-[#8ab4f8]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#bdc1c6]">{t.classLevel}</label>
                <input
                  type="text"
                  value={clsLevel}
                  onChange={(e) => setClsLevel(e.target.value)}
                  placeholder="First Cycle / Premier Cycle"
                  className="mt-1 w-full rounded-xl border border-[#2c3240] bg-[#0d1016] px-3 py-2 text-sm text-[#e8eaed] outline-none focus:border-[#8ab4f8]"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setClsModalOpen(false)}
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
        open={confirmState.open}
        message={confirmState.message}
        lang={lang}
        onCancel={() => setConfirmState((s) => ({ ...s, open: false }))}
        onConfirm={async () => {
          const fn = confirmState.action;
          setConfirmState((s) => ({ ...s, open: false }));
          await fn();
        }}
      />
    </div>
  );
}
