import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = path.resolve(process.cwd());
const src = path.join(root, 'src');
const failures = [];
const passes = [];

function assert(condition, message) {
  if (condition) passes.push(message);
  else failures.push(message);
}

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function filesUnder(directory) {
  const output = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) output.push(...filesUnder(target));
    else output.push(target);
  }
  return output;
}

function flattenKeys(value, prefix = '') {
  return Object.entries(value).flatMap(([key, child]) => {
    const next = prefix ? `${prefix}.${key}` : key;
    return child && typeof child === 'object' && !Array.isArray(child)
      ? flattenKeys(child, next)
      : [next];
  });
}

const html = read('index.html');
const theme = read('src/theme/AppTheme.jsx');
const forms = read('src/styles/forms.css');
const rtl = read('src/styles/rtl.css');
const tables = read('src/styles/tables.css');
const components = read('src/styles/components.css');
const translator = read('src/locales/t.js');
const app = read('src/App.jsx');
const fieldComponent = read('src/components/forms/Field.jsx');
const sourceFiles = filesUnder(src).filter((file) => /\.(jsx?|css)$/.test(file));
const combinedSource = sourceFiles.map((file) => fs.readFileSync(file, 'utf8')).join('\n');

assert(/<html\s+lang="ar"\s+dir="rtl">/.test(html), 'index.html is fixed to Arabic RTL.');
assert(/direction:\s*['"]rtl['"]/.test(theme), 'Material UI theme direction is RTL.');
assert(/document\.documentElement\.dir\s*=\s*['"]rtl['"]/.test(theme), 'Runtime document direction is forced to RTL.');
assert(/from\s+['"]\.\/ar\.json['"]/.test(translator), 'Runtime translator reads Arabic JSON.');
assert(!/from\s+['"]\.\/en\.json['"]/.test(translator), 'English JSON is not loaded at runtime.');
assert(!/setLocale|toggleLanguage|languageSwitch|changeLanguage/i.test(combinedSource), 'No runtime language switch exists.');

assert(/stylisPlugins:\s*\[prefixer,\s*rtlPlugin\]/.test(theme), 'Stable Emotion RTL cache uses prefixer then rtlPlugin.');
assert(!/rtlPlugin\.default|rtlPluginFunc/.test(theme), 'No unstable RTL plugin wrapper remains.');
assert(/cloneElement\(children/.test(fieldComponent) && /label:\s*label/.test(fieldComponent), 'Shared Field injects native MUI labels.');
assert(/ALWAYS_SHRINK_TYPES/.test(fieldComponent), 'Date and time fields can force label shrink safely.');
assert(!/translate\([^)]*-9px[^)]*\)\s*scale/.test(forms), 'No manual floating-label transform overrides remain.');
assert(!/:has\(/.test(forms), 'Form styling avoids fragile :has-based label logic.');
assert(/MuiOutlinedInput-notchedOutline[\s\S]*text-align:\s*right/.test(rtl), 'Outlined fieldset and legend align to the RTL start edge.');
assert(/MuiOutlinedInput-notchedOutline legend/.test(forms), 'Native MUI legend remains enabled for the notch.');
assert(/boxShadow:[\s\S]*0 0 0 3px/.test(theme), 'Focused fields use a clear focus ring.');
assert(/prefers-reduced-motion:\s*reduce/.test(forms), 'Field animation respects reduced motion.');
assert(/--a4-field-bg/.test(read('src/styles/variables.css')), 'Semantic field background tokens exist.');

assert(!/\b(?:InputProps|InputLabelProps|inputProps|PaperProps)\s*=/.test(combinedSource), 'Deprecated MUI props are not passed through the React tree.');
assert(!/alignItems=/.test(combinedSource), 'No system styling prop leaks to native DOM nodes.');
assert(/slotProps:\s*\{[\s\S]*inputLabel/.test(fieldComponent), 'Shared Field uses MUI v9 slotProps.');
assert(/MuiButton:[\s\S]*gap:\s*8/.test(theme), 'Theme keeps an 8px button icon/text gap.');
assert(/MuiButton-startIcon,[\s\S]*MuiButton-endIcon[\s\S]*margin:\s*0/.test(forms), 'Button icon margins are normalized for RTL.');
assert(/MuiTableCell-root[\s\S]*text-align:\s*right/.test(rtl), 'All table cells default to RTL right alignment.');
assert(/MuiTableCell-head/.test(tables) && /MuiTableCell-body/.test(tables), 'Desktop table typography and spacing are standardized.');
assert(/text-align:\s*center/.test(components), 'Centered feedback and receipt contexts are defined explicitly.');

const requiredPages = [
  'Login', 'Dashboard', 'POS', 'Products', 'Categories', 'PriceTiers', 'Inventory',
  'Preorders', 'Customers', 'Payments', 'ShiftSummary', 'Shifts', 'Users', 'Reports',
  'Receipts', 'AuditLogs', 'PrinterSettings',
];
for (const page of requiredPages) {
  assert(fs.existsSync(path.join(src, 'pages', `${page}.jsx`)), `Page exists: ${page}.`);
  assert(new RegExp(`pages/${page}\\.jsx`).test(app), `Page is routed: ${page}.`);
}

const ar = JSON.parse(read('src/locales/ar.json'));
const en = JSON.parse(read('src/locales/en.json'));
assert(JSON.stringify(flattenKeys(ar).sort()) === JSON.stringify(flattenKeys(en).sort()), 'Arabic and future English JSON files have matching key structure.');
assert(!/MongoDB|Mongoose/.test(combinedSource), 'Frontend contains no MongoDB/Mongoose assumptions.');
assert(/localStorage\.getItem\(['"]a4_color_mode['"]\)/.test(theme), 'Light/dark preference is persisted.');
assert(/@media \(max-width: 900px\)/.test(read('src/styles/layout.css')), 'Responsive navigation rules exist.');
assert(/@media print/.test(combinedSource), 'Printer-safe styles exist.');

console.log(`UI validation: ${passes.length} passed, ${failures.length} failed.`);
for (const item of passes) console.log(`✔ ${item}`);
for (const item of failures) console.error(`✘ ${item}`);
if (failures.length) process.exit(1);
