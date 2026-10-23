import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = path.join(root, 'scripts', 'output');
const statePath = path.join(outputDir, 'servicios-state.json');
const catalogPath = path.join(root, 'frontend', 'src', 'data', 'servicios-publicos.json');
const logoDir = path.join(root, 'frontend', 'public', 'convenios', 'servicios', 'logos');
const helpDir = path.join(root, 'frontend', 'public', 'convenios', 'servicios', 'ayuda');

const listUrl =
  'https://www.avalpaycenter.com/wps/portal/portal-de-pagos/web/pagos-aval/que-puedo-pagar?isCategory=false&idCategory=19';
const payUrl = (id) =>
  `https://www.avalpaycenter.com/wps/portal/portal-de-pagos/web/pagos-aval/resultado-busqueda/realizar-pago-facturadores?idConv=${id}`;

const departments = [
  'Amazonas',
  'Antioquia',
  'Arauca',
  'Atlántico',
  'Bogotá',
  'Bolívar',
  'Boyacá',
  'Caldas',
  'Caquetá',
  'Casanare',
  'Cauca',
  'Cesar',
  'Choco',
  'Córdoba',
  'Cundinamarca',
  'Guainía',
  'Guaviare',
  'Huila',
  'La guajira',
  'Magdalena',
  'Meta',
  'Nariño',
  'Norte de Santander',
  'Putumayo',
  'Quindío',
  'Risaralda',
  'San Andres, providencia y Santa catalina',
  'Santander',
  'Sucre',
  'Tolima',
  'Valle del Cauca',
  'Vaupés',
  'Vichada',
];

const limitArg = process.argv.find((arg) => arg.startsWith('--limit='));
const limit = limitArg ? Number(limitArg.split('=')[1]) : 0;

function readState() {
  if (!fs.existsSync(statePath)) {
    return { catalogComplete: false, catalog: [], forms: {}, errors: [] };
  }
  return JSON.parse(fs.readFileSync(statePath, 'utf8'));
}

function writeState(state) {
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
}

function publish(state) {
  const records = state.catalog
    .map((item) => state.forms[item.id])
    .filter(Boolean);
  fs.writeFileSync(catalogPath, `${JSON.stringify(records, null, 2)}\n`);
}

function slug(label) {
  return label
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
}

function assignIds(fields) {
  const used = new Set();
  return fields.map((field, index) => {
    let id = field.kind === 'amount' ? 'amount' : slug(field.label) || `campo-${index + 1}`;
    let unique = id;
    let count = 2;
    while (used.has(unique)) unique = `${id}-${count++}`;
    used.add(unique);
    return { ...field, id: unique };
  });
}

function matchDepartment(location) {
  const normalized = location.replace(/Bogotá\s+D\.C\./gi, 'Bogotá');
  const parts = normalized.split('-').map((part) => part.trim()).filter(Boolean);
  for (const part of parts.reverse()) {
    const found = departments.find((item) => item.toLowerCase() === part.toLowerCase());
    if (found) return found;
  }
  return '';
}

async function downloadImage(url, directory, name) {
  if (!url) return '';
  const response = await fetch(url);
  if (!response.ok) return '';
  const bytes = Buffer.from(await response.arrayBuffer());
  const isPng = bytes[0] === 0x89 && bytes[1] === 0x50;
  const isJpg = bytes[0] === 0xff && bytes[1] === 0xd8;
  if (!isPng && !isJpg) return '';
  const extension = isPng ? 'png' : 'jpg';
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, `${name}.${extension}`), bytes);
  const publicDir = directory.endsWith('logos') ? 'logos' : 'ayuda';
  return `/convenios/servicios/${publicDir}/${name}.${extension}`;
}

