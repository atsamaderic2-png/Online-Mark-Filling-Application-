import { translations } from '../i18n';
import type { Language } from '../types';

interface ConfirmDialogProps {
  open: boolean;
  message: string;
  lang: Language;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ open, message, lang, onConfirm, onCancel }: ConfirmDialogProps) {
  if (!open) return null;
  const t = translations[lang];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-[#2d3342] bg-[#13161d] p-6 shadow-2xl">
        <p className="text-sm font-medium text-[#e8eaed]">{message}</p>
        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-[#2c3240] bg-[#191d27] px-4 py-2 text-xs font-semibold text-[#bdc1c6] transition-colors hover:bg-[#232836]"
          >
            {t.cancel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-xl bg-red-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-red-500"
          >
            {t.delete}
          </button>
        </div>
      </div>
    </div>
  );
}
