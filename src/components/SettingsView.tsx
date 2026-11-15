import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Check, Loader2, Trash2, Upload } from 'lucide-react';
import { api } from '../api';
import { SCHOOL_ASSETS } from '../constants/assets';
import { translations } from '../i18n';
import type { Language, SchoolSettings } from '../types';
import { ReportCardHeader } from './ReportCardSheet';

interface SettingsViewProps {
  lang: Language;
  school: SchoolSettings;
  onUpdated: (next: SchoolSettings) => void;
}

export function SettingsView({ lang, school, onUpdated }: SettingsViewProps) {
  const t = translations[lang];
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [form, setForm] = useState<SchoolSettings>(school);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setError('Logo image must be under 2MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setForm((prev) => ({ ...prev, logoDataUrl: reader.result as string }));
        setSaved(false);
        setError(null);
      }
    };
    reader.readAsDataURL(file);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const updated = await api.updateSchoolSettings(form);
      setForm(updated);
      onUpdated(updated);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update settings');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-[#f1f3f4]">
          {t.settingsTitle}
        </h1>
        <p className="mt-1 text-sm text-[#9aa0a6]">{t.settingsDesc}</p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs font-medium text-red-300">
          {error}
        </div>
      )}

      {/* Live Bilingual Report Card Header Preview (Paper Surface) */}
      <div className="rounded-2xl border border-[#242936] bg-[#13161d]/90 p-6 backdrop-blur-sm">
        <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-[#9aa0a6]">
          {t.headerLivePreview}
        </p>
        <div className="mx-auto max-w-3xl rounded-xl border border-slate-300 bg-white p-5 text-slate-900">
          <ReportCardHeader
            school={form}
            sectionNameEn="Anglophone Section"
            sectionNameFr="Section Francophone"
          />
        </div>
      </div>

      {/* Form */}
      <form
        onSubmit={handleSubmit}
        className="space-y-6 rounded-2xl border border-[#242936] bg-[#13161d]/90 p-6 backdrop-blur-sm"
      >
        {/* Logo Import */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#222733] pb-6">
          <div className="flex items-center gap-4">
            <img
              src={form.logoDataUrl || SCHOOL_ASSETS.defaultLogo}
              alt="School Logo"
              referrerPolicy="no-referrer"
              className="h-16 w-16 rounded-xl border border-[#2c3240] bg-white object-contain p-1"
            />
            <div>
              <p className="text-sm font-semibold text-[#f1f3f4]">{t.importLogo}</p>
              <p className="mt-0.5 text-xs text-[#9aa0a6]">{t.logoHint}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-[#2c3240] bg-[#191d27] px-3.5 py-2 text-xs font-semibold text-[#e8eaed] hover:bg-[#232836]"
            >
              <Upload className="h-3.5 w-3.5 text-[#8ab4f8]" />
              {t.importLogo}
            </button>
            {form.logoDataUrl && (
              <button
                type="button"
                onClick={() => setForm((prev) => ({ ...prev, logoDataUrl: null }))}
                className="inline-flex items-center gap-1 whitespace-nowrap rounded-xl border border-red-500/30 px-3 py-2 text-xs font-semibold text-red-300 hover:bg-red-500/10"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {t.removeLogo}
              </button>
            )}
          </div>
        </div>

        {/* School Fields */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-[#bdc1c6]">{t.schoolNameEn}</label>
            <input
              type="text"
              required
              value={form.nameEn}
              onChange={(e) => setForm({ ...form, nameEn: e.target.value })}
              className="mt-1 w-full rounded-xl border border-[#2c3240] bg-[#0d1016] px-3 py-2 text-sm text-[#e8eaed] outline-none focus:border-[#8ab4f8]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#bdc1c6]">{t.schoolNameFr}</label>
            <input
              type="text"
              required
              value={form.nameFr}
              onChange={(e) => setForm({ ...form, nameFr: e.target.value })}
              className="mt-1 w-full rounded-xl border border-[#2c3240] bg-[#0d1016] px-3 py-2 text-sm text-[#e8eaed] outline-none focus:border-[#8ab4f8]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#bdc1c6]">{t.republicEn}</label>
            <input
              type="text"
              value={form.republicEn}
              onChange={(e) => setForm({ ...form, republicEn: e.target.value })}
              className="mt-1 w-full rounded-xl border border-[#2c3240] bg-[#0d1016] px-3 py-2 text-sm text-[#e8eaed] outline-none focus:border-[#8ab4f8]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#bdc1c6]">{t.republicFr}</label>
            <input
              type="text"
              value={form.republicFr}
              onChange={(e) => setForm({ ...form, republicFr: e.target.value })}
              className="mt-1 w-full rounded-xl border border-[#2c3240] bg-[#0d1016] px-3 py-2 text-sm text-[#e8eaed] outline-none focus:border-[#8ab4f8]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#bdc1c6]">{t.mottoRepublicEn}</label>
            <input
              type="text"
              value={form.mottoRepublicEn}
              onChange={(e) => setForm({ ...form, mottoRepublicEn: e.target.value })}
              className="mt-1 w-full rounded-xl border border-[#2c3240] bg-[#0d1016] px-3 py-2 text-sm text-[#e8eaed] outline-none focus:border-[#8ab4f8]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#bdc1c6]">{t.mottoRepublicFr}</label>
            <input
              type="text"
              value={form.mottoRepublicFr}
              onChange={(e) => setForm({ ...form, mottoRepublicFr: e.target.value })}
              className="mt-1 w-full rounded-xl border border-[#2c3240] bg-[#0d1016] px-3 py-2 text-sm text-[#e8eaed] outline-none focus:border-[#8ab4f8]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#bdc1c6]">{t.ministryEn}</label>
            <input
              type="text"
              value={form.ministryEn}
              onChange={(e) => setForm({ ...form, ministryEn: e.target.value })}
              className="mt-1 w-full rounded-xl border border-[#2c3240] bg-[#0d1016] px-3 py-2 text-sm text-[#e8eaed] outline-none focus:border-[#8ab4f8]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#bdc1c6]">{t.ministryFr}</label>
            <input
              type="text"
              value={form.ministryFr}
              onChange={(e) => setForm({ ...form, ministryFr: e.target.value })}
              className="mt-1 w-full rounded-xl border border-[#2c3240] bg-[#0d1016] px-3 py-2 text-sm text-[#e8eaed] outline-none focus:border-[#8ab4f8]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#bdc1c6]">{t.schoolMotto}</label>
            <input
              type="text"
              value={form.schoolMotto}
              onChange={(e) => setForm({ ...form, schoolMotto: e.target.value })}
              className="mt-1 w-full rounded-xl border border-[#2c3240] bg-[#0d1016] px-3 py-2 text-sm text-[#e8eaed] outline-none focus:border-[#8ab4f8]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#bdc1c6]">{t.headTeacherName}</label>
            <input
              type="text"
              value={form.headTeacherName}
              onChange={(e) => setForm({ ...form, headTeacherName: e.target.value })}
              className="mt-1 w-full rounded-xl border border-[#2c3240] bg-[#0d1016] px-3 py-2 text-sm text-[#e8eaed] outline-none focus:border-[#8ab4f8]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#bdc1c6]">{t.city}</label>
            <input
              type="text"
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
              className="mt-1 w-full rounded-xl border border-[#2c3240] bg-[#0d1016] px-3 py-2 text-sm text-[#e8eaed] outline-none focus:border-[#8ab4f8]"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#bdc1c6]">{t.academicYear}</label>
              <input
                type="text"
                value={form.academicYear}
                onChange={(e) => setForm({ ...form, academicYear: e.target.value })}
                className="mt-1 w-full rounded-xl border border-[#2c3240] bg-[#0d1016] px-3 py-2 text-sm text-[#e8eaed] outline-none focus:border-[#8ab4f8]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#bdc1c6]">{t.activeTermLabel}</label>
              <select
                value={form.activeTerm}
                onChange={(e) => setForm({ ...form, activeTerm: Number(e.target.value) as 1 | 2 | 3 })}
                className="mt-1 w-full rounded-xl border border-[#2c3240] bg-[#0d1016] px-3 py-2 text-sm text-[#e8eaed] outline-none focus:border-[#8ab4f8]"
              >
                <option value={1}>{t.term1}</option>
                <option value={2}>{t.term2}</option>
                <option value={3}>{t.term3}</option>
              </select>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-[#222733] pt-4">
          {saved && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-[#81c995]">
              <Check className="h-3.5 w-3.5" />
              {t.settingsSaved}
            </span>
          )}
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#8ab4f8] px-5 py-2.5 text-xs font-semibold text-[#0b0d12] hover:bg-[#a8c7fa] disabled:opacity-50"
          >
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {t.saveSettings}
          </button>
        </div>
      </form>
    </div>
  );
}
