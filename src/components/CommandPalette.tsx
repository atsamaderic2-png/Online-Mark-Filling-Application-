import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Search, X } from 'lucide-react';
import { api } from '../api';
import { translations } from '../i18n';
import type { ClassItem, Language, StudentItem, UserProfile, UserRole } from '../types';

export interface CommandItem {
  id: string;
  label: string;
  category: string;
  action: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  lang: Language;
  role: UserRole;
  onNavigate: (tab: string) => void;
  onChangeLang: (lang: Language) => void;
}

export function CommandPalette({
  open,
  onClose,
  lang,
  role,
  onNavigate,
  onChangeLang,
}: CommandPaletteProps) {
  const t = translations[lang];
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState('');
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [teachers, setTeachers] = useState<UserProfile[]>([]);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setTimeout(() => inputRef.current?.focus(), 20);
    if (role === 'head_teacher') {
      Promise.all([api.getStudents(), api.getClasses(), api.getTeachers()])
        .then(([s, c, tch]) => {
          setStudents(s);
          setClasses(c);
          setTeachers(tch);
        })
        .catch(() => {});
    }
  }, [open, role]);

  const items = useMemo<CommandItem[]>(() => {
    const list: CommandItem[] = [];
    if (role === 'head_teacher') {
      list.push(
        { id: 'nav-overview', label: t.navOverview, category: 'Workspace', action: () => onNavigate('overview') },
        { id: 'nav-structure', label: t.navStructure, category: 'Workspace', action: () => onNavigate('structure') },
        { id: 'nav-students', label: t.navStudents, category: 'Workspace', action: () => onNavigate('students') },
        { id: 'nav-subjects', label: t.navSubjects, category: 'Workspace', action: () => onNavigate('subjects') },
        { id: 'nav-teachers', label: t.navTeachers, category: 'Workspace', action: () => onNavigate('teachers') },
        { id: 'nav-assignments', label: t.navAssignments, category: 'Workspace', action: () => onNavigate('assignments') },
        { id: 'nav-marks', label: t.navMarks, category: 'Workspace', action: () => onNavigate('marks') },
        { id: 'nav-discipline', label: t.navDiscipline, category: 'Workspace', action: () => onNavigate('discipline') },
        { id: 'nav-reports', label: t.navReports, category: 'Workspace', action: () => onNavigate('reports') },
        { id: 'nav-settings', label: t.navSettings, category: 'Workspace', action: () => onNavigate('settings') }
      );
      for (const c of classes) {
        list.push({
          id: `cls-${c.id}`,
          label: `${c.name} · ${c.level || t.classCol}`,
          category: t.classesCount,
          action: () => onNavigate('reports'),
        });
      }
      for (const tch of teachers) {
        list.push({
          id: `tch-${tch.id}`,
          label: `${tch.fullName} (${tch.username})`,
          category: t.teachersCount,
          action: () => onNavigate('assignments'),
        });
      }
      for (const st of students) {
        list.push({
          id: `stu-${st.id}`,
          label: `${st.fullName} · ${st.matricule}`,
          category: t.studentsCount,
          action: () => onNavigate('students'),
        });
      }
    } else {
      list.push(
        {
          id: 'nav-marks',
          label: t.navMarks,
          category: 'Workspace',
          action: () => onNavigate('marks'),
        },
        {
          id: 'nav-reports',
          label: t.navReports,
          category: 'Workspace',
          action: () => onNavigate('reports'),
        }
      );
    }

    list.push({
      id: 'lang-toggle',
      label: lang === 'en' ? 'Switch language to Français' : 'Passer en English',
      category: t.language,
      action: () => onChangeLang(lang === 'en' ? 'fr' : 'en'),
    });

    return list;
  }, [role, t, classes, teachers, students, lang, onNavigate, onChangeLang]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items.slice(0, 12);
    return items.filter((item) => item.label.toLowerCase().includes(q) || item.category.toLowerCase().includes(q)).slice(0, 15);
  }, [items, query]);

  if (!open) return null;

  return (
    <div className="no-print fixed inset-0 z-50 flex items-start justify-center bg-black/65 px-4 pt-20 backdrop-blur-sm">
      <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-[#2d3342] bg-[#13161d] shadow-2xl">
        <div className="flex items-center gap-3 border-b border-[#242936] px-4 py-3">
          <Search className="h-4 w-4 shrink-0 text-[#8ab4f8]" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') onClose();
              if (e.key === 'Enter' && filtered[0]) {
                filtered[0].action();
                onClose();
              }
            }}
            placeholder={t.commandPlaceholder}
            className="w-full bg-transparent text-sm text-[#e8eaed] placeholder-[#7f8794] outline-none"
          />
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-1 text-[#9aa0a6] hover:bg-[#1e232e] hover:text-[#e8eaed]"
            aria-label={t.close}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-80 overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-[#9aa0a6]">{t.noStudentsFound}</p>
          ) : (
            filtered.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  item.action();
                  onClose();
                }}
                className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-[#e8eaed] transition-colors hover:bg-[#1d222e]"
              >
                <div className="min-w-0">
                  <span className="truncate font-medium">{item.label}</span>
                  <span className="mx-2 text-[#5f6368]">·</span>
                  <span className="text-xs text-[#8ab4f8]">{item.category}</span>
                </div>
                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-[#7f8794]" />
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
