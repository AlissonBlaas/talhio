#!/usr/bin/env bash
#
# Publica o Talhio na AWS, cada parte em um serviço separado, com endereço próprio:
#   - talhio-api   a API (apps/api), ligada ao banco
#   - talhio-site  o site (apps/site), com os vídeos de fundo dentro
#   - banco        Postgres no RDS, sem acesso pela internet
#
# Uso, a partir de qualquer pasta do projeto:
#   ./infra/publicar.sh          publica tudo (cria o que faltar)
#   ./infra/publicar.sh api      só uma versão nova da API
#   ./infra/publicar.sh site     só uma versão nova do site
#
# Pode rodar de novo quantas vezes quiser: o que já existe é aproveitado.
# As chaves da AWS são lidas do arquivo .env da raiz (fora do Git). Este arquivo não contém segredo.
#
# ATENÇÃO: este roteiro foi escrito a partir da documentação da AWS e NÃO foi executado por quem
# o escreveu. Leia as mensagens a cada passo; se algo falhar, ele para e nada mais é criado.

set -euo pipefail
cd "$(dirname "$0")/.."

ALVO="${1:-tudo}"
case "$ALVO" in tudo | api | site) ;; *) echo "Uso: $0 [tudo|api|site]"; exit 1 ;; esac

# --- Credenciais e região ---------------------------------------------------------------------
if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi
REGIAO="${AWS_REGION:-sa-east-1}"
export AWS_DEFAULT_REGION="$REGIAO" AWS_PAGER=""

PROJETO="talhio"
ETIQUETAS_ECS="key=projeto,value=$PROJETO"
ETIQUETAS="Key=projeto,Value=$PROJETO"

passo() { printf '\n==> %s\n' "$1"; }
falta() { echo "ERRO: $1" >&2; exit 1; }

for programa in aws docker pnpm node; do
  command -v "$programa" >/dev/null || falta "instale '$programa' antes de continuar."
done
docker info >/dev/null 2>&1 || falta "o Docker não está rodando. Abra o Docker Desktop e tente de novo."
aws ecs create-express-gateway-service help >/dev/null 2>&1 || falta "a AWS CLI instalada é antiga e não conhece o ECS Express Mode. Atualize com: brew upgrade awscli"

CONTA="$(aws sts get-caller-identity --query Account --output text)" || falta "a AWS recusou as credenciais do .env."
QUEM="$(aws sts get-caller-identity --query Arn --output text)"
REGISTRO="$CONTA.dkr.ecr.$REGIAO.amazonaws.com"
VERSAO="$(date +%Y%m%d-%H%M%S)"

cat <<AVISO

Publicar o Talhio ($ALVO)
  Conta AWS : $CONTA
  Usuário   : $QUEM
  Região    : $REGIAO

Tudo que for criado leva o nome "talhio" e a etiqueta projeto=talhio.
Isto cria recursos COBRADOS por hora (balanceador, tarefas do Fargate e banco RDS).
AVISO
read -r -p "Continuar? (digite sim) " resposta
[ "$resposta" = "sim" ] || { echo "Cancelado."; exit 0; }

# --- Peças ------------------------------------------------------------------------------------

# Segredo no Secrets Manager. Cria só se não existir; devolve o ARN.
#   segredo NOME VALOR
segredo() {
  local nome="$PROJETO/$1" arn
  if ! arn="$(aws secretsmanager describe-secret --secret-id "$nome" --query ARN --output text 2>/dev/null)"; then
    arn="$(aws secretsmanager create-secret --name "$nome" --secret-string "$2" --tags "$ETIQUETAS" --query ARN --output text)"
  fi
  printf '%s' "$arn"
}
arn_do_segredo() { aws secretsmanager describe-secret --secret-id "$PROJETO/$1" --query ARN --output text 2>/dev/null || true; }
ler_segredo() { aws secretsmanager get-secret-value --secret-id "$PROJETO/$1" --query SecretString --output text 2>/dev/null || true; }
existe_segredo() { aws secretsmanager describe-secret --secret-id "$PROJETO/$1" >/dev/null 2>&1; }
aleatorio() { node -e "console.log(require('crypto').randomBytes($1).toString('base64url'))"; }

