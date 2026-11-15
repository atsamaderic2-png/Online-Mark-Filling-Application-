import { Award } from 'lucide-react';
import { SCHOOL_ASSETS } from '../constants/assets';
import { formatRank, suggestCouncilAppreciation, suggestRemark, translations } from '../i18n';
import type { Language, SchoolSettings, StudentReportCard } from '../types';

interface ReportCardSheetProps {
  school: SchoolSettings;
  card: StudentReportCard;
  lang: Language;
}

export function ReportCardHeader({
  school,
  sectionNameEn,
  sectionNameFr,
}: {
  school: SchoolSettings;
  sectionNameEn?: string;
  sectionNameFr?: string;
}) {
  const logoSrc = school.logoDataUrl || SCHOOL_ASSETS.defaultLogo;
  return (
    <div className="pb-2">
      <div className="grid grid-cols-3 items-start gap-2 sm:gap-3 text-center">
        {/* Left: English Official Block */}
        <div className="min-w-0 [overflow-wrap:anywhere] [font-size:clamp(6px,1.18cqw,10.5px)] leading-snug text-slate-700">
          <p className="font-semibold uppercase tracking-wide text-slate-900">{school.republicEn}</p>
          <p className="italic text-slate-500">{school.mottoRepublicEn}</p>
          <p className="mt-1 font-medium uppercase text-slate-700">{school.ministryEn}</p>
          {sectionNameEn && <p className="mt-0.5 font-semibold text-slate-900">{sectionNameEn}</p>}
        </div>

        {/* Center: School Logo */}
        <div className="flex flex-col items-center justify-center">
          <img
            src={logoSrc}
            alt={school.nameEn}
            referrerPolicy="no-referrer"
            className="h-14 w-14 sm:h-18 sm:w-18 object-contain"
          />
        </div>

        {/* Right: French Official Block */}
        <div className="min-w-0 [overflow-wrap:anywhere] [font-size:clamp(6px,1.18cqw,10.5px)] leading-snug text-slate-700">
          <p className="font-semibold uppercase tracking-wide text-slate-900">{school.republicFr}</p>
          <p className="italic text-slate-500">{school.mottoRepublicFr}</p>
          <p className="mt-1 font-medium uppercase text-slate-700">{school.ministryFr}</p>
          {sectionNameFr && <p className="mt-0.5 font-semibold text-slate-900">{sectionNameFr}</p>}
        </div>
      </div>

      {/* Centered Bilingual School Name Underneath Logo */}
      <div className="mt-1.5 min-w-0 text-center [overflow-wrap:anywhere]">
        <h2 className="font-script [font-size:clamp(16px,2.8cqw,24px)] leading-tight font-bold text-slate-950">
          {school.nameEn}
        </h2>
        {school.nameFr && school.nameFr.toLowerCase() !== school.nameEn.toLowerCase() && (
          <p className="font-script [font-size:clamp(12px,2.1cqw,18px)] leading-tight font-semibold text-slate-700">
            {school.nameFr}
          </p>
        )}
        {school.schoolMotto && (
          <p className="mt-0.5 [font-size:clamp(7px,1.25cqw,12px)] italic text-slate-500">
            {school.schoolMotto}
          </p>
        )}
      </div>
    </div>
  );
}

