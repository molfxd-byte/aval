import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = path.join(root, 'scripts', 'output');

function arg(name, fallback) {
  const found = process.argv.find((item) => item.startsWith(`--${name}=`));
  return found ? found.slice(name.length + 3) : fallback;
}

const slug = arg('slug', 'conjuntos-residenciales');
const category = arg('category', '6');
const payPath = arg('pay', 'realizar-pago');
const minCount = Number(arg('min', '12000'));
const workers = Number(arg('workers', '3'));

const statePath = path.join(outputDir, `${slug}-state.json`);
const catalogPath = path.join(root, 'frontend', 'src', 'data', `${slug}.json`);
const logoDir = path.join(root, 'frontend', 'public', 'convenios', slug, 'logos');
const helpDir = path.join(root, 'frontend', 'public', 'convenios', slug, 'ayuda');

const listUrl =
  `https://www.avalpaycenter.com/wps/portal/portal-de-pagos/web/pagos-aval/que-puedo-pagar?isCategory=false&idCategory=${category}`;
const payUrl = (id) =>
  `https://www.avalpaycenter.com/wps/portal/portal-de-pagos/web/pagos-aval/resultado-busqueda/${payPath}?idConv=${id}`;

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

function fieldSlug(label) {
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
    let id = field.kind === 'amount' ? 'amount' : fieldSlug(field.label) || `campo-${index + 1}`;
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
  return `/convenios/${slug}/${publicDir}/${name}.${extension}`;
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
  await page.evaluate(() => {
    const heading = [...document.querySelectorAll('h1, h2, h3')].find((element) => element.textContent.includes('Protege tu información'));
    if (!heading) return;
    const button = [...document.querySelectorAll('button')].find((element) => element.textContent.trim() === 'Continuar');
    button?.click();
  }).catch(() => {});
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

async function announcedTotal(page) {
  const text = await withTimeout(page.evaluate(() => document.body.innerText), 5000).catch(() => '');
  const match = String(text).match(/de\s+([\d.]+)\s+resultados/i);
  return match ? Number(match[1].replace(/\./g, '')) : 0;
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ]);
}

async function pageSnapshot(page) {
  return withTimeout(
    page.evaluate(() => ({
      heading: document.querySelector('apc-card-agreements h4')?.textContent?.trim() || '',
      active: document.querySelector('apc-pagination button.page-number.active')?.textContent?.trim() || '',
    })),
    4000,
  );
}

async function clickNext(page) {
  let before;
  try {
    before = await pageSnapshot(page);
  } catch {
    return 'missing';
  }
  let clicked;
  try {
    clicked = await withTimeout(
      page.evaluate(() => {
        const next = document.querySelector('apc-pagination button.page-control.next');
        if (!next) return 'missing';
        if (next.disabled || next.getAttribute('aria-disabled') === 'true' || next.classList.contains('disabled')) return 'disabled';
        next.click();
        return 'clicked';
      }),
      4000,
    );
  } catch {
    return 'stuck';
  }
  if (clicked !== 'clicked') return clicked;
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 300));
    try {
      const now = await pageSnapshot(page);
      if ((now.heading && now.heading !== before.heading) || (now.active && now.active !== before.active)) return 'moved';
    } catch {
      // La página sigue actualizando el listado.
    }
  }
  return 'stuck';
}

async function openListing(page) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await page.goto(listUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await dismissCookies(page);
      await dismissSecurity(page);
      await page.waitForSelector('apc-card-agreements', { timeout: 40000 });
      await dismissCookies(page);
      await dismissSecurity(page);
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  }
  throw lastError;
}

