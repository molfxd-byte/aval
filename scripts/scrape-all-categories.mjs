import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const countsPath = path.join(scriptsDir, 'output', 'category-counts.json');
const logPath = path.join(scriptsDir, 'output', 'batch-categories.log');

const counts = JSON.parse(fs.readFileSync(countsPath, 'utf8'));
const pending = counts.filter((item) => item.total > 0 && !item.error).sort((left, right) => left.total - right.total);

function runCategory(item) {
  return new Promise((resolve) => {
    const started = new Date().toISOString();
    const header = `\n===== ${item.slug} ${item.total} ${started} =====\n`;
    fs.appendFileSync(logPath, header);
    console.log(header.trim());
    const child = spawn(
      process.execPath,
      [
        'scrape-category.mjs',
        `--slug=${item.slug}`,
        `--category=${item.id}`,
        '--pay=realizar-pago',
        `--min=${item.total}`,
        '--workers=3',
      ],
      { cwd: scriptsDir, stdio: ['ignore', 'pipe', 'pipe'] },
    );
    const write = (chunk) => {
      process.stdout.write(chunk);
      fs.appendFileSync(logPath, chunk);
    };
    child.stdout.on('data', write);
    child.stderr.on('data', write);
    child.on('close', (code) => {
      const line = `===== fin ${item.slug} code=${code} =====\n`;
      fs.appendFileSync(logPath, line);
      console.log(line.trim());
      resolve(code);
    });
  });
}

fs.mkdirSync(path.dirname(logPath), { recursive: true });
for (const item of pending) {
  const code = await runCategory(item);
  if (code !== 0) console.log(`La categoría ${item.slug} terminó con código ${code}. Sigo con la siguiente.`);
}
console.log('Lote de categorías terminado.');