papeis() {
  passo "Permissões para o ECS (papéis do IAM)"
  if ! aws iam get-role --role-name talhioExecucao >/dev/null 2>&1; then
    aws iam create-role --role-name talhioExecucao --tags "$ETIQUETAS" --assume-role-policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"ecs-tasks.amazonaws.com"},"Action":"sts:AssumeRole"}]}' >/dev/null
    aws iam attach-role-policy --role-name talhioExecucao --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy
  fi
  # A API recebe os segredos como variáveis: o papel só pode ler os segredos do Talhio.
  aws iam put-role-policy --role-name talhioExecucao --policy-name ler-segredos-do-talhio --policy-document "{\"Version\":\"2012-10-17\",\"Statement\":[{\"Effect\":\"Allow\",\"Action\":\"secretsmanager:GetSecretValue\",\"Resource\":\"arn:aws:secretsmanager:$REGIAO:$CONTA:secret:$PROJETO/*\"}]}"
  if ! aws iam get-role --role-name talhioInfraExpress >/dev/null 2>&1; then
    aws iam create-role --role-name talhioInfraExpress --tags "$ETIQUETAS" --assume-role-policy-document '{"Version":"2012-10-17","Statement":[{"Sid":"AllowAccessInfrastructureForECSExpressServices","Effect":"Allow","Principal":{"Service":"ecs.amazonaws.com"},"Action":"sts:AssumeRole"}]}' >/dev/null
    aws iam attach-role-policy --role-name talhioInfraExpress --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSInfrastructureRoleforExpressGatewayServices
    echo "Papéis criados. Esperando um minuto para a AWS reconhecer..."
    sleep 60
  fi
  aws ecs create-cluster --cluster-name "$PROJETO" --tags "$ETIQUETAS_ECS" >/dev/null
}

banco() {
  passo "Banco de dados (RDS PostgreSQL)"
  if ! aws rds describe-db-instances --db-instance-identifier "$PROJETO" >/dev/null 2>&1; then
    local vpc faixa grupo senha
    read -r vpc faixa <<<"$(aws ec2 describe-vpcs --filters Name=is-default,Values=true --query 'Vpcs[0].[VpcId,CidrBlock]' --output text)"
    [ -n "$vpc" ] && [ "$vpc" != "None" ] || falta "esta conta não tem a rede padrão (default VPC) em $REGIAO. Me avise para adaptar o roteiro à rede que você usa."

    # A senha vai para o cofre ANTES de criar o banco: se algo falhar no meio, ela não se perde.
    existe_segredo BANCO_SENHA || segredo BANCO_SENHA "$(aleatorio 24)" >/dev/null
    senha="$(ler_segredo BANCO_SENHA)"

    grupo="$(aws ec2 describe-security-groups --filters "Name=group-name,Values=$PROJETO-banco" "Name=vpc-id,Values=$vpc" --query 'SecurityGroups[0].GroupId' --output text)"
    if [ "$grupo" = "None" ] || [ -z "$grupo" ]; then
      grupo="$(aws ec2 create-security-group --group-name "$PROJETO-banco" --description "Postgres do Talhio: so de dentro da rede" --vpc-id "$vpc" --query GroupId --output text)"
      # Só máquinas de dentro da rede da conta alcançam o banco. Ele não tem endereço na internet.
      aws ec2 authorize-security-group-ingress --group-id "$grupo" --protocol tcp --port 5432 --cidr "$faixa" >/dev/null
    fi

    echo "Criando o banco (leva de 5 a 15 minutos)..."
    aws rds create-db-instance --db-instance-identifier "$PROJETO" \
      --engine postgres --db-instance-class db.t4g.micro --allocated-storage 20 --storage-type gp3 \
      --db-name "$PROJETO" --master-username "$PROJETO" --master-user-password "$senha" \
      --vpc-security-group-ids "$grupo" --no-publicly-accessible --storage-encrypted \
      --backup-retention-period 7 --deletion-protection --tags "$ETIQUETAS" >/dev/null
  fi
  aws rds wait db-instance-available --db-instance-identifier "$PROJETO"
  if ! existe_segredo DATABASE_URL; then
    local endereco
    endereco="$(aws rds describe-db-instances --db-instance-identifier "$PROJETO" --query 'DBInstances[0].Endpoint.Address' --output text)"
    segredo DATABASE_URL "postgres://$PROJETO:$(ler_segredo BANCO_SENHA)@$endereco:5432/$PROJETO?sslmode=verify-full" >/dev/null
  fi
  echo "Banco pronto."
}

# Constrói a imagem e envia ao ECR. Devolve o endereço da imagem em IMAGEM.
#   imagem NOME PASTA_DE_CONTEXTO ARQUIVO_DOCKERFILE
imagem() {
  local nome="$PROJETO-$1"
  aws ecr describe-repositories --repository-names "$nome" >/dev/null 2>&1 ||
    aws ecr create-repository --repository-name "$nome" --image-scanning-configuration scanOnPush=true --tags "$ETIQUETAS" >/dev/null
  aws ecr get-login-password | docker login --username AWS --password-stdin "$REGISTRO" >/dev/null
  IMAGEM="$REGISTRO/$nome:$VERSAO"
  # linux/amd64: o Mac com chip Apple geraria imagem ARM, que este serviço não roda por padrão.
  docker build --platform linux/amd64 -t "$IMAGEM" -f "$3" "$2"
  docker push "$IMAGEM"
}

