import { jsPDF } from 'jspdf';
import { SCHOOL_ASSETS } from '../constants/assets';
import { formatRank, suggestCouncilAppreciation, suggestRemark } from '../i18n';
import type { ClassReportBundle, Language, SchoolSettings, StudentReportCard } from '../types';

async function rasterizeLogoToPng(
  dataUrl: string | null
): Promise<{ dataUrl: string; width: number; height: number } | null> {
  if (!dataUrl) return null;
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const targetSize = 240;
        const ratio = img.width > 0 && img.height > 0 ? img.width / img.height : 1;
        const w = ratio >= 1 ? targetSize : Math.round(targetSize * ratio);
        const h = ratio >= 1 ? Math.round(targetSize / ratio) : targetSize;
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(w, 1);
        canvas.height = Math.max(h, 1);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve({
          dataUrl: canvas.toDataURL('image/png'),
          width: canvas.width,
          height: canvas.height,
        });
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

function drawCenteredText(
  doc: jsPDF,
  text: string,
  xCenter: number,
  y: number,
  maxWidth: number
): number {
  const lines = doc.splitTextToSize(text, maxWidth) as string[];
  for (let i = 0; i < lines.length; i++) {
    doc.text(lines[i], xCenter, y + i * 3.6, { align: 'center' });
  }
  return lines.length * 3.6;
}

function renderCardPage(
  doc: jsPDF,
  school: SchoolSettings,
  card: StudentReportCard,
  logoPng: { dataUrl: string; width: number; height: number } | null,
  lang: Language
): void {
  const pageW = 210;
  const margin = 10;
  const contentW = pageW - margin * 2; // 190mm
  const centerX = pageW / 2;
  const isWholeTerm = card.period === 'term';
  const honourRoll = card.honourRoll || (card.average !== null && card.average >= 12);
  const councilNote = suggestCouncilAppreciation(card.average, lang);

  // Outer page frame (sharp corners, zero border-radius)
  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(0.35);
  doc.rect(6, 6, pageW - 12, 285);

  // 3-Column Header: Left EN | Center Logo | Right FR
  const leftCenter = margin + 30;
  const rightCenter = pageW - margin - 30;

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  let yL = 12;
  yL += drawCenteredText(doc, school.republicEn.toUpperCase(), leftCenter, yL, 58);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(6.8);
  yL += drawCenteredText(doc, school.mottoRepublicEn, leftCenter, yL, 58);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  yL += drawCenteredText(doc, school.ministryEn.toUpperCase(), leftCenter, yL + 0.4, 58);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  const secEnH = drawCenteredText(doc, card.section.nameEn, leftCenter, yL + 0.8, 58);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  let yR = 12;
  yR += drawCenteredText(doc, school.republicFr.toUpperCase(), rightCenter, yR, 58);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(6.8);
  yR += drawCenteredText(doc, school.mottoRepublicFr, rightCenter, yR, 58);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  yR += drawCenteredText(doc, school.ministryFr.toUpperCase(), rightCenter, yR + 0.4, 58);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  const secFrH = drawCenteredText(doc, card.section.nameFr, rightCenter, yR + 0.8, 58);

  // Center School Logo
  const logoBoxSize = 18;
  const logoTop = 10.5;
  const maxHeaderBottom = Math.max(yL + 0.8 + secEnH, yR + 0.8 + secFrH, logoTop + logoBoxSize + 3);
  if (logoPng) {
    const ratio = logoPng.width / logoPng.height;
    const drawW = ratio >= 1 ? logoBoxSize : logoBoxSize * ratio;
    const drawH = ratio >= 1 ? logoBoxSize / ratio : logoBoxSize;
    doc.addImage(
      logoPng.dataUrl,
      'PNG',
      centerX - drawW / 2,
      logoTop + (logoBoxSize - drawH) / 2,
      drawW,
      drawH
    );
  } else {
    doc.setFillColor(241, 245, 249);
    doc.rect(centerX - 8, logoTop + 1, 16, 16, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(30, 58, 138);
    doc.text('LOGO', centerX, logoTop + 10.5, { align: 'center' });
  }

  // School Name underneath centered logo (auto-shrink if long)
  let y = Math.max(33, maxHeaderBottom + 1.5);
  doc.setTextColor(15, 23, 42);
  doc.setFont('times', 'bolditalic');
  let nameSize = 14.5;
  doc.setFontSize(nameSize);
  while (doc.getTextWidth(school.nameEn) > contentW - 8 && nameSize > 9.5) {
    nameSize -= 0.5;
    doc.setFontSize(nameSize);
  }
  doc.text(school.nameEn, centerX, y, { align: 'center' });
  if (school.nameFr && school.nameFr.toLowerCase() !== school.nameEn.toLowerCase()) {
    y += 4.5;
    doc.setFont('times', 'italic');
    let frSize = 11;
    doc.setFontSize(frSize);
    while (doc.getTextWidth(school.nameFr) > contentW - 8 && frSize > 8) {
      frSize -= 0.5;
      doc.setFontSize(frSize);
    }
    doc.setTextColor(51, 65, 85);
    doc.text(school.nameFr, centerX, y, { align: 'center' });
  }

  if (school.schoolMotto) {
    y += 4;
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    y += drawCenteredText(doc, school.schoolMotto, centerX, y, contentW - 10) - 3.6;
  }

  // Banner bar (sharp corners, separated from header by clear section gap)
  y += 4;
  doc.setFillColor(15, 23, 42);
  doc.rect(margin, y, contentW, 8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  const periodLabel =
    card.period === 'seq1'
      ? `TERM ${card.term} · SEQUENCE 1 / TRIMESTRE ${card.term} · SÉQUENCE 1`
      : card.period === 'seq2'
        ? `TERM ${card.term} · SEQUENCE 2 / TRIMESTRE ${card.term} · SÉQUENCE 2`
        : `TERM ${card.term} (SEQ 1 & 2) / TRIMESTRE ${card.term} (SÉQ 1 & 2)`;
  const termBanner = `ACADEMIC REPORT CARD / BULLETIN DE NOTES  —  ${school.academicYear}  ·  ${periodLabel}`;
  let bannerSize = 8.6;
  doc.setFontSize(bannerSize);
  while (doc.getTextWidth(termBanner) > contentW - 6 && bannerSize > 6.5) {
    bannerSize -= 0.4;
    doc.setFontSize(bannerSize);
  }
  doc.text(termBanner, centerX, y + 5.2, { align: 'center' });

  // Student Metadata Grid — Zero Borders, Zero Boxes, Zero Additional Item Margins
  y += 11.5;
  const metaGapX = 6;
  const metaColW = (contentW - metaGapX) / 2;
  const metaRowH = 4.6;

  const metaItems: Array<{ label: string; value: string }> = [
    { label: 'Full Name / Nom & Prénoms:', value: card.student.fullName },
    { label: 'Matricule / ID:', value: card.student.matricule },
    {
      label: 'Class / Classe:',
      value: `${card.classItem.name} · ${lang === 'fr' ? card.section.nameFr : card.section.nameEn}`,
    },
    { label: 'Sex / Sexe:', value: card.student.sex === 'M' ? 'M' : 'F' },
    {
      label: 'Born / Né(e) le:',
      value: `${card.student.dateOfBirth} — ${card.student.placeOfBirth}`,
    },
    { label: 'Repeater / Redoublant(e):', value: card.student.repeater ? 'Yes / Oui' : 'No / Non' },
  ];

  metaItems.forEach((item, idx) => {
    const col = idx % 2;
    const row = Math.floor(idx / 2);
    const ix = margin + col * (metaColW + metaGapX);
    const iy = y + row * metaRowH;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(71, 85, 105);
    doc.text(item.label, ix, iy + 3.4);

    const labelW = doc.getTextWidth(item.label) + 2.5;
    const availW = Math.max(16, metaColW - labelW);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    let valSize = 7.4;
    doc.setFontSize(valSize);
    while (doc.getTextWidth(item.value) > availW && valSize > 5.4) {
      valSize -= 0.4;
      doc.setFontSize(valSize);
    }
    doc.text(item.value, ix + metaColW, iy + 3.4, { align: 'right' });
  });

  // Section gap before Marks Table
  y += 3 * metaRowH + 3.5;

  // Subjects & Marks Table — Black Table Margins, Flush Cells Inside, Zero Border Radius
  const outerPad = 0.5;
  const cellGap = 0.3;
  const colWidths = isWholeTerm
    ? [12, 41, 10, 10, 11, 9, 12, 11, 10, 10, 11, 20, 22] // sum = 189
    : [13, 48, 12, 10, 13, 12, 11, 11, 13, 22, 24]; // sum = 189

  const headers = isWholeTerm
    ? [
        'Code',
        'Subject / Matière',
        'S1',
        'S2',
        'Avg',
        'Coef',
        'Total',
        'Cls',
        'Min',
        'Max',
        'Rank',
        'Appreciation',
        'Teacher',
      ]
    : [
        'Code',
        'Subject / Matière',
        'Mark',
        'Coef',
        'Total',
        'Cls Avg',
        'Min',
        'Max',
        'Rank',
        'Appreciation',
        'Teacher',
      ];

  const numericColEndIdx = isWholeTerm ? 9 : 7;
  const rankColIdx = isWholeTerm ? 10 : 8;
  const subjectColIdx = 1;
  const remarkColIdx = isWholeTerm ? 11 : 9;
  const teacherColIdx = isWholeTerm ? 12 : 10;

  // Reserve vertical space at bottom for Summary (24) + Discipline (12) + Appreciation (19) + Signatures (30+) + section gaps
  const minFooterReserve = 92;
  const maxSubjectsBottomY = 285 - minFooterReserve;
  const visibleSubjects = card.subjects.slice(0, 15);
  const bodyFontSize = isWholeTerm ? 6.3 : 6.7;

  function fitCellLines(
    text: string,
    maxW: number,
    startFont: number,
    style: 'normal' | 'bold'
  ): { lines: string[]; fontSize: number } {
    doc.setFont('helvetica', style);
    let fs = startFont;
    doc.setFontSize(fs);
    let lines = doc.splitTextToSize(text, Math.max(4, maxW)) as string[];
    while (lines.length > 2 && fs > 4.6) {
      fs -= 0.4;
      doc.setFontSize(fs);
      lines = doc.splitTextToSize(text, Math.max(4, maxW)) as string[];
    }
    return { lines: lines.slice(0, 2), fontSize: fs };
  }

  // Precompute visible body rows so we can paint one crisp black table background behind everything
  interface PreparedRow {
    sub: StudentReportCard['subjects'][number];
    fittedSub: { lines: string[]; fontSize: number };
    fittedRem: { lines: string[]; fontSize: number };
    fittedTch: { lines: string[]; fontSize: number };
    cellH: number;
  }

  const headerH = 6.2;
  const totalsH = 5.8;
  const preparedRows: PreparedRow[] = [];
  let cursorY = y + outerPad + headerH + cellGap;

  for (let r = 0; r < visibleSubjects.length; r++) {
    const sub = visibleSubjects[r];
    const subjectLabel =
      sub.nameEn.toLowerCase() === sub.nameFr.toLowerCase()
        ? sub.nameEn
        : `${sub.nameEn} / ${sub.nameFr}`;
    const remarkStr = sub.remark || (sub.score !== null ? suggestRemark(sub.score, lang) : '—');
    const teacherFull = sub.teacherName || '—';

    const fittedSub = fitCellLines(
      subjectLabel,
      colWidths[subjectColIdx] - 2.6,
      bodyFontSize,
      'bold'
    );
    const fittedRem = fitCellLines(
      remarkStr,
      colWidths[remarkColIdx] - 2.4,
      bodyFontSize,
      'normal'
    );
    const fittedTch = fitCellLines(
      teacherFull,
      colWidths[teacherColIdx] - 2.4,
      bodyFontSize,
      'normal'
    );

    const lineCount = Math.max(fittedSub.lines.length, fittedRem.lines.length, fittedTch.lines.length, 1);
    const cellH = lineCount > 1 ? 8.0 : 5.8;

    if (cursorY + cellH + cellGap + totalsH + outerPad > maxSubjectsBottomY) break;
    preparedRows.push({ sub, fittedSub, fittedRem, fittedTch, cellH });
    cursorY += cellH + cellGap;
  }

  const tableStartY = y;
  const tableTotalH =
    outerPad +
    headerH +
    cellGap +
    preparedRows.reduce((acc, row) => acc + row.cellH + cellGap, 0) +
    totalsH +
    outerPad;

  // Solid Black Table Margin Backdrop
  doc.setFillColor(0, 0, 0);
  doc.rect(margin, tableStartY, contentW, tableTotalH, 'F');

  const getCellBox = (colIndex: number) => {
    let left = margin + outerPad;
    for (let k = 0; k < colIndex; k++) left += colWidths[k];
    const insetLeft = colIndex === 0 ? 0 : cellGap / 2;
    const insetRight = colIndex === colWidths.length - 1 ? 0 : cellGap / 2;
    return {
      x: left + insetLeft,
      w: colWidths[colIndex] - insetLeft - insetRight,
      rawLeft: left,
      rawW: colWidths[colIndex],
    };
  };

  // Header Cells
  let rowY = tableStartY + outerPad;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(isWholeTerm ? 6.4 : 6.8);
  for (let i = 0; i < headers.length; i++) {
    const box = getCellBox(i);
    doc.setFillColor(226, 232, 240);
    doc.rect(box.x, rowY, box.w, headerH, 'F');
    doc.setTextColor(15, 23, 42);
    if (i >= 2 && i <= numericColEndIdx) {
      doc.text(headers[i], box.x + box.w - 1.2, rowY + 4.2, { align: 'right' });
    } else if (i === rankColIdx) {
      doc.text(headers[i], box.x + box.w / 2, rowY + 4.2, { align: 'center' });
    } else {
      doc.text(headers[i], box.x + 1.3, rowY + 4.2);
    }
  }
  rowY += headerH + cellGap;

  // Body Rows
  for (let r = 0; r < preparedRows.length; r++) {
    const { sub, fittedSub, fittedRem, fittedTch, cellH } = preparedRows[r];
    const isMulti = cellH > 7;

    for (let i = 0; i < colWidths.length; i++) {
      const box = getCellBox(i);
      if (r % 2 === 1) {
        doc.setFillColor(248, 250, 252);
      } else {
        doc.setFillColor(255, 255, 255);
      }
      doc.rect(box.x, rowY, box.w, cellH, 'F');
    }

    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(bodyFontSize);

    const scoreStr = sub.score !== null ? sub.score.toFixed(2) : '—';
    const coefStr = String(sub.coefficient);
    const totalStr = sub.weightedScore !== null ? sub.weightedScore.toFixed(2) : '—';
    const classAvgStr = sub.classSubjectAverage !== null ? sub.classSubjectAverage.toFixed(2) : '—';
    const minStr = sub.subjectLowest !== null ? sub.subjectLowest.toFixed(2) : '—';
    const maxStr = sub.subjectHighest !== null ? sub.subjectHighest.toFixed(2) : '—';
    const rankStr =
      sub.subjectRank !== null ? `${sub.subjectRank}/${sub.subjectGradedCount}` : '—';

    let colIdx = 0;
    const singleBaselineY = rowY + (isMulti ? 3.8 : 4.0);

    // Code
    {
      const box = getCellBox(colIdx++);
      const codeText = sub.code || '—';
      let codeFontSize = bodyFontSize;
      doc.setFontSize(codeFontSize);
      while (doc.getTextWidth(codeText) > box.w - 2.2 && codeFontSize > 4.4) {
        codeFontSize -= 0.4;
        doc.setFontSize(codeFontSize);
      }
      doc.text(codeText, box.x + 1.2, singleBaselineY);
      doc.setFontSize(bodyFontSize);
    }

    // Subject
    {
      const box = getCellBox(colIdx++);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(fittedSub.fontSize);
      fittedSub.lines.forEach((ln, li) => {
        doc.text(ln, box.x + 1.3, rowY + (fittedSub.lines.length > 1 ? 3.2 + li * 3.0 : 4.0));
      });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(bodyFontSize);
    }

    if (isWholeTerm) {
      const b1 = getCellBox(colIdx++);
      doc.text(
        sub.seq1Score !== null ? sub.seq1Score.toFixed(2) : '—',
        b1.x + b1.w - 1.2,
        singleBaselineY,
        { align: 'right' }
      );
      const b2 = getCellBox(colIdx++);
      doc.text(
        sub.seq2Score !== null ? sub.seq2Score.toFixed(2) : '—',
        b2.x + b2.w - 1.2,
        singleBaselineY,
        { align: 'right' }
      );
    }

    // Mark / Avg
    {
      const box = getCellBox(colIdx++);
      doc.setFont('helvetica', 'bold');
      doc.text(scoreStr, box.x + box.w - 1.2, singleBaselineY, { align: 'right' });
      doc.setFont('helvetica', 'normal');
    }

    // Coef
    {
      const box = getCellBox(colIdx++);
      doc.text(coefStr, box.x + box.w - 1.2, singleBaselineY, { align: 'right' });
    }

    // Total
    {
      const box = getCellBox(colIdx++);
      doc.setFont('helvetica', 'bold');
      doc.text(totalStr, box.x + box.w - 1.2, singleBaselineY, { align: 'right' });
      doc.setFont('helvetica', 'normal');
    }

    // Cls Avg
    {
      const box = getCellBox(colIdx++);
      doc.text(classAvgStr, box.x + box.w - 1.2, singleBaselineY, { align: 'right' });
    }

    // Min
    {
      const box = getCellBox(colIdx++);
      doc.text(minStr, box.x + box.w - 1.2, singleBaselineY, { align: 'right' });
    }

    // Max
    {
      const box = getCellBox(colIdx++);
      doc.text(maxStr, box.x + box.w - 1.2, singleBaselineY, { align: 'right' });
    }

    // Rank
    {
      const box = getCellBox(colIdx++);
      doc.setFont('helvetica', 'bold');
      doc.text(rankStr, box.x + box.w / 2, singleBaselineY, { align: 'center' });
      doc.setFont('helvetica', 'normal');
    }

    // Appreciation
    {
      const box = getCellBox(colIdx++);
      doc.setFontSize(fittedRem.fontSize);
      fittedRem.lines.forEach((ln, li) => {
        doc.text(ln, box.x + 1.3, rowY + (fittedRem.lines.length > 1 ? 3.2 + li * 3.0 : 4.0));
      });
    }

    // Teacher
    {
      const box = getCellBox(colIdx++);
      doc.setFontSize(fittedTch.fontSize);
      fittedTch.lines.forEach((ln, li) => {
        doc.text(ln, box.x + 1.3, rowY + (fittedTch.lines.length > 1 ? 3.2 + li * 3.0 : 4.0));
      });
    }

    doc.setFontSize(bodyFontSize);
    rowY += cellH + cellGap;
  }

  // Totals Row inside the black table margin
  const coefColIdx = isWholeTerm ? 5 : 3;
  const totalColIdx = isWholeTerm ? 6 : 4;
  const firstBox = getCellBox(0);
  const preCoefLastBox = getCellBox(coefColIdx - 1);
  const coefBox = getCellBox(coefColIdx);
  const totalBox = getCellBox(totalColIdx);
  const firstTrailBox = getCellBox(totalColIdx + 1);
  const lastBox = getCellBox(colWidths.length - 1);

  doc.setFillColor(226, 232, 240);
  doc.rect(firstBox.x, rowY, preCoefLastBox.x + preCoefLastBox.w - firstBox.x, totalsH, 'F');
  doc.rect(coefBox.x, rowY, coefBox.w, totalsH, 'F');
  doc.rect(totalBox.x, rowY, totalBox.w, totalsH, 'F');
  doc.rect(firstTrailBox.x, rowY, lastBox.x + lastBox.w - firstTrailBox.x, totalsH, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.1);
  doc.setTextColor(15, 23, 42);
  doc.text('TOTAL', firstBox.x + 1.5, rowY + 4.0);
  doc.text(
    String(card.totalGradedCoefficients > 0 ? card.totalGradedCoefficients : card.totalCoefficients),
    coefBox.x + coefBox.w - 1.2,
    rowY + 4.0,
    { align: 'right' }
  );
  doc.text(card.totalWeightedScore.toFixed(2), totalBox.x + totalBox.w - 1.2, rowY + 4.0, {
    align: 'right',
  });

  // Section 4: Results Summary & Honours Roll (Zero Item Borders, Zero Item Boxes, Zero Additional Item Margins)
  y = tableStartY + tableTotalH + 3.5;
  const sumGapX = 6;
  const sumColW = (contentW - sumGapX) / 2;
  const sumItemH = 4.6;

  const avgDisplay = card.average !== null ? `${card.average.toFixed(2)} / 20` : '—';
  const decisionText =
    card.average === null
      ? 'Pending / En attente'
      : card.average >= 10
        ? 'Promoted / Admis'
        : 'Needs Improvement / Insuffisant';

  const leftSummaryRows = [
    { label: 'General Average / Moyenne Générale:', val: avgDisplay, bold: true },
    { label: 'Class Rank / Rang:', val: formatRank(card.rank, card.totalStudents, lang), bold: false },
    { label: 'Decision / Décision:', val: decisionText, isDecision: true },
  ];

  const rightSummaryRows = [
    {
      label: 'Class Average / Moyenne de la classe:',
      val: card.classAverage !== null ? `${card.classAverage.toFixed(2)} / 20` : '—',
    },
    {
      label: 'Highest Average / Plus forte moyenne:',
      val: card.highestAverage !== null ? `${card.highestAverage.toFixed(2)} / 20` : '—',
    },
    {
      label: 'Lowest Average / Plus faible moyenne:',
      val: card.lowestAverage !== null ? `${card.lowestAverage.toFixed(2)} / 20` : '—',
    },
  ];

  leftSummaryRows.forEach((row, idx) => {
    const ry = y + idx * sumItemH;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.1);
    doc.setTextColor(71, 85, 105);
    doc.text(row.label, margin, ry + 3.4);

    if (row.isDecision) {
      if (card.average !== null && card.average >= 10) doc.setTextColor(22, 101, 52);
      else if (card.average !== null) doc.setTextColor(185, 28, 28);
      else doc.setTextColor(100, 116, 139);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.1);
    } else {
      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(row.bold ? 8.5 : 7.5);
    }
    doc.text(row.val, margin + sumColW, ry + 3.4, { align: 'right' });
  });

  rightSummaryRows.forEach((row, idx) => {
    const rx = margin + sumColW + sumGapX;
    const ry = y + idx * sumItemH;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.1);
    doc.setTextColor(71, 85, 105);
    doc.text(row.label, rx, ry + 3.4);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);
    doc.text(row.val, rx + sumColW, ry + 3.4, { align: 'right' });
  });

  // Dedicated Honours Roll Strip
  y += 3 * sumItemH + 1.5;
  if (honourRoll) {
    doc.setFillColor(236, 253, 245);
  } else {
    doc.setFillColor(241, 245, 249);
  }
  doc.rect(margin, y, contentW, 6.4, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.1);
  doc.setTextColor(15, 23, 42);
  doc.text('HONOURS ROLL / TABLEAU D’HONNEUR (≥ 12.00 / 20):', margin + 2.4, y + 4.3);

  if (honourRoll) {
    doc.setTextColor(22, 101, 52);
    doc.text(
      `YES — AWARDED / DÉCERNÉ (${card.average !== null ? card.average.toFixed(2) : '—'}/20)`,
      pageW - margin - 2.4,
      y + 4.3,
      { align: 'right' }
    );
  } else {
    doc.setTextColor(100, 116, 139);
    doc.text(
      card.average === null ? 'Pending / En attente' : 'No / Non (Below 12.00 / 20)',
      pageW - margin - 2.4,
      y + 4.3,
      { align: 'right' }
    );
  }

  // Section 5: Discipline & Attendance (Zero Item Borders, Zero Item Boxes, Zero Additional Item Margins)
  y += 6.4 + 3.5;
  doc.setFillColor(226, 232, 240);
  doc.rect(margin, y, contentW, 5.2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(15, 23, 42);
  doc.text('DISCIPLINE & ATTENDANCE / DISCIPLINE & ASSIDUITÉ', margin + 2.4, y + 3.7);

  y += 5.2;
  const discGap = 4;
  const dColW = [38, 41, 31, contentW - 38 - 41 - 31 - discGap * 3];
  const sanctionText = card.discipline.sanction || 'None / Aucune';
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  const sanctionLines = (doc.splitTextToSize(sanctionText, dColW[3] - 13) as string[]).slice(0, 2);
  const discBodyH = sanctionLines.length > 1 ? 8.2 : 5.8;

  let dx = margin;
  const dTextY = y + 4.0;
  doc.setFontSize(6.8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('Justified Abs.:', dx, dTextY);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(String(card.discipline.justifiedAbsences), dx + dColW[0], dTextY, { align: 'right' });
  dx += dColW[0] + discGap;

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('Unjustified Abs.:', dx, dTextY);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(
    card.discipline.unjustifiedAbsences > 0 ? 185 : 15,
    card.discipline.unjustifiedAbsences > 0 ? 28 : 23,
    card.discipline.unjustifiedAbsences > 0 ? 28 : 42
  );
  doc.text(String(card.discipline.unjustifiedAbsences), dx + dColW[1], dTextY, { align: 'right' });
  dx += dColW[1] + discGap;

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('Late / Retards:', dx, dTextY);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(String(card.discipline.lateComings), dx + dColW[2], dTextY, { align: 'right' });
  dx += dColW[2] + discGap;

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('Sanction:', dx, dTextY);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(
    card.discipline.sanction ? 180 : 15,
    card.discipline.sanction ? 83 : 23,
    card.discipline.sanction ? 9 : 42
  );
  sanctionLines.forEach((ln, li) => {
    doc.text(ln, dx + dColW[3], y + (sanctionLines.length > 1 ? 3.8 + li * 3.1 : 4.0), {
      align: 'right',
    });
  });

  // Section 6: Parent & Class Master Appreciation (Zero Item Borders, Zero Item Boxes, Zero Additional Item Margins)
  y += discBodyH + 3.5;
  doc.setFillColor(226, 232, 240);
  doc.rect(margin, y, contentW, 5.2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(15, 23, 42);
  doc.text(
    'PARENT & CLASS MASTER APPRECIATION / APPRÉCIATION DU PARENT & DU PROFESSEUR PRINCIPAL',
    margin + 2.4,
    y + 3.7
  );

  y += 5.2;
  const appGap = 6;
  const appColW = (contentW - appGap) / 2;
  const appBodyH = 12.5;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.9);
  doc.setTextColor(15, 23, 42);
  doc.text(
    lang === 'fr' ? 'Appréciation du Parent / Tuteur' : 'Parent / Guardian Appreciation',
    margin,
    y + 4.0
  );
  doc.text(
    lang === 'fr' ? 'Appréciation du Professeur Principal' : 'Class Master Appreciation',
    margin + appColW + appGap,
    y + 4.0
  );

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.6);
  doc.setTextColor(148, 163, 184);
  doc.text(
    lang === 'fr'
      ? 'Observations : .....................................................................'
      : 'Remarks / Observation: ............................................................',
    margin,
    y + 10.6
  );

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(6.6);
  doc.setTextColor(51, 65, 85);
  const councilLines = (doc.splitTextToSize(councilNote, appColW) as string[]).slice(0, 2);
  councilLines.forEach((ln, li) => {
    doc.text(ln, margin + appColW + appGap, y + 7.8 + li * 3.1);
  });

  // Section 7: Parent, Class Master & Head Teacher Signatures Table — Black Table Margins, Fills Remaining Vertical Space
  y += appBodyH + 3.5;
  const bottomMarginY = 285;
  const sigOuterPad = 0.5;
  const sigGap = 0.35;
  const sigColW = (contentW - sigOuterPad * 2 - sigGap * 2) / 3;

  const hLines0 = (doc.splitTextToSize('Parent / Guardian', sigColW - 4) as string[]).slice(0, 2);
  const hLines1 = (doc.splitTextToSize('Class Master / Prof. Principal', sigColW - 4) as string[]).slice(0, 2);
  const hLines2 = (doc.splitTextToSize('The Head Teacher / Chef d’Établissement', sigColW - 4) as string[]).slice(0, 2);
  const sigHeaderLines = Math.max(hLines0.length, hLines1.length, hLines2.length, 1);
  const sigHeaderH = sigHeaderLines > 1 ? 8.2 : 6.2;
  const totalSigTableH = Math.max(24, bottomMarginY - y);
  const sigBodyH = Math.max(14, totalSigTableH - sigOuterPad * 2 - sigHeaderH - sigGap);

  // Solid Black Table Margin Backdrop
  doc.setFillColor(0, 0, 0);
  doc.rect(margin, y, contentW, totalSigTableH, 'F');

  for (let c = 0; c < 3; c++) {
    const cxCell = margin + sigOuterPad + c * (sigColW + sigGap);
    doc.setFillColor(226, 232, 240);
    doc.rect(cxCell, y + sigOuterPad, sigColW, sigHeaderH, 'F');
    doc.setFillColor(255, 255, 255);
    doc.rect(cxCell, y + sigOuterPad + sigHeaderH + sigGap, sigColW, sigBodyH, 'F');
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.9);
  doc.setTextColor(15, 23, 42);
  hLines0.forEach((ln, li) => {
    doc.text(
      ln,
      margin + sigOuterPad + sigColW * 0.5,
      y + sigOuterPad + (hLines0.length > 1 ? 3.5 + li * 3.1 : 4.2),
      { align: 'center' }
    );
  });
  hLines1.forEach((ln, li) => {
    doc.text(
      ln,
      margin + sigOuterPad + sigColW + sigGap + sigColW * 0.5,
      y + sigOuterPad + (hLines1.length > 1 ? 3.5 + li * 3.1 : 4.2),
      { align: 'center' }
    );
  });
  hLines2.forEach((ln, li) => {
    doc.text(
      ln,
      margin + sigOuterPad + (sigColW + sigGap) * 2 + sigColW * 0.5,
      y + sigOuterPad + (hLines2.length > 1 ? 3.5 + li * 3.1 : 4.2),
      { align: 'center' }
    );
  });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  const sigBottomY = y + sigOuterPad + sigHeaderH + sigGap + sigBodyH;
  doc.text('Date & Signature', margin + sigOuterPad + sigColW * 0.5, sigBottomY - 3.2, {
    align: 'center',
  });
  doc.text(
    'Date & Signature',
    margin + sigOuterPad + sigColW + sigGap + sigColW * 0.5,
    sigBottomY - 3.2,
    { align: 'center' }
  );

  const cityDateLines = (
    doc.splitTextToSize(`${school.city}, ${new Date().toLocaleDateString()}`, sigColW - 6) as string[]
  ).slice(0, 2);
  const headColCenterX = margin + sigOuterPad + (sigColW + sigGap) * 2 + sigColW * 0.5;
  cityDateLines.forEach((ln, li) => {
    doc.text(ln, headColCenterX, sigBottomY - 9.5 + li * 3.2, { align: 'center' });
  });
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  const htLines = (doc.splitTextToSize(school.headTeacherName, sigColW - 6) as string[]).slice(0, 2);
  htLines.forEach((ln, li) => {
    doc.text(
      ln,
      headColCenterX,
      sigBottomY - 3.2 - (htLines.length - 1 - li) * 3.2,
      { align: 'center' }
    );
  });
}