async function restoreListing(page, pageNumber, firstName) {
  await withTimeout(page.goBack({ waitUntil: 'domcontentloaded', timeout: 8000 }), 10000).catch(() => {});
  let heading = '';
  try {
    heading = (await pageSnapshot(page)).heading;
  } catch {
    heading = '';
  }
  if (heading && heading === firstName && page.url().includes(`idCategory=${category}`)) return;

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

async function listingReady(page) {
  return page.evaluate((categoryId) => {
    const input = Boolean(document.querySelector('#search-input'));
    return input && location.href.includes(`idCategory=${categoryId}`) && document.querySelector('apc-card-agreements');
  }, category).catch(() => false);
}

async function ensureListing(page) {
  if (await listingReady(page)) {
    await dismissSecurity(page);
    return;
  }
  await openListing(page);
  await dismissSecurity(page);
}

function searchQuery(name) {
  const trimmed = name.slice(0, 80);
  if (trimmed.includes(' ')) return trimmed;
  return trimmed.replace(/(\D)(\d)/, '$1 $2');
}

async function readIdFromNamedCard(page, name) {
  const captured = await withTimeout(
    page.evaluate((expected) => new Promise((resolve) => {
      const normalize = (value) => value.replace(/\s+/g, ' ').trim().toUpperCase();
      const wanted = normalize(expected);
      const cards = [...document.querySelectorAll('apc-card-agreements')];
      const card = cards.find((node) => normalize(node.querySelector('h4')?.textContent || '') === wanted)
        || (cards.length === 1 ? cards[0] : null);
      if (!card) {
        resolve({ id: '', clicked: false });
        return;
      }
      const source = card.querySelector('img')?.src || '';
      const logo = source.match(/\/logo\/([^./]+)\./);
      if (logo) {
        resolve({ id: logo[1], clicked: false });
        return;
      }
      const button = [...card.querySelectorAll('button')].find((element) => element.textContent.includes('Pagar'));
      if (!button) {
        resolve({ id: '', clicked: false });
        return;
      }
      const original = history.pushState.bind(history);
      let settled = false;
      const finish = (id) => {
        if (settled) return;
        settled = true;
        history.pushState = original;
        resolve({ id: id || '', clicked: true });
      };
      history.pushState = function pushState(state, title, url) {
        const match = String(url || '').match(/idConv=([^&]+)/);
        if (match) finish(decodeURIComponent(match[1]));
        return undefined;
      };
      button.click();
      setTimeout(() => finish(''), 5000);
    }), name),
    7000,
  ).catch(() => ({ id: '', clicked: true }));
  if (captured?.id) return captured;
  if (page.url().includes('idConv=')) {
    return { id: new URL(page.url()).searchParams.get('idConv') || '', clicked: true };
  }
  return captured || { id: '', clicked: false };
}

async function resolveMissing(page, state, catalog, browser) {
  const pending = catalog.filter((item) => !item.id && item.name);
  const used = new Set(catalog.map((item) => item.id).filter(Boolean));
  console.log(`Códigos por buscar: ${pending.length}`);
  if (!pending.length) return;
  const pages = [page];
  for (let extra = 1; extra < workers; extra += 1) pages.push(await browser.newPage());
  let cursor = 0;
  let resolved = 0;
  let processed = 0;
  let writeChain = Promise.resolve();
  const persist = () => {
    writeChain = writeChain.then(() => {
      state.catalog = catalog;
      writeState(state);
    });
    return writeChain;
  };

  async function lookup(workerPage) {
    let opened = false;
    for (let attempt = 1; attempt <= 2 && !opened; attempt += 1) {
      try {
        await ensureListing(workerPage);
        opened = true;
      } catch (error) {
        console.log(`Reintento de listado ${attempt}: ${String(error.message || error).split('\n')[0]}`);
      }
    }
    if (!opened) return;
    while (cursor < pending.length) {
      const item = pending[cursor];
      cursor += 1;
      try {
        await ensureListing(workerPage);
        const snapshot = await workerPage.evaluate(() => ({
          heading: document.querySelector('apc-card-agreements h4')?.textContent?.trim() || '',
          count: (document.body.innerText.match(/(\d+)\s+de\s+\d+\s+resultados/) || [])[1] || '',
        }));
        const started = await workerPage.evaluate((query) => {
          const input = document.querySelector('#search-input');
          const button = [...document.querySelectorAll('button')].find((element) => element.textContent.trim() === 'Buscar');
          if (!input || !button) return false;
          const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          setter.call(input, query);
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
          button.click();
          return true;
        }, searchQuery(item.name));
        if (!started) throw new Error('sin buscador');
        await workerPage.waitForFunction((previous) => {
          const text = document.body.innerText;
          if (text.includes('No se encontraron')) return true;
          const match = text.match(/(\d+)\s+de\s+\d+\s+resultados/);
          const heading = document.querySelector('apc-card-agreements h4')?.textContent?.trim() || '';
          if (!match) return false;
          return match[1] !== previous.count || heading !== previous.heading;
        }, snapshot, { timeout: 12000 });
        const empty = await workerPage.evaluate(() => document.body.innerText.includes('No se encontraron'));
        const result = empty ? { id: '', clicked: false } : await readIdFromNamedCard(workerPage, item.name);
        if (result.clicked) await openListing(workerPage).catch(() => {});
        if (result.id && !used.has(result.id)) {
          item.id = result.id;
          used.add(result.id);
          resolved += 1;
          if (resolved % 10 === 0) {
            console.log(`Códigos ${resolved} nuevos, van ${cursor}/${pending.length}`);
            await persist();
          }
        } else if (!result.id) {
          console.log(`Sin código en ${item.name}`);
        }
      } catch (error) {
        const message = String(error.message || error).split('\n')[0];
        if (message.includes('has been closed') || message.includes('Target closed')) return;
        console.log(`Sin código en ${item.name}: ${message}`);
        await openListing(workerPage).catch(() => {});
      }
      processed += 1;
      if (processed % 20 === 0) await persist();
    }
  }

  await Promise.allSettled(pages.map((workerPage) => lookup(workerPage)));
  await persist();
}

async function collectCatalog(page, state, browser) {
  if (state.catalogComplete && state.catalog.length >= minCount) return state.catalog;
  if ((state.catalog || []).length < minCount) state.catalogComplete = false;
  if (!limit && (state.catalog || []).length >= minCount) {
    console.log(`Listado ya recogido: ${state.catalog.length} convenios.`);
    return state.catalog;
  }
  console.log(`Recorriendo el listado de ${slug}...`);
  await openListing(page);
  console.log('Listado abierto.');
  const catalog = limit ? [] : [...(state.catalog || [])];
  let announced = await announcedTotal(page);
  const seen = new Set(catalog.map((item) => item.id).filter(Boolean));
  const seenNames = new Set(catalog.map((item) => item.name).filter(Boolean));
  const pagesDone = limit ? 0 : (state.listPage ? state.listPage - 1 : Math.floor(catalog.length / 10));
  let pageNumber = 1;
  if (pagesDone) console.log(`Retomando en la página ${pagesDone + 1}...`);
  for (let step = 0; step < pagesDone; step += 1) {
    const moved = await clickNext(page);
    console.log(`Retoma ${step + 1}/${pagesDone}: ${moved}`);
    if (moved !== 'moved') break;
    pageNumber += 1;
  }
  announced = announced || await announcedTotal(page);
  const pageCap = announced ? Math.ceil(announced / 10) + 3 : 2000;
  let reachedEnd = false;

  while (pageNumber <= pageCap) {
    console.log(`Leyendo página ${pageNumber}...`);
    const cards = await withTimeout(readCards(page), 8000).catch(() => []);
    const firstName = cards[0]?.name || '';
    for (const card of cards) {
      if (card.id) {
        if (!seen.has(card.id)) {
          seen.add(card.id);
          if (card.name) seenNames.add(card.name);
          catalog.push(card);
        }
      } else if (card.name && !seenNames.has(card.name)) {
        seenNames.add(card.name);
        catalog.push(card);
      }
      if (limit && catalog.length >= limit) break;
    }
    console.log(`Página ${pageNumber}: ${catalog.length} convenios`);
    state.catalog = catalog;
    state.listPage = pageNumber;
    writeState(state);
    if (limit && catalog.length >= limit) break;
    if (announced && catalog.filter((item) => item.id).length >= announced) {
      state.catalogComplete = !limit;
      break;
    }
    let moved = await clickNext(page);
    if (moved !== 'moved') {
      announced = (await announcedTotal(page)) || announced;
      const unfinished = !limit && announced && catalog.length + 5 < announced;
      if (unfinished) {
        console.log(`La paginación se cortó en ${catalog.length} de ${announced}. Reintento la página ${pageNumber}.`);
        await restoreListing(page, pageNumber, firstName).catch(() => {});
        moved = await clickNext(page);
      }
    }
    if (moved === 'disabled' && (!announced || catalog.length + 5 >= announced)) {
      reachedEnd = !limit;
      break;
    }
    if (moved !== 'moved') {
      console.log(`El listado se detuvo en la página ${pageNumber}.`);
      state.catalogComplete = false;
      break;
    }
    pageNumber += 1;
    if (pageNumber % 20 === 0) announced = (await announcedTotal(page)) || announced;
  }

  state.catalog = catalog;
  writeState(state);
  return catalog;
}

async function openPayment(page, id) {
  const paths = [payPath, payPath === 'realizar-pago-facturadores' ? 'realizar-pago' : 'realizar-pago-facturadores'];
  for (const pathName of paths) {
    const url = `https://www.avalpaycenter.com/wps/portal/portal-de-pagos/web/pagos-aval/resultado-busqueda/${pathName}?idConv=${id}`;
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await dismissSecurity(page);
    if (!page.url().includes('idConv=')) {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await dismissSecurity(page);
    }
    const ready = await page.waitForSelector('.name_convenio', { timeout: 15000 }).then(() => true).catch(() => false);
    if (ready) return;
  }
  throw new Error('sin formulario');
}

async function scrapeOne(page, card) {
  await openPayment(page, card.id);
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
page.setDefaultTimeout(8000);
page.setDefaultNavigationTimeout(20000);

try {
  const catalog = await collectCatalog(page, state, browser);
  const pendingNow = catalog.filter((card) => card.id && !state.forms[card.id]).length;
  console.log(`Formularios por leer: ${pendingNow}. Los códigos que faltan se buscan al mismo tiempo.`);
  state.errors = [];
  let savedCount = Object.keys(state.forms).length;
  let writeChain = Promise.resolve();
  let codesSettled = !catalog.some((item) => !item.id && item.name);
  const claimed = new Set();
  const codesPromise = codesSettled
    ? Promise.resolve()
    : resolveMissing(page, state, catalog, browser).then(() => {
      codesSettled = true;
      const withId = catalog.filter((item) => item.id).length;
      if (!limit && withId + 40 >= catalog.length) state.catalogComplete = true;
      state.catalog = catalog;
      writeState(state);
    });

  const remember = (record) => {
    writeChain = writeChain.then(() => {
      state.forms[record.id] = record;
      savedCount += 1;
      writeState(state);
      if (savedCount <= 250 || savedCount % 25 === 0) publish(state);
      console.log(`${savedCount}/${catalog.filter((item) => item.id).length} ${record.name}`);
    });
    return writeChain;
  };

  const fail = (card, error) => {
    writeChain = writeChain.then(() => {
      state.errors.push({ id: card.id, name: card.name, message: String(error).slice(0, 300) });
      writeState(state);
      console.log(`Error en ${card.name}: ${error.message || error}`);
    });
    return writeChain;
  };

  function takeCard() {
    const card = catalog.find((item) => item.id && !state.forms[item.id] && !claimed.has(item.id));
    if (!card) return null;
    if (limit && claimed.size >= limit) return null;
    claimed.add(card.id);
    return card;
  }

  async function worker() {
    const workerPage = await browser.newPage();
    try {
      while (true) {
        const card = takeCard();
        if (!card) {
          if (codesSettled || (limit && claimed.size >= limit)) break;
          await new Promise((resolve) => setTimeout(resolve, 800));
          continue;
        }
        let saved = false;
        for (let attempt = 1; attempt <= 3 && !saved; attempt += 1) {
          try {
            const record = await scrapeOne(workerPage, card);
            await remember(record);
            saved = true;
            await workerPage.waitForTimeout(400);
          } catch (error) {
            if (attempt === 3) await fail(card, error);
            else await workerPage.waitForTimeout(2000);
          }
        }
      }
    } finally {
      await workerPage.close();
    }
  }

  await Promise.all([
    codesPromise,
    ...Array.from({ length: Math.min(workers, Math.max(pendingNow, 1)) }, () => worker()),
  ]);
  await writeChain;
  publish(state);
} finally {
  await browser.close();
}
