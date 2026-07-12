import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = path.resolve(process.cwd());
const src = path.join(root, "src");
const failures = [];
const passes = [];

function assert(condition, message) {
  if (condition) passes.push(message);
  else failures.push(message);
}

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
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

function flattenKeys(value, prefix = "") {
  return Object.entries(value).flatMap(([key, child]) => {
    const next = prefix ? `${prefix}.${key}` : key;
    return child && typeof child === "object" && !Array.isArray(child)
      ? flattenKeys(child, next)
      : [next];
  });
}

function count(source, pattern) {
  return source.match(pattern)?.length || 0;
}

function importResolves(importer, specifier) {
  const base = path.resolve(path.dirname(importer), specifier);
  return [
    base,
    `${base}.js`,
    `${base}.jsx`,
    `${base}.css`,
    path.join(base, "index.js"),
    path.join(base, "index.jsx"),
  ].some((candidate) => fs.existsSync(candidate));
}

const requiredPages = [
  "Login",
  "Dashboard",
  "POS",
  "Products",
  "Categories",
  "PriceTiers",
  "Inventory",
  "Preorders",
  "Customers",
  "Payments",
  "ShiftSummary",
  "Shifts",
  "Users",
  "Reports",
  "Receipts",
  "Invoices",
  "ReceiptPrint",
  "AuditLogs",
  "PrinterSettings",
];

const visualComponents = [
  "AppSnackbar",
  "Breadcrumbs",
  "ConfirmDialog",
  "DataTable",
  "EmptyState",
  "EntityDrawer",
  "ErrorBoundary",
  "FilterPanel",
  "LoadingState",
  "MetricCard",
  "PageHeader",
  "StatusChip",
];

const formComponents = ["Field", "FieldGrid", "FormActions", "FormSection"];
const sourceFiles = filesUnder(src).filter((file) =>
  /\.(jsx?|css)$/.test(file),
);
const jsxFiles = sourceFiles.filter((file) => /\.jsx?$/.test(file));
const cssFiles = sourceFiles.filter((file) => /\.css$/.test(file));
const pageFiles = requiredPages.map((page) =>
  path.join(src, "pages", `${page}.jsx`),
);
const combinedSource = sourceFiles
  .map((file) => fs.readFileSync(file, "utf8"))
  .join("\n");
const combinedCss = cssFiles
  .map((file) => fs.readFileSync(file, "utf8"))
  .join("\n");
const combinedPages = pageFiles
  .map((file) => fs.readFileSync(file, "utf8"))
  .join("\n");

const html = read("index.html");
const main = read("src/main.jsx");
const app = read("src/App.jsx");
const theme = read("src/theme/ThemeConfig.jsx");
const themeCss = read("src/theme/ThemeConfig.css");
const variables = read("src/styles/variables.css");
const indexCss = read("src/styles/index.css");
const forms = read("src/styles/forms.css");
const rtl = read("src/styles/rtl.css");
const tables = read("src/styles/tables.css");
const drawers = read("src/styles/drawers.css");
const dialogs = read("src/styles/dialogs.css");
const mainLayout = read("src/layouts/MainLayout.jsx");
const mainLayoutCss = read("src/styles/MainLayout.css");
const login = read("src/pages/Login.jsx");
const fieldComponent = read("src/components/forms/Field.jsx");
const dataTable = read("src/components/DataTable.jsx");
const dataTableCss = read("src/components/DataTable.css");
const entityDrawer = read("src/components/EntityDrawer.jsx");
const confirmDialog = read("src/components/ConfirmDialog.jsx");
const service = read("src/services/apiClient.js");
const config = read("src/config/appConfig.js");
const translator = read("src/locales/t.js");

