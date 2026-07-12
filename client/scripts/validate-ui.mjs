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
assert(/cloneElement\(children/.test(fieldComponent) && /label:\s*label/.test(fieldComponent), 'Shared Field injects animated MUI labels into TextField controls.');
assert(!/MuiOutlinedInput-root legend \{ display: none; \}/.test(read('src/styles/index.css')), 'Outlined-field legends remain enabled for animated notches.');
assert(/MuiOutlinedInput-notchedOutline[\s\S]*text-align:\s*right/.test(read('src/styles/index.css')), 'Outlined notches are aligned to the RTL start edge.');
assert(/boxShadow:[\s\S]*0 0 0 3px/.test(theme), 'Focused fields use a clear animated focus ring.');
assert(/prefers-reduced-motion:\s*reduce/.test(read('src/styles/index.css')), 'Input animations respect reduced-motion preference.');

assert(!/\b(?:InputProps|InputLabelProps|inputProps|PaperProps)\s*=/.test(combinedSource), 'Deprecated MUI props are not passed through the React tree.');
assert(/stylis-plugin-rtl|createCache\(|CacheProvider/.test(combinedSource), 'Emotion/Stylis RTL cache is configured in the runtime.');
assert(/slotProps:\s*\{[\s\S]*inputLabel/.test(fieldComponent), 'Shared Field uses MUI v9 slotProps for the animated input label.');
assert(/MuiButton:[\s\S]*gap:\s*8/.test(theme), 'Buttons keep a consistent gap between icon and text.');
assert(/MuiButton-startIcon[\s\S]*margin:\s*0/.test(read('src/styles/index.css')), 'Button icon margins are normalized for RTL.');
assert(!/max-width:\s*\.01px/.test(read('src/styles/index.css')), 'Native MUI notch width animation is not overridden by global CSS.');

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
const arKeys = flattenKeys(ar).sort();
const enKeys = flattenKeys(en).sort();
assert(JSON.stringify(arKeys) === JSON.stringify(enKeys), 'Arabic and future English JSON files have matching key structure.');

const pageNames = fs.readdirSync(path.join(src, 'pages')).filter((name) => name.endsWith('.jsx'));
assert(pageNames.length === requiredPages.length, 'Frontend contains only the expected page modules.');
assert(!/MongoDB|Mongoose/.test(combinedSource), 'Frontend contains no MongoDB/Mongoose assumptions.');
assert(/localStorage\.getItem\(['"]a4_color_mode['"]\)/.test(theme), 'Light/dark preference is persisted.');
assert(/@media \(max-width: 900px\)/.test(read('src/styles/layout.css')), 'Responsive sidebar/mobile drawer rules exist.');
assert(/@media print/.test(combinedSource), 'Printer-safe styles exist.');

console.log(`UI validation: ${passes.length} passed, ${failures.length} failed.`);
for (const item of passes) console.log(`✔ ${item}`);
for (const item of failures) console.error(`✘ ${item}`);
if (failures.length) process.exit(1);
