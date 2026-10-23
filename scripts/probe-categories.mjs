import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outPath = path.join(root, 'scripts', 'output', 'category-counts.json');

const categories = [
  ['asociaciones', '2', 'Asociaciones'],
  ['centros-comerciales', '3', 'Centros Comerciales'],
  ['comercializadoras', '5', 'Comercializadoras'],
  ['cooperativas', '7', 'Cooperativas'],
  ['empresas-de-seguros', '15', 'Empresas de Seguros'],
  ['fondo-de-empleados', '1', 'Fondo de empleados'],
  ['fundaciones', '9', 'Fundaciones'],
  ['impuestos', '11', 'Impuestos'],
  ['industria', '12', 'Industria'],
  ['instituciones-educativas', '4', 'Instituciones Educativas'],
  ['obligaciones-financieras', '13', 'Obligaciones Financieras'],
  ['otros-servicios', '14', 'Otros Servicios'],
  ['pagos-pila', '27', 'Pagos PILA'],
  ['servicios-de-seguridad', '8', 'Servicios de Seguridad'],
  ['servicios-de-transporte', '17', 'Servicios de Transporte'],
  ['servicios-exequiales', '10', 'Servicios Exequiales'],
  ['servicios-inmobiliarios', '18', 'Servicios Inmobiliarios'],
  ['tecnologia', '20', 'Tecnología'],
  ['telecomunicacion', '22', 'Telecomunicación'],
  ['telefonia-celular', '21', 'Telefonía Celular'],
  ['television', '23', 'Televisión por Suscripción'],
  ['viajes-y-turismo', '24', 'Viajes y Turismo'],
];

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

const browser = await chromium.launch({ channel: 'chrome', headless: true }).catch(() => chromium.launch({ channel: 'msedge', headless: true }));
const page = await browser.newPage();
const results = [];

for (const [slug, id, title] of categories) {
  const url = `https://www.avalpaycenter.com/wps/portal/portal-de-pagos/web/pagos-aval/que-puedo-pagar?isCategory=false&idCategory=${id}`;
  let h1 = '';
  let total = 0;
  let error = '';
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await dismiss(page);
    await page.waitForFunction(
      () => /resultados|No se encontraron/i.test(document.body.innerText),
      { timeout: 40000 },
    );
    await dismiss(page);
    const info = await page.evaluate(() => ({
      h1: document.querySelector('h1')?.textContent?.trim() || '',
      text: document.body.innerText,
    }));
    h1 = info.h1;
    const match = info.text.match(/de\s+([\d.]+)\s+resultados/i);
    total = match ? Number(match[1].replace(/\./g, '')) : 0;
  } catch (err) {
    error = String(err.message || err).split('\n')[0];
  }
  const row = { slug, id, title, h1, total, error };
  results.push(row);
  console.log(`${slug}\t${id}\t${h1 || '-'}\t${total}\t${error}`);
}

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, `${JSON.stringify(results, null, 2)}\n`);
await browser.close();