export function ReportCardSheet({ school, card, lang }: ReportCardSheetProps) {
  const t = translations[lang];
  const passed = card.average !== null && card.average >= 10;
  const honourRoll = card.honourRoll || (card.average !== null && card.average >= 12);
  const isWholeTerm = card.period === 'term';
  const councilNote = suggestCouncilAppreciation(card.average, lang);

  const periodBannerLabel =
    card.period === 'seq1'
      ? `TERM ${card.term} · SEQUENCE 1 / TRIMESTRE ${card.term} · SÉQUENCE 1`
      : card.period === 'seq2'
        ? `TERM ${card.term} · SEQUENCE 2 / TRIMESTRE ${card.term} · SÉQUENCE 2`
        : `TERM ${card.term} (SEQ 1 & 2) / TRIMESTRE ${card.term} (SÉQ 1 & 2)`;

  return (
    <article className="report-card-page [container-type:inline-size] mx-auto flex min-h-[1020px] w-full max-w-[900px] flex-col overflow-hidden rounded-none border border-slate-400 bg-white p-3.5 text-slate-900 shadow-md sm:p-5 print:p-3">
      <ReportCardHeader
        school={school}
        sectionNameEn={card.section.nameEn}
        sectionNameFr={card.section.nameFr}
      />

      {/* Bilingual Term / Sequence Banner */}
      <div className="mt-3 rounded-none bg-slate-950 px-3 py-1.5 text-center text-white">
        <p className="[overflow-wrap:anywhere] [font-size:clamp(6.8px,1.22cqw,11px)] font-semibold leading-snug tracking-wide">
          {t.reportCardTitleEn} / {t.reportCardTitleFr} — {school.academicYear} · {periodBannerLabel}
        </p>
      </div>

      {/* Student Metadata — Zero Borders, Zero Border Radius, Zero Additional Item Margins */}
      <section className="mt-3 [font-size:clamp(7px,1.22cqw,11px)]">
        <div className="grid grid-cols-1 gap-0 sm:grid-cols-2 sm:gap-x-6">
          <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-2 py-0.5">
            <span className="shrink-0 text-slate-600">Full Name / Nom &amp; Prénoms:</span>
            <span className="min-w-0 [overflow-wrap:anywhere] text-right font-semibold text-slate-950">
              {card.student.fullName}
            </span>
          </div>
          <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-2 py-0.5">
            <span className="shrink-0 text-slate-600">Matricule / ID:</span>
            <span className="font-mono-num min-w-0 [overflow-wrap:anywhere] text-right font-semibold text-slate-900">
              {card.student.matricule}
            </span>
          </div>
          <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-2 py-0.5">
            <span className="shrink-0 text-slate-600">Class / Classe:</span>
            <span className="min-w-0 [overflow-wrap:anywhere] text-right font-semibold text-slate-900">
              {card.classItem.name} · {lang === 'fr' ? card.section.nameFr : card.section.nameEn}
            </span>
          </div>
          <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-2 py-0.5">
            <span className="shrink-0 text-slate-600">Sex / Sexe:</span>
            <span className="font-semibold text-slate-900">{card.student.sex}</span>
          </div>
          <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-2 py-0.5">
            <span className="shrink-0 text-slate-600">Born / Né(e) le:</span>
            <span className="min-w-0 [overflow-wrap:anywhere] text-right font-medium text-slate-900">
              {card.student.dateOfBirth} — {card.student.placeOfBirth}
            </span>
          </div>
          <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-2 py-0.5">
            <span className="shrink-0 text-slate-600">Repeater / Redoublant(e):</span>
            <span className="font-semibold text-slate-900">
              {card.student.repeater ? 'Yes / Oui' : 'No / Non'}
            </span>
          </div>
        </div>
      </section>

      {/* Subjects & Marks Table — Black Table Margins, No Extra Item Margins/Borders */}
      <section className="mt-3 w-full min-w-0 bg-black p-[1.5px]">
        <table className="w-full table-fixed border-separate border-spacing-[1px] bg-black [font-size:clamp(5px,1.02cqw,9.5px)] leading-tight">
          <colgroup>
            {isWholeTerm ? (
              <>
                <col className="w-[6%]" />
                <col className="w-[20.5%]" />
                <col className="w-[5.5%]" />
                <col className="w-[5.5%]" />
                <col className="w-[6%]" />
                <col className="w-[5%]" />
                <col className="w-[6.5%]" />
                <col className="w-[5.5%]" />
                <col className="w-[5.5%]" />
                <col className="w-[5.5%]" />
                <col className="w-[6%]" />
                <col className="w-[11.5%]" />
                <col className="w-[11%]" />
              </>
            ) : (
              <>
                <col className="w-[7%]" />
                <col className="w-[23.5%]" />
                <col className="w-[6.5%]" />
                <col className="w-[5.5%]" />
                <col className="w-[7%]" />
                <col className="w-[6.5%]" />
                <col className="w-[6%]" />
                <col className="w-[6%]" />
                <col className="w-[6.5%]" />
                <col className="w-[13%]" />
                <col className="w-[12.5%]" />
              </>
            )}
          </colgroup>
          <thead>
            <tr>
              <th className="[overflow-wrap:anywhere] rounded-none bg-slate-200 px-1 py-1 text-left font-semibold text-slate-950">
                Code
              </th>
              <th className="[overflow-wrap:anywhere] rounded-none bg-slate-200 px-1 py-1 text-left font-semibold text-slate-950">
                Subject / Matière
              </th>
              {isWholeTerm && (
                <>
                  <th className="[overflow-wrap:anywhere] rounded-none bg-slate-200 px-1 py-1 text-right font-semibold text-slate-950">
                    {t.seq1Short}
                  </th>
                  <th className="[overflow-wrap:anywhere] rounded-none bg-slate-200 px-1 py-1 text-right font-semibold text-slate-950">
                    {t.seq2Short}
                  </th>
                </>
              )}
              <th className="[overflow-wrap:anywhere] rounded-none bg-slate-200 px-1 py-1 text-right font-semibold text-slate-950">
                {isWholeTerm ? 'Avg' : 'Mark'}
              </th>
              <th className="[overflow-wrap:anywhere] rounded-none bg-slate-200 px-1 py-1 text-right font-semibold text-slate-950">
                Coef
              </th>
              <th className="[overflow-wrap:anywhere] rounded-none bg-slate-200 px-1 py-1 text-right font-semibold text-slate-950">
                Total
              </th>
              <th className="[overflow-wrap:anywhere] rounded-none bg-slate-200 px-1 py-1 text-right font-semibold text-slate-950">
                Cls
              </th>
              <th className="[overflow-wrap:anywhere] rounded-none bg-slate-200 px-1 py-1 text-right font-semibold text-slate-950">
                {t.subjectMin}
              </th>
              <th className="[overflow-wrap:anywhere] rounded-none bg-slate-200 px-1 py-1 text-right font-semibold text-slate-950">
                {t.subjectMax}
              </th>
              <th className="[overflow-wrap:anywhere] rounded-none bg-slate-200 px-1 py-1 text-center font-semibold text-slate-950">
                {t.subjectRankCol}
              </th>
              <th className="[overflow-wrap:anywhere] rounded-none bg-slate-200 px-1 py-1 text-left font-semibold text-slate-950">
                Appreciation
              </th>
              <th className="[overflow-wrap:anywhere] rounded-none bg-slate-200 px-1 py-1 text-left font-semibold text-slate-950">
                {t.teacherCol}
              </th>
            </tr>
          </thead>
          <tbody>
            {card.subjects.map((sub, idx) => {
              const displayRemark =
                sub.remark || (sub.score !== null ? suggestRemark(sub.score, lang) : '—');
              const rowBg = idx % 2 === 1 ? 'bg-slate-50' : 'bg-white';
              return (
                <tr key={sub.subjectId}>
                  <td
                    className={`whitespace-nowrap rounded-none ${rowBg} px-1 py-1 font-mono-num text-slate-600`}
                  >
                    {sub.code || '—'}
                  </td>
                  <td
                    className={`[overflow-wrap:anywhere] rounded-none ${rowBg} px-1 py-1 font-medium text-slate-900`}
                  >
                    {sub.nameEn.toLowerCase() === sub.nameFr.toLowerCase()
                      ? sub.nameEn
                      : `${sub.nameEn} / ${sub.nameFr}`}
                  </td>
                  {isWholeTerm && (
                    <>
                      <td
                        className={`whitespace-nowrap rounded-none ${rowBg} px-1 py-1 text-right font-mono-num text-slate-600`}
                      >
                        {sub.seq1Score !== null ? sub.seq1Score.toFixed(2) : '—'}
                      </td>
                      <td
                        className={`whitespace-nowrap rounded-none ${rowBg} px-1 py-1 text-right font-mono-num text-slate-600`}
                      >
                        {sub.seq2Score !== null ? sub.seq2Score.toFixed(2) : '—'}
                      </td>
                    </>
                  )}
                  <td
                    className={`whitespace-nowrap rounded-none ${rowBg} px-1 py-1 text-right font-mono-num font-semibold text-slate-950`}
                  >
                    {sub.score !== null ? sub.score.toFixed(2) : '—'}
                  </td>
                  <td
                    className={`whitespace-nowrap rounded-none ${rowBg} px-1 py-1 text-right font-mono-num text-slate-700`}
                  >
                    {sub.coefficient}
                  </td>
                  <td
                    className={`whitespace-nowrap rounded-none ${rowBg} px-1 py-1 text-right font-mono-num font-semibold text-slate-900`}
                  >
                    {sub.weightedScore !== null ? sub.weightedScore.toFixed(2) : '—'}
                  </td>
                  <td
                    className={`whitespace-nowrap rounded-none ${rowBg} px-1 py-1 text-right font-mono-num text-slate-600`}
                  >
                    {sub.classSubjectAverage !== null ? sub.classSubjectAverage.toFixed(2) : '—'}
                  </td>
                  <td
                    className={`whitespace-nowrap rounded-none ${rowBg} px-1 py-1 text-right font-mono-num text-slate-600`}
                  >
                    {sub.subjectLowest !== null ? sub.subjectLowest.toFixed(2) : '—'}
                  </td>
                  <td
                    className={`whitespace-nowrap rounded-none ${rowBg} px-1 py-1 text-right font-mono-num text-slate-600`}
                  >
                    {sub.subjectHighest !== null ? sub.subjectHighest.toFixed(2) : '—'}
                  </td>
                  <td
                    className={`whitespace-nowrap rounded-none ${rowBg} px-1 py-1 text-center font-mono-num font-semibold text-slate-800`}
                  >
                    {sub.subjectRank !== null ? `${sub.subjectRank}/${sub.subjectGradedCount}` : '—'}
                  </td>
                  <td
                    className={`[overflow-wrap:anywhere] rounded-none ${rowBg} px-1 py-1 text-slate-700`}
                  >
                    {displayRemark}
                  </td>
                  <td
                    className={`[overflow-wrap:anywhere] rounded-none ${rowBg} px-1 py-1 font-medium text-slate-700`}
                  >
                    {sub.teacherName || '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td
                colSpan={isWholeTerm ? 5 : 3}
                className="[overflow-wrap:anywhere] rounded-none bg-slate-200 px-1 py-1 text-left font-semibold text-slate-950"
              >
                TOTAL
              </td>
              <td className="whitespace-nowrap rounded-none bg-slate-200 px-1 py-1 text-right font-mono-num font-semibold text-slate-950">
                {card.totalGradedCoefficients > 0
                  ? card.totalGradedCoefficients
                  : card.totalCoefficients}
              </td>
              <td className="whitespace-nowrap rounded-none bg-slate-200 px-1 py-1 text-right font-mono-num font-semibold text-slate-950">
                {card.totalWeightedScore.toFixed(2)}
              </td>
              <td colSpan={6} className="rounded-none bg-slate-200 px-1 py-1" />
            </tr>
          </tfoot>
        </table>
      </section>

      {/* Results Summary & Honours Roll — Zero Item Borders, Zero Additional Item Margins */}
      <section className="mt-3 [font-size:clamp(7px,1.22cqw,11px)]">
        <div className="grid grid-cols-1 gap-0 sm:grid-cols-2 sm:gap-x-6">
          <div className="min-w-0">
            <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 py-0.5">
              <span className="min-w-0 [overflow-wrap:anywhere] text-slate-600">{t.termAverage}:</span>
              <span className="font-mono-num min-w-0 [overflow-wrap:anywhere] [font-size:clamp(8.5px,1.45cqw,13px)] font-bold text-slate-950">
                {card.average !== null ? `${card.average.toFixed(2)} / 20` : '—'}
              </span>
            </div>
            <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 py-0.5">
              <span className="min-w-0 [overflow-wrap:anywhere] text-slate-600">{t.classRank}:</span>
              <span className="font-mono-num min-w-0 [overflow-wrap:anywhere] font-semibold text-slate-900">
                {formatRank(card.rank, card.totalStudents, lang)}
              </span>
            </div>
            <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 py-0.5">
              <span className="min-w-0 [overflow-wrap:anywhere] text-slate-600">{t.decision}:</span>
              <span
                className={`min-w-0 [overflow-wrap:anywhere] text-right font-semibold ${
                  card.average === null
                    ? 'text-slate-500'
                    : passed
                      ? 'text-emerald-700'
                      : 'text-red-700'
                }`}
              >
                {card.average === null ? '—' : passed ? t.decisionPass : t.decisionFail}
              </span>
            </div>
          </div>

          <div className="min-w-0">
            <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 py-0.5">
              <span className="min-w-0 [overflow-wrap:anywhere] text-slate-600">{t.classAverage}:</span>
              <span className="font-mono-num min-w-0 [overflow-wrap:anywhere] font-semibold text-slate-900">
                {card.classAverage !== null ? `${card.classAverage.toFixed(2)} / 20` : '—'}
              </span>
            </div>
            <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 py-0.5">
              <span className="min-w-0 [overflow-wrap:anywhere] text-slate-600">{t.highestAverage}:</span>
              <span className="font-mono-num min-w-0 [overflow-wrap:anywhere] font-semibold text-slate-900">
                {card.highestAverage !== null ? `${card.highestAverage.toFixed(2)} / 20` : '—'}
              </span>
            </div>
            <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 py-0.5">
              <span className="min-w-0 [overflow-wrap:anywhere] text-slate-600">{t.lowestAverage}:</span>
              <span className="font-mono-num min-w-0 [overflow-wrap:anywhere] font-semibold text-slate-900">
                {card.lowestAverage !== null ? `${card.lowestAverage.toFixed(2)} / 20` : '—'}
              </span>
            </div>
          </div>
        </div>

        {/* Dedicated Honours Roll Bar */}
        <div
          className={`mt-1.5 flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-none px-2 py-1 ${
            honourRoll
              ? 'bg-emerald-50 text-emerald-950'
              : 'bg-slate-100 text-slate-700'
          }`}
        >
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <Award
              className={`h-4 w-4 shrink-0 ${
                honourRoll ? 'text-emerald-700' : 'text-slate-400'
              }`}
            />
            <span className="[overflow-wrap:anywhere] font-bold tracking-wide uppercase">
              HONOURS ROLL / TABLEAU D&apos;HONNEUR
            </span>
            <span className="text-[9.5px] text-slate-500">(≥ 12.00 / 20)</span>
          </div>
          <span
            className={`min-w-0 [overflow-wrap:anywhere] font-bold ${
              honourRoll ? 'text-emerald-800' : 'text-slate-500'
            }`}
          >
            {honourRoll
              ? `YES — AWARDED / TABLEAU D'HONNEUR (${card.average !== null ? card.average.toFixed(2) : '—'}/20)`
              : card.average === null
                ? 'Pending / En attente'
                : 'No / Non (Below 12.00 / 20)'}
          </span>
        </div>
      </section>

      {/* Discipline & Attendance — Zero Item Borders, Zero Additional Item Margins */}
      <section className="mt-3 [font-size:clamp(7px,1.22cqw,11px)]">
        <div className="[overflow-wrap:anywhere] rounded-none bg-slate-200 px-2 py-1 font-semibold text-slate-950">
          {t.conductSectionTitle}
        </div>
        <div className="grid grid-cols-2 gap-0 sm:grid-cols-4 sm:gap-x-4">
          <div className="flex min-w-0 flex-wrap items-center justify-between gap-1 py-1">
            <span className="min-w-0 [overflow-wrap:anywhere] text-slate-600">{t.justifiedAbsences}:</span>
            <span className="font-mono-num shrink-0 font-semibold text-slate-900">
              {card.discipline.justifiedAbsences}
            </span>
          </div>
          <div className="flex min-w-0 flex-wrap items-center justify-between gap-1 py-1">
            <span className="min-w-0 [overflow-wrap:anywhere] text-slate-600">{t.unjustifiedAbsences}:</span>
            <span
              className={`font-mono-num shrink-0 font-semibold ${
                card.discipline.unjustifiedAbsences > 0 ? 'text-red-700' : 'text-slate-900'
              }`}
            >
              {card.discipline.unjustifiedAbsences}
            </span>
          </div>
          <div className="flex min-w-0 flex-wrap items-center justify-between gap-1 py-1">
            <span className="min-w-0 [overflow-wrap:anywhere] text-slate-600">{t.lateComings}:</span>
            <span className="font-mono-num shrink-0 font-semibold text-slate-900">
              {card.discipline.lateComings}
            </span>
          </div>
          <div className="flex min-w-0 flex-wrap items-center justify-between gap-1 py-1">
            <span className="shrink-0 text-slate-600">{t.disciplineSanction}:</span>
            <span
              className={`min-w-0 [overflow-wrap:anywhere] font-semibold ${
                card.discipline.sanction ? 'text-amber-800' : 'text-slate-700'
              }`}
            >
              {card.discipline.sanction || t.sanctionNone}
            </span>
          </div>
        </div>
      </section>

      {/* Parent & Class Master Appreciation — Zero Item Borders, Zero Additional Item Margins */}
      <section className="mt-3 [font-size:clamp(7px,1.22cqw,11px)]">
        <div className="[overflow-wrap:anywhere] rounded-none bg-slate-200 px-2 py-1 font-semibold text-slate-950">
          {t.appreciationSectionTitle}
        </div>
        <div className="grid grid-cols-1 gap-0 sm:grid-cols-2 sm:gap-x-6">
          <div className="flex min-h-[48px] min-w-0 flex-col justify-between py-1">
            <p className="[overflow-wrap:anywhere] font-semibold text-slate-900">
              {t.parentAppreciationTitle}
            </p>
            <p className="mt-2 [font-size:clamp(6.5px,1.12cqw,10px)] text-slate-400">
              {t.appreciationObservationLabel} ..............................................................
            </p>
          </div>
          <div className="flex min-h-[48px] min-w-0 flex-col justify-between py-1">
            <p className="[overflow-wrap:anywhere] font-semibold text-slate-900">
              {t.classMasterAppreciationTitle}
            </p>
            <p className="mt-1 [overflow-wrap:anywhere] [font-size:clamp(6.8px,1.16cqw,10.5px)] italic text-slate-700">
              {councilNote}
            </p>
          </div>
        </div>
      </section>

      {/* Signatures Table — Black Table Margins, Full Remaining Vertical Height, No Item Borders/Margins */}
      <section className="mt-3 flex min-h-[96px] flex-1 flex-col bg-black p-[1.5px]">
        <table className="h-full w-full flex-1 table-fixed border-separate border-spacing-[1px] bg-black [font-size:clamp(7px,1.22cqw,11px)] text-slate-900">
          <thead>
            <tr className="text-center">
              <th className="w-1/3 [overflow-wrap:anywhere] rounded-none bg-slate-200 px-2 py-1 font-semibold text-slate-950">
                {t.parentSignature}
              </th>
              <th className="w-1/3 [overflow-wrap:anywhere] rounded-none bg-slate-200 px-2 py-1 font-semibold text-slate-950">
                {t.classMasterSignature}
              </th>
              <th className="w-1/3 [overflow-wrap:anywhere] rounded-none bg-slate-200 px-2 py-1 font-semibold text-slate-950">
                {t.headTeacherSignature}
              </th>
            </tr>
          </thead>
          <tbody className="h-full">
            <tr className="h-full">
              <td className="h-full [overflow-wrap:anywhere] rounded-none bg-white px-2 py-2 align-bottom text-center sm:px-3">
                <div className="[font-size:clamp(6.5px,1.15cqw,10.5px)] text-slate-500">
                  Date &amp; Signature
                </div>
              </td>
              <td className="h-full [overflow-wrap:anywhere] rounded-none bg-white px-2 py-2 align-bottom text-center sm:px-3">
                <div className="[font-size:clamp(6.5px,1.15cqw,10.5px)] text-slate-500">
                  Date &amp; Signature
                </div>
              </td>
              <td className="h-full [overflow-wrap:anywhere] rounded-none bg-white px-2 py-2 align-bottom text-center sm:px-3">
                <p className="[overflow-wrap:anywhere] [font-size:clamp(6.5px,1.15cqw,10.5px)] text-slate-500">
                  {school.city}, {new Date().toLocaleDateString()}
                </p>
                <p className="mt-1 [overflow-wrap:anywhere] font-semibold text-slate-950">
                  {school.headTeacherName}
                </p>
              </td>
            </tr>
          </tbody>
        </table>
      </section>
    </article>
  );
}
