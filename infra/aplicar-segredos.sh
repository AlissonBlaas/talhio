#!/usr/bin/env bash
#
# Entrega à API do Talhio (EC2) as variáveis guardadas no AWS Secrets Manager (talhio/api-env) e
# reinicia o contêiner para ela passar a usá-las.
#
# Por que um script e não a API lendo o cofre sozinha: a EC2 não tem papel do IAM, então só quem tem
# as credenciais da AWS (esta máquina) lê o segredo. Os valores nunca são impressos.
#
# Para mudar uma variável (ex.: ligar a IA): edite o segredo (console da AWS > Secrets Manager >
# talhio/api-env > Retrieve secret value > Edit) e rode este script.
#
# Uso:  ./infra/aplicar-segredos.sh
# Requer: aws CLI, node, a chave SSH ~/.ssh/talhio-key.pem e a imagem talhio-api já no ECR.

set -euo pipefail

SEGREDO="talhio/api-env"
HOST="${TALHIO_EC2:-54.94.234.238}"
CHAVE="${TALHIO_CHAVE:-$HOME/.ssh/talhio-key.pem}"
IMAGEM="167610984472.dkr.ecr.sa-east-1.amazonaws.com/talhio-api:latest"
ssh_ec2() { ssh -i "$CHAVE" -o ConnectTimeout=10 "ec2-user@$HOST" "$@"; }

umask 077
ARQUIVO="$(mktemp)"
trap 'rm -f "$ARQUIVO"' EXIT

echo "==> Lendo $SEGREDO"
aws secretsmanager get-secret-value --secret-id "$SEGREDO" --query SecretString --output text |
  node -e '
    let s = ""; process.stdin.on("data", (d) => (s += d)).on("end", () => {
      const o = JSON.parse(s);
      for (const [k, v] of Object.entries(o)) {
        if (/[\r\n]/.test(String(v))) { console.error("valor com quebra de linha: " + k); process.exit(1); }
        console.log(k + "=" + v);
      }
    });' >"$ARQUIVO"
echo "    $(wc -l <"$ARQUIVO" | tr -d ' ') variáveis"

echo "==> Enviando para a EC2 (guardando cópia do arquivo anterior)"
ssh_ec2 'cp -p ~/talhio-api.env ~/talhio-api.env.anterior 2>/dev/null || true'
ssh_ec2 'umask 077; cat > ~/talhio-api.env' <"$ARQUIVO"

echo "==> Reiniciando a API"
ssh_ec2 "sudo docker rm -f talhio-api >/dev/null 2>&1; sudo docker run -d --name talhio-api --network talhio --env-file ~/talhio-api.env --restart unless-stopped $IMAGEM >/dev/null"

echo "==> Esperando a API ficar saudável"
for _ in $(seq 1 20); do
  estado="$(ssh_ec2 "sudo docker inspect talhio-api --format '{{.State.Health.Status}}'" 2>/dev/null || true)"
  [ "$estado" = "healthy" ] && { echo "    saudável"; exit 0; }
  sleep 5
done
echo "A API não ficou saudável. Últimas linhas do log:" >&2
ssh_ec2 'sudo docker logs --tail 15 talhio-api 2>&1' | sed -E 's#(postgres://[^:]+:)[^@]+@#\1***@#' >&2
echo "Para voltar ao arquivo anterior: ssh na EC2, mv ~/talhio-api.env.anterior ~/talhio-api.env e suba o contêiner de novo." >&2
exit 1
