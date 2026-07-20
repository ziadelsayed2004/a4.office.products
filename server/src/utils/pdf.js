import puppeteer from 'puppeteer-core';
import config from '../config/index.js';
import { AppError } from './errors.js';

let activeJobs = 0;

export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function isChromiumAvailable() {
  return config.pdf.chromiumAvailable();
}

export async function renderPdf(html, { launch = puppeteer.launch, elementPage = null } = {}) {
  if (!isChromiumAvailable()) {
    throw new AppError('PDF generation is unavailable.', 503, 'PDF_ENGINE_UNAVAILABLE');
  }
  if (activeJobs >= config.pdf.maxConcurrency) {
    throw new AppError('PDF generation is busy. Try again shortly.', 503, 'PDF_ENGINE_BUSY');
  }

  activeJobs += 1;
  let browser;
  try {
    const sandboxArgs =
      process.platform === 'linux' && process.getuid?.() === 0
        ? ['--no-sandbox', '--disable-setuid-sandbox']
        : [];
    browser = await launch({
      executablePath: config.pdf.chromiumExecutablePath,
      headless: true,
      timeout: config.pdf.timeoutMs,
      args: ['--disable-dev-shm-usage', '--disable-gpu', '--no-first-run', ...sandboxArgs],
    });
    const page = await browser.newPage();
    page.setDefaultTimeout(config.pdf.timeoutMs);
    await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: config.pdf.timeoutMs });
    let pdfOptions = {
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: '12mm', right: '12mm', bottom: '12mm', left: '12mm' },
    };

    if (elementPage) {
      await page.evaluate(async () => {
        if (document.fonts?.ready) await document.fonts.ready;
        await Promise.all(
          [...document.images].map(async (image) => {
            if (!image.complete) {
              await new Promise((resolve) => {
                image.addEventListener('load', resolve, { once: true });
                image.addEventListener('error', resolve, { once: true });
              });
            }
            await image.decode?.().catch(() => undefined);
          })
        );
      });
      const measurement = await page.evaluate(
        ({ selector, widthMm, cutFeedMm }) => {
          const element = document.querySelector(selector);
          if (!element) throw new Error(`PDF sizing element was not found: ${selector}`);
          const rect = element.getBoundingClientRect();
          const pixelHeight = Math.max(rect.height, element.scrollHeight, element.offsetHeight);
          if (!(rect.width > 0) || !(pixelHeight > 0)) {
            throw new Error('PDF sizing element has invalid dimensions.');
          }
          const contentHeightMm = (pixelHeight * widthMm) / rect.width;
          return Math.max(20, Math.ceil((contentHeightMm + cutFeedMm) * 10) / 10);
        },
        {
          selector: elementPage.selector,
          widthMm: elementPage.widthMm,
          cutFeedMm: elementPage.cutFeedMm ?? 1.5,
        }
      );
      pdfOptions = {
        width: `${elementPage.widthMm}mm`,
        height: `${measurement}mm`,
        printBackground: true,
        preferCSSPageSize: false,
        margin: { top: '0', right: '0', bottom: '0', left: '0' },
      };
    }

    return Buffer.from(await page.pdf(pdfOptions));
  } catch (error) {
    if (error instanceof AppError) throw error;
    console.error('PDF generation failed:', error?.stack || error);
    throw new AppError('PDF generation failed.', 503, 'PDF_GENERATION_FAILED');
  } finally {
    await browser?.close().catch(() => undefined);
    activeJobs -= 1;
  }
}

export function printableDocument({ title, subtitle = '', body }) {
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
  <style>
  @page{size:A4;margin:12mm}*{box-sizing:border-box}body{margin:0;color:#172033;font-family:"Noto Kufi Arabic","Noto Sans Arabic",Arial,sans-serif;font-size:11px;line-height:1.65}header{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2px solid #0f5fa6;padding-bottom:10px;margin-bottom:18px}h1{font-size:21px;color:#0f5fa6;margin:0}h2{font-size:14px;color:#0f5fa6;margin:18px 0 8px}.muted{color:#667085}.meta{display:grid;grid-template-columns:repeat(2,1fr);gap:8px 18px;background:#f6f8fb;border:1px solid #dfe5ec;border-radius:8px;padding:12px}.meta strong{display:inline-block;min-width:105px}table{width:100%;border-collapse:collapse;margin-top:10px}th,td{border:1px solid #dfe5ec;padding:7px;text-align:right;vertical-align:top}th{background:#eef4fa;color:#173b5f}.number{direction:ltr;text-align:left;white-space:nowrap}.total{font-size:14px;font-weight:700;color:#0f5fa6}.page-break{break-before:page}.avoid-break{break-inside:avoid}footer{margin-top:18px;border-top:1px solid #dfe5ec;padding-top:7px;color:#667085;font-size:9px}
  </style></head><body><header><div><h1>${escapeHtml(title)}</h1><div class="muted">${escapeHtml(subtitle)}</div></div><strong>A4 Office</strong></header>${body}<footer>Generated securely by A4 Office · ${escapeHtml(new Date().toLocaleString('ar-EG', { timeZone: 'Africa/Cairo' }))}</footer></body></html>`;
}
