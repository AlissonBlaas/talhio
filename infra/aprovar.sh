#!/usr/bin/env bash
#
# Cadastros do Talhio esperando aprovação.
#
#   ./infra/aprovar.sh                    lista quem se cadastrou e está esperando
#   ./infra/aprovar.sh fulano@email.com   libera essa conta (a pessoa passa a conseguir entrar)
#
# A chave é a APROVACAO_CHAVE do servidor (segredo talhio/api-env). Ela é lida da variável de
# ambiente APROVACAO_CHAVE ou, se não houver, digitada aqui sem aparecer na tela. Não fica gravada.
# Depois de aprovar, avise a pessoa: o Talhio ainda não manda e-mail sozinho.

set -euo pipefail

API="${TALHIO_API:-https://api.talhio.com.br/v1}"
CHAVE="${APROVACAO_CHAVE:-}"
if [ -z "$CHAVE" ]; then
  read -r -s -p "Chave de aprovação: " CHAVE
  echo
fi
[ -n "$CHAVE" ] || { echo "Sem a chave não dá para continuar." >&2; exit 1; }

# A chave vai por um arquivo de cabeçalho temporário, para não aparecer na lista de processos.
umask 077
CABECALHO="$(mktemp)"
trap 'rm -f "$CABECALHO"' EXIT
printf 'x-chave-de-aprovacao: %s\n' "$CHAVE" >"$CABECALHO"

if [ $# -eq 0 ]; then
  resposta="$(curl -sS -w '\n%{http_code}' -H @"$CABECALHO" "$API/auth/pedidos")"
  codigo="${resposta##*$'\n'}"
  corpo="${resposta%$'\n'*}"
  if [ "$codigo" != "200" ]; then
    echo "O servidor respondeu $codigo. Confira a chave e se APROVACAO_CHAVE está no talhio/api-env." >&2
    exit 1
  fi
  printf '%s' "$corpo" | node -e '
    let s = ""; process.stdin.on("data", (d) => (s += d)).on("end", () => {
      const lista = JSON.parse(s);
      if (lista.length === 0) return console.log("Ninguém esperando aprovação.");
      for (const p of lista) console.log(`${new Date(p.pedidoEm).toLocaleString("pt-BR")}  ${p.email}  ·  ${p.nome}  ·  ${p.fazenda}`);
      console.log(`\n${lista.length} esperando. Para liberar: ./infra/aprovar.sh <e-mail>`);
    });'
  exit 0
fi

EMAIL="$1"
codigo="$(EMAIL="$EMAIL" node -e 'process.stdout.write(JSON.stringify({ email: process.env.EMAIL }))' | curl -sS -o /dev/null -w '%{http_code}' -X POST -H @"$CABECALHO" -H 'content-type: application/json' --data-binary @- "$API/auth/pedidos/aprovar")"
case "$codigo" in
  204) echo "Liberado: $EMAIL já consegue entrar. Avise a pessoa." ;;
  404) echo "Não há cadastro esperando com o e-mail $EMAIL (ou a chave está errada)." >&2; exit 1 ;;
  *) echo "O servidor respondeu $codigo." >&2; exit 1 ;;
esac
