// Garante que a biblioteca de mapas só é importada dentro de src/mapa-motor.
// O resto do app usa o módulo `@/mapa-motor`, e mais nada.
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const RAIZ = join(import.meta.dirname, '..', 'src');
const PERMITIDO = join(RAIZ, 'mapa-motor') + sep;
const BIBLIOTECA = /from\s+['"]@maplibre\//;
const INTERNO = /from\s+['"]@\/mapa-motor\/.+['"]/;

const erros = [];
function percorrer(pasta) {
  for (const item of readdirSync(pasta, { withFileTypes: true })) {
    const caminho = join(pasta, item.name);
    if (item.isDirectory()) percorrer(caminho);
    else if (/\.tsx?$/.test(item.name) && !caminho.startsWith(PERMITIDO)) {
      const texto = readFileSync(caminho, 'utf8');
      const onde = relative(join(RAIZ, '..'), caminho);
      if (BIBLIOTECA.test(texto)) erros.push(`${onde}: importa a biblioteca de mapas direto. Use "@/mapa-motor".`);
      if (INTERNO.test(texto)) erros.push(`${onde}: importa um arquivo interno do motor de mapa. Importe só de "@/mapa-motor".`);
    }
  }
}
percorrer(RAIZ);

if (erros.length > 0) {
  console.error('Regra do mapa isolado quebrada:\n' + erros.map((e) => `  - ${e}`).join('\n'));
  process.exit(1);
}
console.log('Mapa isolado: ok (a biblioteca de mapas só aparece em src/mapa-motor).');