function extractForm() {
  const name = document.querySelector('.name_convenio')?.textContent?.trim() || '';
  const locationLabel = [...document.querySelectorAll('strong')].find((element) =>
    element.textContent.trim().startsWith('Ubicación'),
  );
  const location = locationLabel?.parentElement?.textContent?.replace(/Ubicación:\s*/i, '').trim() || '';
  const images = [...document.querySelectorAll('img')].map((image) => image.src);
  const helpImage = images.find((src) => src.includes('/referencia/')) || '';
  const logo = images.find((src) => /\/convenios\/logo\//.test(src)) || '';
  const methods = [];
  if (images.some((src) => src.includes('logo-aval.svg'))) methods.push('aval');
  if (images.some((src) => src.includes('logo-pse.svg'))) methods.push('pse');
  const plainMethods = !document.querySelector('.container-other');
  const methodsLead =
    [...document.querySelectorAll('p, .description')]
      .map((element) => element.textContent.trim())
      .find((text) => /medios/i.test(text)) || '';
  const buttons = [...document.querySelectorAll('button')].map((button) => button.textContent.trim());
  const body = document.body.innerText;
  const controls = [
    ...document.querySelectorAll('.selectropdown-form input, input.input-text, iframe'),
  ];
  const fields = controls.map((control) => {
    if (control.tagName === 'IFRAME') {
      const title = control.closest('div')?.parentElement?.querySelector('.input-title')?.textContent?.trim();
      let label = title || '';
      if (!label) {
        try {
          label = new URL(control.src).searchParams.get('placeholder') || '';
        } catch {
          label = '';
        }
      }
      return { kind: 'card', label: label || 'Número de tarjeta *', maxLength: 19 };
    }

    const select = control.closest('.selectropdown-form');
    if (select) {
      return { kind: 'select', label: control.value || control.placeholder || 'Selecciona', options: [] };
    }

    const container = control.closest('.input-form') || control.parentElement;
    const label = container?.querySelector('.input-title')?.textContent?.trim() || control.id || '';
    const maxLength = control.maxLength > 0 ? control.maxLength : undefined;
    if (/valor/i.test(label) && /pagar/i.test(label)) {
      return { kind: 'amount', label, maxLength };
    }
    const numeric = control.inputMode === 'numeric' || (control.pattern || '').includes('D');
    return { kind: 'text', label, maxLength, numeric };
  });

  return {
    name,
    location,
    helpImage,
    logo,
    methods,
    plainMethods,
    methodsLead,
    submitLabel: buttons.find((text) => text === 'Continuar' || text === 'Pagar') || 'Continuar',
    secondaryLabel: buttons.includes('Agiliza tu pago') ? 'Agiliza tu pago' : '',
    showDetail: body.includes('Agregar detalle del pago'),
    showTerms: /\bAcepto\b/.test(body),
    showLogin: body.includes('Agiliza tu pago si ya'),
    fields,
  };
}

async function dismissCookies(page) {
  const button = page.locator('button', { hasText: 'Aceptar' }).first();
  if (await button.isVisible().catch(() => false)) await button.click();
}

async function dismissSecurity(page) {
  const visible = await page.getByRole('heading', { name: 'Protege tu información.' }).isVisible().catch(() => false);
  if (!visible) return;
  await page.getByRole('button', { name: 'Continuar' }).click({ timeout: 4000 }).catch(() => {});
  await page.waitForTimeout(400);
}

async function openBySearch(page, id) {
  if (!page.url().includes('idCategory=19')) {
    await openListing(page);
    await dismissSecurity(page);
  }
  const search = page.getByRole('searchbox').first();
  await search.fill(id, { timeout: 8000 });
  await page.getByRole('button', { name: 'Buscar' }).first().click({ timeout: 8000 });
  await page.waitForFunction(
    () => {
      const text = document.body.innerText;
      return text.includes('de 1 resultados') || text.includes('0 de 0');
    },
    { timeout: 15000 },
  );
  const cards = await page.locator('apc-card-agreements').count();
  if (!cards) throw new Error('sin resultados en el listado');
  await page.evaluate(() => {
    const button = [...document.querySelectorAll('apc-card-agreements button')].find((item) => item.textContent.trim() === 'Pagar');
    button?.click();
  });
  await page.waitForSelector('.name_convenio', { timeout: 20000 });
}

async function readCards(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll('apc-card-agreements')].map((card, index) => {
      const image = card.querySelector('img');
      const source = image?.src || '';
      const match = source.match(/\/logo\/([^./]+)\./);
      const labels = [...card.querySelectorAll('button')].map((button) => button.textContent.trim());
      return {
        index,
        name: card.querySelector('h4')?.textContent?.trim() || '',
        id: match ? match[1] : '',
        logoUrl: match ? source : '',
        acceptsEnrollment: labels.includes('Inscribir'),
      };
    }),
  );
}

async function clickNext(page) {
  const next = page.locator('apc-pagination button').filter({ hasText: '❯' }).last();
  if (!(await next.count())) return 'disabled';
  const disabled = await next.evaluate((button) => button.disabled || button.getAttribute('aria-disabled') === 'true' || button.classList.contains('disabled'));
  if (disabled) return 'disabled';
  const before = (await page.locator('apc-card-agreements h4').first().innerText()).trim();
  await next.click();
  try {
    await page.waitForFunction((previous) => {
      const heading = document.querySelector('apc-card-agreements h4');
      return heading && heading.textContent.trim() !== previous;
    }, before, { timeout: 15000 });
    return 'moved';
  } catch {
    return 'stuck';
  }
}

async function openListing(page) {
  await page.goto(listUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForSelector('apc-card-agreements', { timeout: 30000 });
  await dismissCookies(page);
}

async function restoreListing(page, pageNumber, firstName) {
  await page.goBack({ waitUntil: 'domcontentloaded' }).catch(() => {});
  const ready = await page
    .waitForSelector('apc-card-agreements h4', { timeout: 8000 })
    .then(async () => (await page.locator('apc-card-agreements h4').first().innerText()).trim() === firstName)
    .catch(() => false);
  if (ready) return;

  await openListing(page);
  for (let step = 1; step < pageNumber; step += 1) {
    const moved = await clickNext(page);
    if (moved !== 'moved') break;
  }
}

async function readSelectOptions(page, fields) {
  const selects = page.locator('.selectropdown-form input');
  let index = 0;
  for (const field of fields) {
    if (field.kind !== 'select') continue;
    const input = selects.nth(index);
    index += 1;
    try {
      await input.click({ timeout: 4000 });
      await page.waitForSelector('.options-background', { timeout: 4000 });
      const text = await page.locator('.options-background').innerText();
      field.options = text
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line && line !== 'Selecciona');
      await page.keyboard.press('Escape');
    } catch {
      field.options = [];
    }
  }
}

