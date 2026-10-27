import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const catalogPath = path.join(root, 'frontend', 'src', 'data', 'conjuntos-residenciales.json');
const statePath = path.join(root, 'scripts', 'output', 'conjuntos-residenciales-state.json');
const progressPath = path.join(root, 'scripts', 'output', 'conjuntos-extras-progress.json');
const workers = Number(process.argv.find((item) => item.startsWith('--workers='))?.split('=')[1] || 4);

const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
const state = fs.existsSync(statePath) ? JSON.parse(fs.readFileSync(statePath, 'utf8')) : { forms: {} };
const progress = fs.existsSync(progressPath)
  ? JSON.parse(fs.readFileSync(progressPath, 'utf8'))
  : { done: {}, errors: [] };

function needsPatch(item) {
  const marked = progress.done[item.id];
  if (marked) return false;
  const hasAddress = Boolean(item.address);
  const hasBreb = Array.isArray(item.methods) && item.methods.includes('breb');
  const badLead = item.methodsLead === 'Otros medios de pago:';
  return !hasAddress || !hasBreb || badLead;
}

const queue = catalog.filter(needsPatch);
console.log(`Por actualizar: ${queue.length} de ${catalog.length}`);

async function dismiss(page) {
  const accept = page.locator('button', { hasText: 'Aceptar' }).first();
  if (await accept.isVisible().catch(() => false)) await accept.click();
  await page.evaluate(() => {
    const heading = [...document.querySelectorAll('h1, h2, h3')].find((element) =>
      element.textContent.includes('Protege tu información'),
    );
    if (!heading) return;
    const button = [...document.querySelectorAll('button')].find((element) => element.textContent.trim() === 'Continuar');
    button?.click();
  }).catch(() => {});
}

async function readExtras(page, id) {
  const paths = ['realizar-pago', 'realizar-pago-facturadores'];
  for (const pathName of paths) {
    const url = `https://www.avalpaycenter.com/wps/portal/portal-de-pagos/web/pagos-aval/resultado-busqueda/${pathName}?idConv=${id}`;
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await dismiss(page);
    const ready = await page.waitForSelector('.name_convenio, .info-box, .container-breb', { timeout: 15000 }).then(() => true).catch(() => false);
    if (!ready) continue;
    await dismiss(page);
    return page.evaluate(() => {
      const locationLabel = [...document.querySelectorAll('strong')].find((element) =>
        /^Ubicaci[oó]n/i.test(element.textContent.trim()),
      );
      const addressLabel = [...document.querySelectorAll('strong')].find((element) =>
        /^Direcci[oó]n/i.test(element.textContent.trim()),
      );
      const location = locationLabel?.parentElement?.textContent?.replace(/Ubicaci[oó]n:\s*/i, '').trim() || '';
      const address = addressLabel?.parentElement?.textContent?.replace(/Direcci[oó]n:\s*/i, '').trim() || '';
      const images = [...document.querySelectorAll('img')].map((image) => image.src);
      const methods = [];
      if (document.querySelector('.container-breb') || images.some((src) => /logo-breb/i.test(src))) methods.push('breb');
      if (images.some((src) => src.includes('logo-aval.svg'))) methods.push('aval');
      if (images.some((src) => src.includes('logo-pse.svg'))) methods.push('pse');
      const methodsLead =
        [...document.querySelectorAll('.cnv_content_info-payment_methods > .description, .cnv_content_info-payment_methods > p')]
          .map((element) => element.textContent.trim())
          .find((text) => /medios/i.test(text)) ||
        [...document.querySelectorAll('p, .description')]
          .map((element) => element.textContent.trim())
          .find((text) => /Selecciona el medio|puedes realizar/i.test(text)) ||
        'Selecciona el medio de pago para continuar tu transacción:';
      return { location, address, methods, methodsLead };
    });
  }
  throw new Error('sin extras');
}

function applyPatch(item, extras) {
  if (extras.location) item.location = extras.location;
  if (extras.address) item.address = extras.address;
  if (extras.methods?.length) item.methods = extras.methods;
  if (extras.methodsLead && extras.methodsLead !== 'Otros medios de pago:') item.methodsLead = extras.methodsLead;
  if (state.forms[item.id]) {
    state.forms[item.id] = { ...state.forms[item.id], ...item };
  }
}

function saveAll() {
  fs.writeFileSync(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`);
  fs.writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`);
  fs.writeFileSync(progressPath, `${JSON.stringify(progress, null, 2)}\n`);
}

const browser = await chromium.launch({ channel: 'chrome', headless: true }).catch(() =>
  chromium.launch({ channel: 'msedge', headless: true }),
);

let cursor = 0;
let saved = 0;
let writeChain = Promise.resolve();

async function worker() {
  const page = await browser.newPage();
  page.setDefaultTimeout(8000);
  page.setDefaultNavigationTimeout(20000);
  try {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= queue.length) break;
      const item = queue[index];
      try {
        const extras = await readExtras(page, item.id);
        applyPatch(item, extras);
        progress.done[item.id] = {
          address: Boolean(extras.address),
          methods: extras.methods,
          at: new Date().toISOString(),
        };
        saved += 1;
        if (saved % 25 === 0) {
          writeChain = writeChain.then(() => saveAll());
          await writeChain;
          console.log(`${saved}/${queue.length} ${item.name}`);
        }
      } catch (error) {
        progress.errors.push({ id: item.id, name: item.name, message: String(error.message || error).slice(0, 200) });
        console.log(`Error en ${item.name}: ${error.message || error}`);
      }
    }
  } finally {
    await page.close();
  }
}

await Promise.all(Array.from({ length: Math.min(workers, Math.max(queue.length, 1)) }, () => worker()));
await writeChain;
saveAll();
await browser.close();
console.log(`Listo. Actualizados ${saved}. Errores ${progress.errors.length}.`);