# Cria o serviço, ou troca a imagem do que já existe. Mostra o endereço no fim.
#   servico NOME JSON_DO_CONTEINER CAMINHO_DE_SAUDE MEMORIA
servico() {
  local nome="$PROJETO-$1" arn="arn:aws:ecs:$REGIAO:$CONTA:service/$PROJETO/$PROJETO-$1"
  if aws ecs describe-express-gateway-service --service-arn "$arn" >/dev/null 2>&1; then
    aws ecs update-express-gateway-service --service-arn "$arn" --primary-container "$2" --health-check-path "$3" >/dev/null
  else
    aws ecs create-express-gateway-service --cluster "$PROJETO" --service-name "$nome" \
      --execution-role-arn "arn:aws:iam::$CONTA:role/talhioExecucao" \
      --infrastructure-role-arn "arn:aws:iam::$CONTA:role/talhioInfraExpress" \
      --primary-container "$2" --health-check-path "$3" --cpu 256 --memory "$4" \
      --scaling-target minTaskCount=1,maxTaskCount=1 --tags "$ETIQUETAS_ECS" >/dev/null
  fi
  echo "Serviço $nome enviado. A troca leva alguns minutos. Endereço:"
  aws ecs describe-express-gateway-service --service-arn "$arn" --query 'service.activeConfigurations[].ingressPaths[].endpoint' --output text || true
  echo "  (se ainda não apareceu, o esperado é https://$nome.ecs.$REGIAO.on.aws)"
}

publicar_api() {
  passo "Segredos da API"
  if ! existe_segredo ADMIN_EMAIL; then
    read -r -p "E-mail do administrador do app: " email
    [ -n "$email" ] || falta "o e-mail do administrador é obrigatório."
    segredo ADMIN_EMAIL "$email" >/dev/null
  fi
  local nova_senha=""
  if ! existe_segredo ADMIN_SENHA; then
    nova_senha="$(aleatorio 15)"
    segredo ADMIN_SENHA "$nova_senha" >/dev/null
  fi
  existe_segredo JWT_SECRET || segredo JWT_SECRET "$(aleatorio 48)" >/dev/null
  # A chave do assistente vem do .env local da API, se houver. Sem ela, o assistente fica desligado.
  if ! existe_segredo ANTHROPIC_API_KEY && [ -f apps/api/.env ]; then
    local chave
    chave="$(grep -E '^ANTHROPIC_API_KEY=' apps/api/.env | head -1 | cut -d= -f2- | tr -d '"\r ' || true)"
    [ -n "$chave" ] && segredo ANTHROPIC_API_KEY "$chave" >/dev/null
  fi

  passo "Imagem da API"
  imagem api . Dockerfile

  passo "Serviço da API"
  local conteiner
  conteiner="$(
    IMAGEM="$IMAGEM" \
      S_BANCO="$(arn_do_segredo DATABASE_URL)" S_JWT="$(arn_do_segredo JWT_SECRET)" S_EMAIL="$(arn_do_segredo ADMIN_EMAIL)" S_SENHA="$(arn_do_segredo ADMIN_SENHA)" \
      S_IA="$(arn_do_segredo ANTHROPIC_API_KEY)" \
      node -e '
        const e = process.env;
        const secrets = [["DATABASE_URL", e.S_BANCO], ["JWT_SECRET", e.S_JWT], ["ADMIN_EMAIL", e.S_EMAIL], ["ADMIN_SENHA", e.S_SENHA], ["ANTHROPIC_API_KEY", e.S_IA]]
          .filter(([, arn]) => arn).map(([name, valueFrom]) => ({ name, valueFrom }));
        for (const nome of ["S_BANCO", "S_JWT", "S_EMAIL", "S_SENHA"]) if (!e[nome]) { console.error("Segredo ausente: " + nome); process.exit(1); }
        console.log(JSON.stringify({ image: e.IMAGEM, containerPort: 3333, environment: [{ name: "ORG_ID", value: "talhio" }], secrets }));
      '
  )"
  servico api "$conteiner" /v1/saude 1024

  if [ -n "$nova_senha" ]; then
    printf '\nLogin do administrador no app:\n  e-mail: %s\n  senha : %s\nGuarde a senha agora. Ela também fica no Secrets Manager, em talhio/ADMIN_SENHA.\n' "$(ler_segredo ADMIN_EMAIL)" "$nova_senha"
  fi
}

publicar_site() {
  passo "Site"
  # O endereço entra no próprio site (canonical, sitemap, imagem de compartilhamento).
  # Quando houver domínio próprio, defina VITE_URL_DO_SITE antes de rodar.
  VITE_URL_DO_SITE="${VITE_URL_DO_SITE:-https://$PROJETO-site.ecs.$REGIAO.on.aws}" pnpm --filter @talhio/site build
  imagem site apps/site apps/site/Dockerfile
  servico site "{\"image\":\"$IMAGEM\",\"containerPort\":8080}" / 512
}

# --- Execução ---------------------------------------------------------------------------------
papeis
if [ "$ALVO" != "site" ]; then
  banco
  publicar_api
fi
if [ "$ALVO" != "api" ]; then
  publicar_site
fi

passo "Pronto"
echo "Acompanhe os serviços no console da AWS: ECS > Clusters > $PROJETO (região $REGIAO)."
echo "Teste a API quando o serviço estabilizar:  curl https://$PROJETO-api.ecs.$REGIAO.on.aws/v1/saude"