async function collectCatalog(page, state) {
  if (state.catalogComplete && state.catalog.length >= 260) return state.catalog;
  console.log('Recorriendo el listado de Servicios públicos...');
  await openListing(page);
  const catalog = limit ? [] : [...(state.catalog || [])];
  const seen = new Set(catalog.map((item) => item.id));
  const pagesDone = limit ? 0 : Math.floor(catalog.length / 10);
  for (let step = 0; step < pagesDone; step += 1) {
    const moved = await clickNext(page);
    if (moved !== 'moved') break;
  }
  let pageNumber = pagesDone + 1;

  while (pageNumber < 40) {
    const cards = await readCards(page);
    const firstName = cards[0]?.name || '';
    for (const card of cards) {
      if (!card.id) {
        try {
          const cardLocator = page.locator('apc-card-agreements').nth(card.index);
          await cardLocator.hover({ timeout: 8000 });
          await cardLocator.locator('button', { hasText: 'Pagar' }).click({ force: true, timeout: 8000 });
          await page.waitForURL(/idConv=/, { timeout: 20000 });
          card.id = new URL(page.url()).searchParams.get('idConv') || '';
          await restoreListing(page, pageNumber, firstName);
        } catch (error) {
          console.log(`Sin código en ${card.name || card.index}: ${String(error.message || error).split('\n')[0]}`);
          if (!page.url().includes('idCategory=19')) await restoreListing(page, pageNumber, firstName).catch(() => {});
        }
      }
      if (card.id && !seen.has(card.id)) {
        seen.add(card.id);
        catalog.push(card);
      }
      if (limit && catalog.length >= limit) break;
    }
    console.log(`Página ${pageNumber}: ${catalog.length} convenios`);
    state.catalog = catalog;
    writeState(state);
    if (limit && catalog.length >= limit) break;
    const moved = await clickNext(page);
    if (moved === 'disabled') {
      state.catalogComplete = !limit;
      break;
    }
    if (moved !== 'moved') {
      console.log(`El listado se detuvo en la página ${pageNumber}.`);
      state.catalogComplete = false;
      break;
    }
    pageNumber += 1;
  }

  state.catalog = catalog;
  writeState(state);
  return catalog;
}

async function scrapeOne(page, card) {
  await openBySearch(page, card.id);
  await page.waitForTimeout(700);
  const form = await page.evaluate(extractForm);
  await readSelectOptions(page, form.fields);
  const logoSource = form.logo || card.logoUrl;
  const logo = await downloadImage(logoSource, logoDir, card.id);
  const helpImage = await downloadImage(form.helpImage, helpDir, card.id);

  return {
    id: card.id,
    name: form.name || card.name,
    department: matchDepartment(form.location),
    location: form.location,
    acceptsEnrollment: card.acceptsEnrollment,
    logo,
    helpImage,
    plainMethods: form.plainMethods,
    methodsLead: form.methodsLead,
    submitLabel: form.submitLabel,
    secondaryLabel: form.secondaryLabel,
    showDetail: form.showDetail,
    showTerms: form.showTerms,
    showLogin: form.showLogin,
    methods: form.methods,
    fields: assignIds(form.fields.filter((field) => field.label)),
  };
}

async function launchBrowser() {
  for (const channel of ['chrome', 'msedge']) {
    try {
      return await chromium.launch({ channel, headless: true });
    } catch {
      console.log(`No se pudo abrir ${channel}.`);
    }
  }
  return chromium.launch({ headless: true });
}

const state = readState();
const browser = await launchBrowser();
const page = await browser.newPage();

try {
  const catalog = await collectCatalog(page, state);
  const pending = catalog.filter((card) => card.id && !state.forms[card.id]);
  const queue = limit ? pending.slice(0, limit) : pending;
  console.log(`Formularios por leer: ${queue.length}`);

  state.errors = [];
  for (const card of queue) {
    let saved = false;
    for (let attempt = 1; attempt <= 3 && !saved; attempt += 1) {
      try {
        const record = await scrapeOne(page, card);
        state.forms[card.id] = record;
        writeState(state);
        publish(state);
        console.log(`${Object.keys(state.forms).length}/${catalog.length} ${record.name}`);
        saved = true;
        await page.waitForTimeout(600);
      } catch (error) {
        if (attempt === 3) {
          state.errors.push({ id: card.id, name: card.name, message: String(error).slice(0, 300) });
          writeState(state);
          console.log(`Error en ${card.name}: ${error.message || error}`);
        } else {
          await page.waitForTimeout(2000);
        }
      }
    }
  }
} finally {
  await browser.close();
}
