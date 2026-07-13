import config from '../../config/index.js';
import { AppError } from '../../utils/errors.js';
import { escapeHtml, printableDocument, renderPdf } from '../../utils/pdf.js';

export async function generateReportPdf({ type, rows, headers }) {
  if (rows.length > config.pdf.maxRecords) {
    throw new AppError(
      `PDF exports are limited to ${config.pdf.maxRecords} records.`,
      400,
      'PDF_RECORD_LIMIT'
    );
  }
  const head = headers.map(([label]) => `<th>${escapeHtml(label)}</th>`).join('');
  const bodyRows = rows
    .map(
      (row) =>
        `<tr>${headers.map(([, key]) => `<td>${escapeHtml(row[key] ?? '-')}</td>`).join('')}</tr>`
    )
    .join('');
  const html = printableDocument({
    title: `A4 Office Report: ${type}`,
    subtitle: `${rows.length} records`,
    body: `<table><thead><tr>${head}</tr></thead><tbody>${bodyRows}</tbody></table>`,
  });
  return renderPdf(html);
}
