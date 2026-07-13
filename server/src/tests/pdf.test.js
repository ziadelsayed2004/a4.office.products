import assert from 'node:assert/strict';
import { escapeHtml, printableDocument } from '../utils/pdf.js';

assert.equal(
  escapeHtml(`<script>alert("x")</script>&'`),
  '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;&amp;&#39;'
);
const document = printableDocument({
  title: 'فاتورة <A4>',
  subtitle: 'اختبار',
  body: '<p>trusted body</p>',
});
assert.match(document, /lang="ar" dir="rtl"/);
assert.match(document, /Noto Kufi Arabic/);
assert.match(document, /فاتورة &lt;A4&gt;/);
assert.match(document, /<p>trusted body<\/p>/);
assert.doesNotMatch(document, /fonts\.googleapis|https?:\/\//);

console.log('PDF template security checks passed.');