export async function exportClassReportCardsPdf(
  bundle: ClassReportBundle,
  lang: Language,
  studentFilter?: string | string[]
): Promise<void> {
  let cards = bundle.cards;
  if (typeof studentFilter === 'string') {
    cards = bundle.cards.filter((c) => c.student.id === studentFilter);
  } else if (Array.isArray(studentFilter)) {
    const idSet = new Set(studentFilter);
    cards = bundle.cards.filter((c) => idSet.has(c.student.id));
  }

  if (cards.length === 0) return;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const logoPng = await rasterizeLogoToPng(bundle.school.logoDataUrl || SCHOOL_ASSETS.defaultLogo);

  cards.forEach((card, index) => {
    if (index > 0) doc.addPage();
    renderCardPage(doc, bundle.school, card, logoPng, lang);
  });

  const safeClassName = bundle.classItem.name.replace(/[^a-zA-Z0-9_-]+/g, '_');
  const periodSuffix = bundle.period === 'term' ? 'WholeTerm' : bundle.period.toUpperCase();
  const isSingle = typeof studentFilter === 'string' || (Array.isArray(studentFilter) && cards.length === 1);
  const isSubset = Array.isArray(studentFilter) && cards.length > 1 && cards.length < bundle.cards.length;
  const fileName = isSingle
    ? `ReportCard_${safeClassName}_${cards[0].student.matricule}_Term${bundle.term}_${periodSuffix}.pdf`
    : isSubset
      ? `ReportCards_${safeClassName}_Selected${cards.length}_Term${bundle.term}_${periodSuffix}.pdf`
      : `ReportCards_${safeClassName}_Term${bundle.term}_${periodSuffix}.pdf`;

  doc.save(fileName);
}

