import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const FILE = resolve(ROOT, 'frontend/src/data/cooperativas.json');
const BASE =
  'https://www.avalpaycenter.com/wps/portal/portal-de-pagos/web/pagos-aval/resultado-busqueda/realizar-pago';

const data = JSON.parse(readFileSync(FILE, 'utf8'));
const targets = data.filter((item) =>
  (item.fields || []).some((field) => field.kind === 'select' && !(field.options && field.options.length)),
);

console.log(`Convenios con selects vacíos: ${targets.length}`);

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

async function readOpenOptions() {
  const active = page.locator('.selectropdown-form.active .options');
  if (await active.count()) {
    const text = await active.first().innerText();
    return text
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && line !== 'Selecciona');
  }
  const items = page.locator('.selectropdown-form.active .options-background');
  const values = await items.allTextContents();
  return values.map((line) => line.trim()).filter((line) => line && line !== 'Selecciona');
}

for (let i = 0; i < targets.length; i += 1) {
  const item = targets[i];
  const selects = (item.fields || []).filter((field) => field.kind === 'select');
  console.log(`${i + 1}/${targets.length} ${item.id} ${item.name}`);
  try {
    await page.goto(`${BASE}?idConv=${item.id}&origen=buscar`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    await page.waitForSelector('.selectropdown-form input, .pay-form, apc-input', { timeout: 30000 });
    await page.waitForTimeout(800);

    const inputs = page.locator('.selectropdown-form input');
    const count = await inputs.count();
    let selectIndex = 0;
    for (const field of selects) {
      if (selectIndex >= count) {
        field.options = field.options || [];
        continue;
      }
      const input = inputs.nth(selectIndex);
      selectIndex += 1;
      try {
        await input.click({ timeout: 5000 });
        await page.waitForTimeout(500);
        field.options = await readOpenOptions();
        await page.keyboard.press('Escape');
        await page.waitForTimeout(200);
      } catch (error) {
        console.log(`  error ${field.id}: ${error.message}`);
        field.options = field.options || [];
      }
      console.log(`  ${field.label}: ${field.options.length} opciones`);
    }
  } catch (error) {
    console.log(`  fallo convenio: ${error.message}`);
  }

  writeFileSync(FILE, `${JSON.stringify(data, null, 2)}\n`);
}

await browser.close();
console.log('Listo.');
