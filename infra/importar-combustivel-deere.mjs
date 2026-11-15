#!/usr/bin/env node
//
// Importa para o Talhio o consumo de combustível por máquina e dia, a partir dos CSVs que o Operations Center da
// John Deere exporta (Analisador da Máquina > Exportar). Cada arquivo é de uma máquina; o número de série dentro dele
// diz qual.
//
// Para cada dia lê o "Combustível Consumido no Período" (janela 00:00-23:59, o total que a tela mostra) e as horas de
// motor do mesmo dia (soma de "Utilização da máquina" em operação + ocioso + transporte). Dia que não está no
// arquivo não é importado: não é zero litro.
//
// Uso:
//   node infra/importar-combustivel-deere.mjs --pasta ~/Downloads/deere-combustivel --mapa mapa-maquinas.json
//   node infra/importar-combustivel-deere.mjs --pasta ... --mapa ... --aplicar      (grava de verdade)
//
// Sem --aplicar só mostra o que entraria (simulação) e não grava nada. Re-importar o mesmo arquivo é seguro: o dia
// é regravado, sem duplicar.
//
// O mapa (--mapa) é um JSON { "orgId": "...", "maquinas": { "<SERIE>": { "id": "<id Deere>", "nome": "..." } } }.

import { readdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const arg = (nome) => {
  const i = process.argv.indexOf(nome);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const aplicar = process.argv.includes('--aplicar');
const pasta = resolve((arg('--pasta') ?? '').replace(/^~/, homedir()));
const arquivoMapa = arg('--mapa');
if (!arg('--pasta') || !arquivoMapa) {
  console.error('Uso: node infra/importar-combustivel-deere.mjs --pasta <pasta com os CSV> --mapa <mapa-maquinas.json> [--aplicar]');
  process.exit(1);
}
const mapa = JSON.parse(readFileSync(resolve(arquivoMapa.replace(/^~/, homedir())), 'utf8'));
const orgId = mapa.orgId;
if (!/^[\w-]+$/.test(orgId)) throw new Error('orgId do mapa inválido');

const MESES = { jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6, jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12 };
const dia = (texto) => {
  const [d, m, a] = texto.trim().toLowerCase().split(/\s+/);
  const mes = MESES[m?.replace('.', '')];
  if (!mes || !/^\d+$/.test(d) || !/^\d{4}$/.test(a)) return null;
  return `${a}-${String(mes).padStart(2, '0')}-${d.padStart(2, '0')}`;
};

/** CSV com aspas e vírgulas dentro dos campos. */
function lerCsv(texto) {
  const linhas = [];
  let campo = '';
  let linha = [];
  let aspas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (aspas) {
      if (c === '"' && texto[i + 1] === '"') (campo += '"'), i++;
      else if (c === '"') aspas = false;
      else campo += c;
    } else if (c === '"') aspas = true;
    else if (c === ',') (linha.push(campo), (campo = ''));
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && texto[i + 1] === '\n') i++;
      linha.push(campo);
      campo = '';
      if (linha.length > 1 || linha[0] !== '') linhas.push(linha);
      linha = [];
    } else campo += c;
  }
  if (campo !== '' || linha.length) (linha.push(campo), linhas.push(linha));
  return linhas;
}

const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
const arquivos = readdirSync(pasta).filter((f) => f.toLowerCase().endsWith('.csv'));
if (arquivos.length === 0) throw new Error(`Nenhum .csv em ${pasta}`);

