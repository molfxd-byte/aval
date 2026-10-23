import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';

const serviciosLog = 'C:\\Users\\Lenovo\\.cursor\\projects\\c-Users-Lenovo-avalpay-panel\\terminals\\644464.txt';

function serviciosStillRunning() {
  if (!fs.existsSync(serviciosLog)) return false;
  return !fs.readFileSync(serviciosLog, 'utf8').includes('exit_code:');
}

function run(script, args = []) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [script, ...args], { stdio: 'inherit' });
    child.on('exit', (code) => {
      console.log(`${script} terminó con código ${code ?? 0}`);
      resolve(code ?? 0);
    });
  });
}

console.log('Esperando a que termine Servicios públicos...');
while (serviciosStillRunning()) await delay(20000);

console.log('Cierro lo que haya quedado pendiente de Servicios públicos.');
await run('scrape-servicios-publicos.mjs');

console.log('Empieza Conjuntos residenciales.');
await run('scrape-category.mjs', [
  '--category=6',
  '--slug=conjuntos-residenciales',
  '--pay=realizar-pago',
  '--min=12000',
  '--workers=3',
]);