assert(
  /<html\s+lang="ar"\s+dir="rtl">/.test(html),
  "index.html is fixed to Arabic RTL.",
);
assert(
  /document\.documentElement\.dir\s*=\s*['"]rtl['"]/.test(theme),
  "Runtime document direction is forced to RTL.",
);
assert(
  /direction:\s*['"]rtl['"]/.test(theme),
  "Material UI theme direction is RTL.",
);
assert(
  /stylisPlugins:\s*\[prefixer,\s*rtlPlugin\]/.test(theme),
  "Emotion cache uses prefixer then rtlPlugin.",
);
assert(
  /StyledEngineProvider[\s\S]*injectFirst/.test(main),
  "StyledEngineProvider injectFirst wraps the application once at bootstrap.",
);
assert(
  !/StyledEngineProvider/.test(theme),
  "ThemeConfig does not duplicate StyledEngineProvider.",
);
assert(
  /className="theme-root"/.test(theme) && /\.theme-root/.test(themeCss),
  "Theme root is explicit and styled.",
);

const expectedGlobalOrder = [
  "./variables.css",
  "./reset.css",
  "./rtl.css",
  "./layout.css",
  "./forms.css",
  "./tables.css",
  "./drawers.css",
  "./dialogs.css",
  "./material-overrides.css",
];
let previousImportIndex = -1;
for (const stylesheet of expectedGlobalOrder) {
  const importIndex = indexCss.indexOf(stylesheet);
  assert(
    importIndex > previousImportIndex,
    `Global CSS import order includes ${stylesheet}.`,
  );
  previousImportIndex = importIndex;
}

assert(
  exists("src/theme/ThemeConfig.jsx") && !exists("src/theme/AppTheme.jsx"),
  "ThemeConfig replaces the old AppTheme module.",
);
assert(
  exists("src/services/apiClient.js") && !exists("src/api/client.js"),
  "API client lives under services only.",
);
assert(
  exists("src/config/appConfig.js"),
  "A4 application configuration is centralized.",
);
assert(
  !exists("src/styles/components.css"),
  "The former aggregate components stylesheet is removed.",
);

for (const component of visualComponents) {
  assert(
    exists(`src/components/${component}.jsx`),
    `Shared component exists: ${component}.jsx.`,
  );
  assert(
    exists(`src/components/${component}.css`),
    `Shared component stylesheet exists: ${component}.css.`,
  );
  const componentSource = read(`src/components/${component}.jsx`);
  assert(
    new RegExp(`['"]\\./${component}\\.css['"]`).test(componentSource),
    `${component} imports its CSS sibling.`,
  );
}

for (const component of formComponents) {
  assert(
    exists(`src/components/forms/${component}.jsx`),
    `Form component exists: ${component}.jsx.`,
  );
  assert(
    exists(`src/components/forms/${component}.css`),
    `Form component stylesheet exists: ${component}.css.`,
  );
}

const obsoleteComponentFiles = [
  "src/components/data/DataTable.jsx",
  "src/components/data/MetricCard.jsx",
  "src/components/data/StatusChip.jsx",
  "src/components/feedback/AppSnackbar.jsx",
  "src/components/feedback/ConfirmDialog.jsx",
  "src/components/feedback/EmptyState.jsx",
  "src/components/feedback/ErrorBoundary.jsx",
  "src/components/feedback/LoadingState.jsx",
  "src/components/forms/EntityDrawer.jsx",
  "src/components/forms/FilterPanel.jsx",
  "src/components/navigation/PageHeader.jsx",
];
for (const oldPath of obsoleteComponentFiles) {
  assert(!exists(oldPath), `Obsolete component path is absent: ${oldPath}.`);
}

for (const page of requiredPages) {
  const relativePage = `src/pages/${page}.jsx`;
  assert(exists(relativePage), `Page exists: ${page}.`);
  const pageSource = read(relativePage);
  const expectedCss =
    page === "POS" ? "../styles/POSPage.css" : `../styles/${page}.css`;
  assert(
    pageSource.includes(expectedCss),
    `${page} imports its page stylesheet.`,
  );
  assert(
    new RegExp(`pages/${page}\\.jsx`).test(app),
    `Page is lazy-routed: ${page}.`,
  );
  assert(
    count(pageSource, /<Field\b/g) >= count(pageSource, /<TextField\b/g),
    `${page} routes every TextField through Field.`,
  );
}

assert(
  !/\bsx\s*=/.test(combinedPages),
  "Page presentation does not use fixed sx props.",
);
assert(
  !/\bstyle\s*=/.test(combinedPages),
  "Page presentation does not use inline style props.",
);
assert(
  !/\b(?:InputProps|InputLabelProps|inputProps|PaperProps)\s*=/.test(
    combinedSource,
  ),
  "Deprecated MUI props are absent.",
);
assert(
  !/:has\(/.test(combinedCss),
  "CSS avoids fragile :has-based label logic.",
);
assert(
  !/translate\([^)]*-9px[^)]*\)\s*scale/.test(combinedCss),
  "No manual floating-label transform exists.",
);
assert(
  !/0\s+0\s+0\s+3px/.test(theme + forms),
  "Outlined fields do not use the removed outer focus halo.",
);

assert(
  /cloneElement\(children/.test(fieldComponent),
  "Field injects native TextField props.",
);
assert(
  /ALWAYS_SHRINK_TYPES/.test(fieldComponent),
  "Date and time fields force safe label shrink.",
);
assert(
  /slotProps:\s*\{[\s\S]*inputLabel/.test(fieldComponent),
  "Field uses MUI 9 slotProps.",
);
assert(
  /MUI exclusively owns the legend max-width/.test(forms),
  "Native MUI owns the animated fieldset legend width.",
);
assert(
  !/MuiOutlinedInput-notchedOutline legend[^}]*max-width/s.test(combinedCss),
  "CSS does not force the native notch legend open.",
);
assert(
  /placeholder:\s*effectiveLabel\s*\?\s*undefined/.test(fieldComponent),
  "Labelled fields suppress duplicate placeholder copy.",
);
assert(
  /transition:[^;]*transform\s+180ms/s.test(forms),
  "The inline label animates smoothly into its native notch.",
);
assert(
  /MuiOutlinedInput-notchedOutline[\s\S]*text-align:\s*right/.test(rtl),
  "Outlined notch aligns to the RTL start edge.",
);
assert(
  !/startAdornment/.test(login),
  "Login adornments do not force empty labels into a permanent notch.",
);
assert(
  !/\bautoFocus\b/.test(login),
  "Login fields render their closed-border idle state before focus.",
);
assert(
  count(login, /<Field\b[^>]*\bltr\b/g) === 2,
  "Login technical values are LTR while their labels remain RTL.",
);
assert(
  /MuiSelect-select\.MuiInputBase-input[\s\S]*justify-content:\s*flex-start/.test(
    rtl,
  ),
  "RTL selects align their values to the logical start edge.",
);
assert(
  /\.MuiSelect-icon[\s\S]*inset-inline-end:\s*7px/.test(rtl),
  "RTL select icons stay on the logical end edge.",
);
assert(
  /--control-height:\s*40px/.test(variables) &&
    /--control-height-comfortable:\s*56px/.test(variables),
  "Field height tokens are 40px and 56px.",
);
assert(
  /--control-height-mobile:\s*44px/.test(variables),
  "Mobile field height token is 44px.",
);
assert(
  /prefers-reduced-motion:\s*reduce/.test(forms),
  "Field animation respects reduced motion.",
);

assert(
  count(theme, /MuiOutlinedInput:/g) === 1,
  "Theme has exactly one MuiOutlinedInput override.",
);
assert(
  count(theme, /MuiDialog:/g) === 1,
  "Theme has exactly one MuiDialog override.",
);
assert(/MuiButton:[\s\S]*gap:\s*8/.test(theme), "Button icon/text gap is 8px.");
assert(
  /MuiButton-startIcon,[\s\S]*MuiButton-endIcon[\s\S]*margin:\s*0/.test(forms),
  "Button icon margins are normalized in RTL.",
);
assert(
  /borderRadius:\s*['"]50%['"]/.test(theme),
  "Icon buttons remain circular.",
);

assert(
  /#0f5fa6/i.test(variables) && /#0f5fa6/i.test(theme),
  "A4 light primary color is preserved in CSS and MUI.",
);
assert(
  /#8ab4f8/i.test(variables) && /#8ab4f8/i.test(theme),
  "A4 dark primary color is preserved in CSS and MUI.",
);
assert(
  !/#1a73e8/i.test(combinedSource),
  "Template blue is not imported into the A4 client.",
);
assert(
  !/CodzHub|hamza\.printing/i.test(combinedSource),
  "Template branding is absent from the A4 client.",
);

const declaredVariables = new Set(
  [...combinedCss.matchAll(/(--[a-zA-Z0-9_-]+)\s*:/g)].map((match) => match[1]),
);
const usedVariables = new Set(
  [...combinedCss.matchAll(/var\(\s*(--[a-zA-Z0-9_-]+)/g)].map(
    (match) => match[1],
  ),
);
const undefinedVariables = [...usedVariables].filter(
  (variable) => !declaredVariables.has(variable),
);
assert(
  undefinedVariables.length === 0,
  `Every CSS variable is defined${undefinedVariables.length ? `; missing: ${undefinedVariables.join(", ")}` : ""}.`,
);

assert(
  /--sidebar-width:\s*270px/.test(variables),
  "Expanded sidebar width is 270px.",
);
assert(
  /--sidebar-collapsed-width:\s*72px/.test(variables),
  "Collapsed sidebar width is 72px.",
);
assert(/--topbar-height:\s*64px/.test(variables), "Topbar height is 64px.");
assert(
  /--content-max-width:\s*1440px/.test(variables),
  "Content maximum width is 1440px.",
);
assert(
  /<AppBar\b/.test(mainLayout) && count(mainLayout, /<Drawer\b/g) === 2,
  "MainLayout uses AppBar plus mobile and desktop Drawers.",
);
assert(
  /<Breadcrumbs\s*\/>/.test(mainLayout),
  "Breadcrumbs render once in MainLayout.",
);
assert(
  /APP_CONFIG\.storageKeys\.sidebarCollapsed/.test(mainLayout),
  "Sidebar collapse preference uses appConfig.",
);
assert(
  /@media \(max-width:\s*899px\)/.test(mainLayoutCss) ||
    /@media \(max-width:\s*900px\)/.test(mainLayoutCss),
  "Shell switches to mobile at 900px.",
);

assert(
  /mobile-record-list/.test(dataTable) &&
    /@media \(max-width:\s*720px\)/.test(dataTableCss),
  "DataTable preserves mobile record cards below 720px.",
);
assert(
  /overflow-x:\s*auto/.test(tables + dataTableCss),
  "Desktop tables remain horizontally safe.",
);
assert(
  !/mobile-record|desktop-table|data-table-empty/.test(tables),
  "DataTable responsive selectors are owned by its sibling stylesheet.",
);
assert(
  !/entity-drawer__|entity-drawer\s/.test(drawers),
  "EntityDrawer selectors are owned by its sibling stylesheet.",
);
assert(
  !/confirm-dialog/.test(dialogs),
  "ConfirmDialog selectors are owned by its sibling stylesheet.",
);
assert(
  !/(?:^|\n)\.field(?:[\s_.:#>]|$)/.test(forms),
  "Field component selectors are owned by its sibling stylesheet.",
);
assert(
  !/a4-form-grid/.test(combinedSource),
  "Page forms use FieldGrid instead of the legacy grid class.",
);
assert(
  /--entity-drawer-width:\s*820px/.test(variables) &&
    /--entity-drawer-wide-width:\s*920px/.test(variables),
  "Drawer widths are 820px and 920px.",
);
assert(
  /anchor="left"/.test(entityDrawer),
  "RTL drawer uses the MUI anchor that lands on the physical right.",
);
assert(
  /--confirm-dialog-max-width:\s*480px/.test(variables) &&
    /confirm-dialog/.test(confirmDialog),
  "ConfirmDialog is capped at 480px.",
);

assert(
  /export\s+const\s+api/.test(service),
  "Relocated service retains the named api export.",
);
assert(
  /Authorization.*Bearer|Bearer.*Authorization/s.test(service),
  "API service retains Bearer authorization.",
);
assert(
  !/credentials:\s*['"]include['"]/.test(service),
  "API service does not switch to template cookie sessions.",
);
assert(
  /a4_color_mode/.test(config) &&
    /APP_CONFIG\.storageKeys\.colorMode/.test(theme),
  "Light/dark preference keeps the a4_color_mode key.",
);
assert(
  /a4_access_token/.test(config) &&
    /APP_CONFIG\.storageKeys\.accessToken/.test(service),
  "API access token contract remains centralized and unchanged.",
);

const requiredRoutes = [
  "/",
  "/login",
  "/pos",
  "/shift-summary",
  "/receipts",
  "/invoices",
  "/receipts/:receiptId/print",
  "/products",
  "/categories",
  "/price-tiers",
  "/inventory",
  "/preorders",
  "/customers",
  "/payments",
  "/shifts",
  "/users",
  "/reports",
  "/logs",
  "/printer-settings",
];
for (const route of requiredRoutes) {
  const routePattern =
    route === "/"
      ? /<Route\s+path="\/"/
      : new RegExp(
          `(?:path="${route.slice(1)}"|path="${route.replaceAll("/", "\\/")}")`,
        );
  assert(routePattern.test(app), `Route remains present: ${route}.`);
}
assert(
  /function AdminOnly/.test(app) &&
    /function Protected/.test(app) &&
    /function GuestOnly/.test(app),
  "Auth and role guards remain intact.",
);

const ar = JSON.parse(read("src/locales/ar.json"));
const en = JSON.parse(read("src/locales/en.json"));
assert(
  JSON.stringify(flattenKeys(ar).sort()) ===
    JSON.stringify(flattenKeys(en).sort()),
  "Arabic and future English dictionaries keep matching keys.",
);
assert(
  /from\s+['"]\.\/ar\.json['"]/.test(translator),
  "Runtime translator reads Arabic only.",
);
assert(
  !/from\s+['"]\.\/en\.json['"]/.test(translator),
  "English dictionary is not loaded at runtime.",
);
assert(
  !/setLocale|toggleLanguage|languageSwitch|changeLanguage/i.test(
    combinedSource,
  ),
  "No runtime language switch exists.",
);
assert(
  !/MongoDB|Mongoose/.test(combinedSource),
  "Frontend contains no database-layer assumptions.",
);

assert(
  /@media print/.test(read("src/styles/Receipts.css")),
  "Receipts keep dedicated print rules.",
);
assert(
  /80mm/.test(read("src/styles/Receipts.css")),
  "Thermal receipt output remains 80mm.",
);
assert(
  /@media \(max-width:\s*980px\)/.test(read("src/styles/POSPage.css")) &&
    /@media \(max-width:\s*420px\)/.test(read("src/styles/POSPage.css")),
  "POS responsive breakpoints remain intact.",
);

for (const importer of jsxFiles) {
  const source = fs.readFileSync(importer, "utf8");
  const specs = [
    ...source.matchAll(/(?:from\s+|import\s+)(['"])(\.[^'"]+)\1/g),
    ...source.matchAll(/import\s*\(\s*(['"])(\.[^'"]+)\1\s*\)/g),
  ].map((match) => match[2]);
  for (const specifier of specs) {
    const relativeImporter = path.relative(src, importer).replaceAll("\\", "/");
    assert(
      importResolves(importer, specifier),
      `Relative import resolves: ${relativeImporter} -> ${specifier}.`,
    );
  }
}

console.log(
  `UI validation: ${passes.length} passed, ${failures.length} failed.`,
);
for (const item of passes) console.log(`✔ ${item}`);
for (const item of failures) console.error(`✘ ${item}`);
if (failures.length) process.exit(1);