const registros = []; // { maquinaId, nome, dia, litros, horas }
const resumo = [];
for (const arquivo of arquivos) {
  const linhas = lerCsv(readFileSync(join(pasta, arquivo), 'utf8').replace(/^﻿/, ''));
  const [cab, ...dados] = linhas;
  if (!cab || cab[0] !== 'Número de Série da Máquina') {
    resumo.push({ arquivo, aviso: 'não parece um export do Analisador da Máquina (cabeçalho diferente); ignorado' });
    continue;
  }
  const serie = (dados[0]?.[0] ?? '').trim().toUpperCase();
  const maquina = mapa.maquinas[serie];
  if (!maquina) {
    resumo.push({ arquivo, aviso: `série ${serie.slice(0, 4)}…${serie.slice(-4)} não está no mapa de máquinas; ignorado` });
    continue;
  }
  const porDia = new Map(); // dia -> { litros, horas }
  for (const l of dados) {
    // Colunas: 0 série, 1 apelido, 2 categoria, 3 série/estado, 4 data início, 5 hora início, 6 data fim, 7 hora fim, 8 valor, 9 unidade.
    if (l[7]?.trim() !== '23:59' || l[5]?.trim() !== '00:00') continue; // a outra janela (00:00-00:00) é a soma por estado
    const d = dia(l[4] ?? '');
    if (!d) continue;
    const valor = Number(l[8]);
    if (!Number.isFinite(valor)) continue;
    const reg = porDia.get(d) ?? { litros: null, horas: 0, temHoras: false };
    // O total do dia é a linha com a série escrita "Combustível Consumido no Período" (C maiúsculo). A de minúsculas é a soma por estado.
    if (l[2]?.trim() === 'Combustível Consumido no Período' && l[3]?.trim() === 'Combustível Consumido no Período' && l[9]?.trim().toLowerCase() === 'l') reg.litros = valor;
    if (l[2]?.trim() === 'Utilização da máquina' && l[9]?.trim().toLowerCase() === 'hr' && ['Ociosa', 'Em operação', 'Transporte'].includes(l[3]?.trim())) {
      reg.horas += valor;
      reg.temHoras = true;
    }
    porDia.set(d, reg);
  }
  let dias = 0;
  let total = 0;
  let semLitros = 0;
  let primeiro = '';
  let ultimo = '';
  for (const [d, r] of [...porDia].sort(([a], [b]) => a.localeCompare(b))) {
    if (d >= hoje) continue; // hoje está incompleto: o Talhio calcula ao vivo
    if (r.litros === null) {
      semLitros++;
      continue;
    }
    registros.push({ maquinaId: maquina.id, dia: d, litros: r.litros, horas: r.temHoras ? Math.round(r.horas * 100) / 100 : null });
    dias++;
    total += r.litros;
    primeiro ||= d;
    ultimo = d;
  }
  resumo.push({ arquivo, maquina: `${maquina.nome} (${maquina.id})`, dias, total: Math.round(total), primeiro, ultimo, semLitros });
}

console.log(`\nPasta: ${pasta}`);
for (const r of resumo) {
  if (r.aviso) console.log(`  ! ${r.arquivo}: ${r.aviso}`);
  else console.log(`  ${r.maquina.padEnd(32)} ${String(r.dias).padStart(3)} dias  ${String(r.total).padStart(6)} L  ${r.primeiro} → ${r.ultimo}${r.semLitros ? `  (${r.semLitros} dia(s) sem total de combustível, ignorados)` : ''}`);
}
console.log(`\nTotal: ${registros.length} máquina-dia(s), ${Math.round(registros.reduce((s, r) => s + r.litros, 0))} L.`);
if (registros.length === 0) process.exit(0);

// SQL: valores numéricos e ids validados, sem texto livre.
const num = (n) => (n === null ? 'NULL' : String(Number(n)));
const valores = registros.map((r) => {
  if (!/^\d+$/.test(r.maquinaId) || !/^\d{4}-\d{2}-\d{2}$/.test(r.dia)) throw new Error('registro inválido');
  return `('${orgId}','${r.maquinaId}','${r.dia}',${num(r.litros)},${num(r.horas)})`;
});
const sql = `BEGIN;
INSERT INTO combustivel_importado (org_id, maquina_id, dia, litros, horas_motor) VALUES
${valores.join(',\n')}
ON CONFLICT (org_id, maquina_id, dia) DO UPDATE SET litros = EXCLUDED.litros, horas_motor = EXCLUDED.horas_motor, importado_em = now();
COMMIT;
`;

if (!aplicar) {
  console.log('\nSimulação: nada foi gravado. Rode de novo com --aplicar para gravar.');
  process.exit(0);
}

const host = process.env.TALHIO_EC2 ?? '54.94.234.238';
const chave = process.env.TALHIO_CHAVE ?? join(homedir(), '.ssh', 'talhio-key.pem');
const r = spawnSync('ssh', ['-i', chave, '-o', 'ConnectTimeout=10', `ec2-user@${host}`, 'docker exec -i talhio-pg psql -U talhio -d talhio -v ON_ERROR_STOP=1 -q'], { input: sql, encoding: 'utf8' });
if (r.status !== 0) {
  console.error('Falhou ao gravar:', r.stderr || r.stdout);
  process.exit(1);
}
console.log(`\nGravado: ${registros.length} máquina-dia(s) em combustivel_importado.`);