export async function exportClassSummaryPdf(
  bundle: ClassReportBundle,
  lang: Language
): Promise<void> {
  if (bundle.cards.length === 0) return;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const logoPng = await rasterizeLogoToPng(bundle.school.logoDataUrl || SCHOOL_ASSETS.defaultLogo);

  const pageW = 210;
  const margin = 12;
  const contentW = pageW - margin * 2; // 186mm
  const centerX = pageW / 2;

  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(0.35);
  doc.rect(7, 7, pageW - 14, 283);

  // Header
  if (logoPng) {
    const logoSize = 15;
    const ratio = logoPng.width / logoPng.height;
    const drawW = ratio >= 1 ? logoSize : logoSize * ratio;
    const drawH = ratio >= 1 ? logoSize / ratio : logoSize;
    doc.addImage(logoPng.dataUrl, 'PNG', margin, 11, drawW, drawH);
  }

  doc.setTextColor(15, 23, 42);
  doc.setFont('times', 'bolditalic');
  doc.setFontSize(14);
  doc.text(bundle.school.nameEn, centerX, 17, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(
    `${bundle.school.academicYear}  ·  ${bundle.classItem.name} (${lang === 'fr' ? bundle.section.nameFr : bundle.section.nameEn})`,
    centerX,
    22.5,
    { align: 'center' }
  );

  // Banner
  const periodLabel =
    bundle.period === 'seq1'
      ? `TERM ${bundle.term} · SEQUENCE 1`
      : bundle.period === 'seq2'
        ? `TERM ${bundle.term} · SEQUENCE 2`
        : `TERM ${bundle.term} (SEQ 1 & 2)`;
  doc.setFillColor(15, 23, 42);
  doc.rect(margin, 28, contentW, 8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text(`CLASS PERFORMANCE SUMMARY & MERIT SHEET  —  ${periodLabel}`, centerX, 33.4, {
    align: 'center',
  });

  // KPI Strip (Unboxed Data Items)
  let y = 39.5;
  const kpis = [
    {
      label: 'Class Average',
      value: bundle.summary.classAverage !== null ? `${bundle.summary.classAverage.toFixed(2)} / 20` : '—',
    },
    {
      label: 'Pass Rate (≥10)',
      value: bundle.summary.passRate !== null ? `${bundle.summary.passRate}%` : '—',
    },
    {
      label: 'Highest / Lowest',
      value:
        bundle.summary.highestAverage !== null && bundle.summary.lowestAverage !== null
          ? `${bundle.summary.highestAverage.toFixed(2)} / ${bundle.summary.lowestAverage.toFixed(2)}`
          : '—',
    },
    {
      label: 'Honours Roll (≥12)',
      value: `${bundle.summary.honorRollCount} / ${bundle.summary.studentCount}`,
    },
  ];
  const kpiGap = 4;
  const kpiCardW = (contentW - kpiGap * 3) / 4;
  kpis.forEach((k, idx) => {
    const kx = margin + idx * (kpiCardW + kpiGap);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.1);
    doc.setTextColor(100, 116, 139);
    doc.text(k.label, kx + kpiCardW / 2, y + 4.4, { align: 'center' });
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.4);
    doc.setTextColor(15, 23, 42);
    doc.text(k.value, kx + kpiCardW / 2, y + 10.2, { align: 'center' });
  });

  const outerPad = 0.5;
  const cellGap = 0.3;

  // Subject Summary Table with Black Table Margins
  y += 16.5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text('Subject Breakdown / Synthèse par Matière', margin, y);
  y += 3;

  const subCols = [16, 61, 16, 20, 20, 20, 32]; // sums to 185 = contentW - 2*0.5
  const subHeaders = ['Code', 'Subject / Matière', 'Coef', 'Cls Avg', 'Min', 'Max', 'Teacher'];
  const subjects = (bundle.cards[0]?.subjects ?? []).slice(0, 10);

  const subPrepared = subjects.map((sub) => {
    const subLabel = lang === 'fr' ? sub.nameFr : sub.nameEn;
    const tName = sub.teacherName || '—';
    doc.setFontSize(7.0);
    doc.setFont('helvetica', 'bold');
    const sLines = (doc.splitTextToSize(subLabel, subCols[1] - 3.6) as string[]).slice(0, 2);
    doc.setFont('helvetica', 'normal');
    const tLines = (doc.splitTextToSize(tName, subCols[6] - 3.6) as string[]).slice(0, 2);
    const cellH = Math.max(sLines.length, tLines.length) > 1 ? 8.0 : 6.0;
    return { sub, sLines, tLines, cellH };
  });

  const subHeaderH = 6.2;
  const subTableH =
    outerPad +
    subHeaderH +
    subPrepared.reduce((acc, row) => acc + cellGap + row.cellH, 0) +
    outerPad;

  doc.setFillColor(0, 0, 0);
  doc.rect(margin, y, contentW, subTableH, 'F');

  const getSubCellBox = (colIndex: number) => {
    let left = margin + outerPad;
    for (let k = 0; k < colIndex; k++) left += subCols[k];
    const insetLeft = colIndex === 0 ? 0 : cellGap / 2;
    const insetRight = colIndex === subCols.length - 1 ? 0 : cellGap / 2;
    return { x: left + insetLeft, w: subCols[colIndex] - insetLeft - insetRight };
  };

  let sy = y + outerPad;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.4);
  subHeaders.forEach((h, i) => {
    const box = getSubCellBox(i);
    doc.setFillColor(226, 232, 240);
    doc.rect(box.x, sy, box.w, subHeaderH, 'F');
    doc.setTextColor(15, 23, 42);
    if (i >= 2 && i <= 5) {
      doc.text(h, box.x + box.w - 1.5, sy + 4.3, { align: 'right' });
    } else {
      doc.text(h, box.x + 1.5, sy + 4.3);
    }
  });
  sy += subHeaderH + cellGap;

  subPrepared.forEach(({ sub, sLines, tLines, cellH }, idx) => {
    for (let i = 0; i < subCols.length; i++) {
      const box = getSubCellBox(i);
      if (idx % 2 === 1) doc.setFillColor(248, 250, 252);
      else doc.setFillColor(255, 255, 255);
      doc.rect(box.x, sy, box.w, cellH, 'F');
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.0);
    doc.setTextColor(15, 23, 42);
    const baseLineY = sy + (cellH > 7 ? 4.0 : 4.1);

    const b0 = getSubCellBox(0);
    doc.text(sub.code || '—', b0.x + 1.5, baseLineY);

    const b1 = getSubCellBox(1);
    doc.setFont('helvetica', 'bold');
    sLines.forEach((ln, li) => {
      doc.text(ln, b1.x + 1.5, sy + (sLines.length > 1 ? 3.2 + li * 3.1 : 4.1));
    });
    doc.setFont('helvetica', 'normal');

    const b2 = getSubCellBox(2);
    doc.text(String(sub.coefficient), b2.x + b2.w - 1.5, baseLineY, { align: 'right' });

    const b3 = getSubCellBox(3);
    doc.text(
      sub.classSubjectAverage !== null ? sub.classSubjectAverage.toFixed(2) : '—',
      b3.x + b3.w - 1.5,
      baseLineY,
      { align: 'right' }
    );

    const b4 = getSubCellBox(4);
    doc.text(
      sub.subjectLowest !== null ? sub.subjectLowest.toFixed(2) : '—',
      b4.x + b4.w - 1.5,
      baseLineY,
      { align: 'right' }
    );

    const b5 = getSubCellBox(5);
    doc.text(
      sub.subjectHighest !== null ? sub.subjectHighest.toFixed(2) : '—',
      b5.x + b5.w - 1.5,
      baseLineY,
      { align: 'right' }
    );

    const b6 = getSubCellBox(6);
    tLines.forEach((ln, li) => {
      doc.text(ln, b6.x + 1.5, sy + (tLines.length > 1 ? 3.2 + li * 3.1 : 4.1));
    });
    sy += cellH + cellGap;
  });

  // Merit Leaderboard Table with Black Table Margins
  y += subTableH + 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text('Merit Ranking & Honours Roll / Classement de la Classe', margin, y);
  y += 3;

  const stuCols = [16, 26, 59, 22, 26, 36]; // sums to 185
  const stuHeaders = ['Rank', 'Matricule', 'Student Name', 'Average', 'Honours (≥12)', 'Abs. (J / U / L)'];

  const getStuCellBox = (colIndex: number) => {
    let left = margin + outerPad;
    for (let k = 0; k < colIndex; k++) left += stuCols[k];
    const insetLeft = colIndex === 0 ? 0 : cellGap / 2;
    const insetRight = colIndex === stuCols.length - 1 ? 0 : cellGap / 2;
    return { x: left + insetLeft, w: stuCols[colIndex] - insetLeft - insetRight };
  };

  const renderMeritHeader = (startY: number) => {
    doc.setFillColor(0, 0, 0);
    doc.rect(margin, startY, contentW, outerPad + subHeaderH + cellGap, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.4);
    stuHeaders.forEach((h, i) => {
      const box = getStuCellBox(i);
      doc.setFillColor(226, 232, 240);
      doc.rect(box.x, startY + outerPad, box.w, subHeaderH, 'F');
      doc.setTextColor(15, 23, 42);
      if (i === 3) doc.text(h, box.x + box.w - 1.5, startY + outerPad + 4.3, { align: 'right' });
      else doc.text(h, box.x + 1.5, startY + outerPad + 4.3);
    });
    return startY + outerPad + subHeaderH + cellGap;
  };

  y = renderMeritHeader(y);

  const ranked = [...bundle.cards].sort((a, b) => {
    if (a.average === null && b.average === null) return a.student.fullName.localeCompare(b.student.fullName);
    if (a.average === null) return 1;
    if (b.average === null) return -1;
    return b.average - a.average;
  });

  ranked.forEach((card, idx) => {
    doc.setFontSize(7.0);
    doc.setFont('helvetica', 'bold');
    const nameLines = (doc.splitTextToSize(card.student.fullName, stuCols[2] - 3.6) as string[]).slice(0, 2);
    const cellH = nameLines.length > 1 ? 8.0 : 6.0;

    if (y + cellH + outerPad > 281) {
      // Close black bottom margin on finished page table chunk
      doc.setFillColor(0, 0, 0);
      doc.rect(margin, y - cellGap, contentW, outerPad + cellGap, 'F');
      doc.addPage();
      doc.setDrawColor(148, 163, 184);
      doc.setLineWidth(0.35);
      doc.rect(7, 7, pageW - 14, 283);
      y = 15;
      y = renderMeritHeader(y);
    }

    doc.setFillColor(0, 0, 0);
    doc.rect(margin, y, contentW, cellH + cellGap, 'F');

    for (let i = 0; i < stuCols.length; i++) {
      const box = getStuCellBox(i);
      if (idx % 2 === 1) doc.setFillColor(248, 250, 252);
      else doc.setFillColor(255, 255, 255);
      doc.rect(box.x, y, box.w, cellH, 'F');
    }

    doc.setFontSize(7.0);
    const baseLineY = y + (cellH > 7 ? 4.0 : 4.1);

    const s0 = getStuCellBox(0);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(formatRank(card.rank, card.totalStudents, lang), s0.x + 1.5, baseLineY);

    const s1 = getStuCellBox(1);
    doc.setFont('helvetica', 'normal');
    doc.text(card.student.matricule, s1.x + 1.5, baseLineY);

    const s2 = getStuCellBox(2);
    doc.setFont('helvetica', 'bold');
    nameLines.forEach((ln, li) => {
      doc.text(ln, s2.x + 1.5, y + (nameLines.length > 1 ? 3.2 + li * 3.1 : 4.1));
    });

    const s3 = getStuCellBox(3);
    doc.text(
      card.average !== null ? `${card.average.toFixed(2)}` : '—',
      s3.x + s3.w - 1.5,
      baseLineY,
      { align: 'right' }
    );

    const s4 = getStuCellBox(4);
    const honour = card.honourRoll || (card.average !== null && card.average >= 12);
    doc.setTextColor(honour ? 22 : 100, honour ? 101 : 116, honour ? 52 : 139);
    doc.text(honour ? 'YES / OUI' : 'No', s4.x + 1.5, baseLineY);

    const s5 = getStuCellBox(5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(
      `${card.discipline.justifiedAbsences} / ${card.discipline.unjustifiedAbsences} / ${card.discipline.lateComings}`,
      s5.x + 1.5,
      baseLineY
    );
    y += cellH + cellGap;
  });

  // Close final black bottom margin on merit table
  doc.setFillColor(0, 0, 0);
  doc.rect(margin, y - cellGap, contentW, outerPad + cellGap, 'F');

  const safeClassName = bundle.classItem.name.replace(/[^a-zA-Z0-9_-]+/g, '_');
  const periodSuffix = bundle.period === 'term' ? 'WholeTerm' : bundle.period.toUpperCase();
  doc.save(`ClassSummary_${safeClassName}_Term${bundle.term}_${periodSuffix}.pdf`);
}
