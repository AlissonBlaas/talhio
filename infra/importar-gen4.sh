#!/usr/bin/env bash
#
# Importa a pasta do monitor John Deere Geração 4 (zip) para o Talhio, sem passar pelo app.
# Serve quando o arquivo está no computador e o simulador não o enxerga.
#
# Uso:
#   ./infra/importar-gen4.sh "caminho/do/arquivo.zip" [endereço da API]
#
# Pede o e-mail e a senha do administrador AQUI no terminal (a senha não aparece na tela nem fica gravada).
# Cada importação substitui a anterior. Nada é gravado na John Deere.

set -euo pipefail

ZIP="${1:-}"
API="${2:-https://api.talhio.com.br/v1}"
[ -f "$ZIP" ] || { echo "Uso: $0 \"caminho/do/arquivo.zip\" [endereço da API]"; exit 1; }
command -v node >/dev/null || { echo "ERRO: instale o node antes de continuar."; exit 1; }

read -r -p "E-mail do administrador: " EMAIL
read -r -s -p "Senha: " SENHA
echo

ZIP="$ZIP" API="$API" EMAIL="$EMAIL" SENHA="$SENHA" node --input-type=module -e '
import { readFileSync } from "node:fs";
import { basename } from "node:path";
const { ZIP, API, EMAIL, SENHA } = process.env;
const json = async (r) => { const t = await r.text(); try { return JSON.parse(t); } catch { return { mensagem: t.slice(0, 200) }; } };

const entrar = await fetch(`${API}/auth/entrar`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: EMAIL, senha: SENHA }) });
const sessao = await json(entrar);
if (!entrar.ok || !sessao.tokenAcesso) { console.error(`Login recusado (${entrar.status}): ${sessao.mensagem ?? ""}`); process.exit(1); }

const corpo = { arquivos: [{ nome: basename(ZIP), conteudoBase64: readFileSync(ZIP).toString("base64") }] };
const r = await fetch(`${API}/importacoes/gen4`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessao.tokenAcesso}` }, body: JSON.stringify(corpo) });
const saida = await json(r);
if (!r.ok) { console.error(`A importação falhou (${r.status}): ${saida.mensagem ?? saida.codigo ?? ""}`); process.exit(1); }

console.log(`Importado: ${saida.fazendaNome}`);
for (const t of saida.talhoes) console.log(`  ${t.nome}: ${t.areaHa.toFixed(1)} ha, ${t.passadas} passadas`);
console.log(`${saida.talhoes.length} talhão(ões), ${saida.totalLinhas} linha(s). Abra o mapa no app.`);
'
