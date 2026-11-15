# Publicar o Talhio na AWS

Guia para colocar a API, o banco e o site na AWS, na região de São Paulo (`sa-east-1`).
Escrito em novembro de 2026. Os comandos de imagem e as variáveis foram ensaiados; a criação dos
recursos na AWS **não** foi executada por nós, então confira cada tela com a documentação oficial
indicada em cada passo.

## Jeito rápido: um comando

```bash
./infra/publicar.sh          # tudo: banco, API e site
./infra/publicar.sh api      # só uma versão nova da API
./infra/publicar.sh site     # só uma versão nova do site
```

O roteiro lê as chaves da AWS do `.env` da raiz (fora do Git), mostra a conta e pede confirmação,
e cria cada parte em um serviço separado, com endereço próprio:

| Serviço | Endereço esperado |
|---|---|
| `talhio-api` | `https://talhio-api.ecs.sa-east-1.on.aws` |
| `talhio-site` | `https://talhio-site.ecs.sa-east-1.on.aws` |
| banco `talhio` (RDS) | sem endereço público; só a API alcança |

Os dois serviços dividem o mesmo balanceador (é assim que o Express Mode funciona), o que evita
pagar dois. Os vídeos de fundo do site vão dentro do serviço do site (`apps/site/public/video`).
Segredos (senha do banco, do administrador, chave da IA) ficam no Secrets Manager, em `talhio/...`.
Pode rodar de novo: o que já existe é aproveitado.

**O roteiro não foi executado por quem o escreveu** (não temos acesso à AWS daqui). Se parar com
erro, mande a mensagem. O restante deste documento explica cada passo que ele faz, para conferir
ou fazer à mão.

O que ele NÃO faz: alerta de orçamento, domínio próprio e apagar recursos. Para remover tudo,
apague no console, nesta ordem: os dois serviços do cluster `talhio`, o banco (tem proteção contra
exclusão: desligue antes), os repositórios do ECR e os segredos `talhio/*`.

## Desenho

| Parte | Serviço da AWS | Observação |
|---|---|---|
| API (`apps/api`) | **Amazon ECS, Express Mode** (Fargate) | Sobe a imagem, cria o balanceador e o HTTPS sozinho. É o substituto que a AWS indica para o App Runner, que deixou de aceitar clientes novos em 30/04/2026. |
| Imagem da API | **Amazon ECR** | Repositório privado de imagens. |
| Banco | **Amazon RDS for PostgreSQL** | Postgres gerenciado, com backup. Aceita PostGIS (vamos precisar para os talhões). |
| Segredos | **AWS Secrets Manager** (ou Parameter Store) | Senhas e chaves entram na API como variáveis, nunca no repositório nem na imagem. |
| Site (`apps/site`) | **AWS Amplify Hosting** ou **S3 + CloudFront** | O site é só arquivo estático. |
| Domínio | **Route 53** (ou o registro.br apontando para a AWS) | |

A API é uma só instância por enquanto. Duas coisas ainda ficam na memória dela e precisam ir para
o banco (ou Redis) antes de rodar mais de uma: o bloqueio de login por tentativas e o limite de
requisições.

## Custo

A AWS em São Paulo custa mais que nas regiões dos EUA, e o balanceador é cobrado por hora mesmo
sem uso. Como ordem de grandeza, API pequena + balanceador + banco pequeno ficam na casa de
dezenas de dólares por mês. **Não conferimos os preços**: monte o cenário na calculadora oficial
(https://calculator.aws) antes de criar, e ligue um alerta de orçamento (AWS Budgets) no primeiro dia.

## Antes de começar

1. Conta na AWS com autenticação em duas etapas no usuário raiz, e um usuário do IAM para o dia a dia
   (não use o raiz).
2. AWS CLI e Docker instalados no computador; `aws configure` com a região `sa-east-1`.
3. Um domínio (por exemplo, no registro.br).

## 1. Banco (RDS)

Crie uma instância **PostgreSQL** pequena, na mesma VPC em que a API vai rodar, **sem acesso
público**, com backup automático ligado. Anote endereço, usuário, senha e nome do banco.

A `DATABASE_URL` fica assim (a imagem já traz os certificados do RDS; o `sslmode=verify-full`
faz a API conferir que está falando com o banco certo):

```
postgres://USUARIO:SENHA@ENDERECO-DO-RDS:5432/talhio?sslmode=verify-full
```

Se a senha tiver caracteres especiais (`@`, `/`, `:`, `#`), eles precisam estar codificados na URL.
O grupo de segurança do banco deve aceitar a porta 5432 **só** vinda do grupo de segurança da API.
As tabelas são criadas pela própria API ao subir (migrações em `apps/api/drizzle`).

> Não testamos a conexão com um RDS de verdade. Se a API não subir com erro de certificado, é
> aqui que se olha primeiro.

## 2. Segredos

Guarde no Secrets Manager e entregue à API como variáveis de ambiente:

| Variável | O que é |
|---|---|
| `DATABASE_URL` | A URL do passo 1. |
| `JWT_SECRET` | Segredo dos tokens de login. Gere com `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`. |
| `ADMIN_EMAIL`, `ADMIN_SENHA` | Login do administrador (senha com 10 caracteres ou mais). |
| `ADMIN_NOME` | Nome que aparece no app. |
| `ANTHROPIC_API_KEY` | Chave do assistente de IA. Sem ela, o assistente fica desligado. |
| `ORG_ID` | Identificador da organização do administrador (ex.: o nome da fazenda sem espaços). |

Já vêm definidas na imagem: `NODE_ENV=production`, `PORT=3333`, `ATRAS_DE_PROXY=1`.
Com `NODE_ENV=production`, a API **não sobe** se faltar `DATABASE_URL`, `JWT_SECRET`,
`ADMIN_EMAIL` ou `ADMIN_SENHA`.

Quando a integração com a John Deere existir, entram aqui também `DEERE_CLIENT_ID` e
`DEERE_CLIENT_SECRET`. Nunca coloque esses valores no app, no site, no Git ou em conversa.

## 3. Imagem da API

Na raiz do repositório:

```bash
# Uma vez: cria o repositório de imagens
aws ecr create-repository --repository-name talhio-api --region sa-east-1

# A cada versão (troque CONTA pelo número da sua conta AWS)
aws ecr get-login-password --region sa-east-1 | docker login --username AWS --password-stdin CONTA.dkr.ecr.sa-east-1.amazonaws.com
docker build --platform linux/amd64 -t talhio-api .
docker tag talhio-api:latest CONTA.dkr.ecr.sa-east-1.amazonaws.com/talhio-api:latest
docker push CONTA.dkr.ecr.sa-east-1.amazonaws.com/talhio-api:latest
```

O `--platform linux/amd64` é necessário em Mac com chip Apple (senão a imagem sai para ARM).
Para testar a imagem no computador antes de enviar:

```bash
docker run --rm -p 3333:3333 \
  -e NODE_ENV=development \
  -e JWT_SECRET=um-segredo-qualquer-so-para-este-teste-local-0123456789 \
  -e ADMIN_EMAIL=teste@exemplo.com -e ADMIN_SENHA=senha-de-teste-123 \
  talhio-api
# em outro terminal
curl http://localhost:3333/v1/saude
```

`NODE_ENV=development` só nesse teste: sem `DATABASE_URL`, a API usa um banco embutido que some
quando o contêiner para. As três variáveis são necessárias porque, com o login padrão de
desenvolvimento, a API só atende de dentro do próprio contêiner.

> Ensaiamos estes passos de construção fora do Docker (instalar, compilar, separar as dependências
> de produção e subir a API), mas não rodamos o `docker build` em si. Se ele falhar, mande o erro.

## 4. API no ar (ECS Express Mode)

Crie um serviço Express Mode apontando para a imagem do ECR. Ele pede três coisas: a imagem, um
papel de execução da tarefa e um papel de infraestrutura; e cria o serviço no Fargate, o
balanceador com HTTPS, o escalonamento e os registros.
Passo a passo oficial: https://docs.aws.amazon.com/AmazonECS/latest/developerguide/express-service-overview.html

Na configuração do serviço:

- Porta do contêiner: **3333**.
- Verificação de saúde: caminho **`/v1/saude`**.
- Variáveis: as do passo 2, vindas do Secrets Manager (o papel de execução precisa de permissão
  para ler esses segredos).
- Mesma VPC do banco, e o grupo de segurança da API liberado no grupo do banco.
- Tamanho: o menor (0,25 vCPU e 0,5 GB) atende o piloto; uma tarefa só.

Depois aponte `api.SEU-DOMINIO` para o endereço do serviço e confira:

```bash
curl https://api.SEU-DOMINIO/v1/saude
```

## 5. Site

```bash
cd apps/site
cp .env.example .env   # preencha VITE_URL_DO_SITE e o contato
pnpm build             # gera apps/site/build/client
```

Publique a pasta `apps/site/build/client`:

- **Amplify Hosting**: conecte o repositório, comando de build `pnpm --filter @talhio/site build`,
  pasta de saída `apps/site/build/client`, e as variáveis `VITE_*` no painel; ou
- **S3 + CloudFront**: envie a pasta para um bucket privado e sirva pelo CloudFront, com o
  certificado do domínio (para o CloudFront, o certificado é criado na região `us-east-1`).

## 6. App apontando para a API

No app, o endereço da API passa a ser `https://api.SEU-DOMINIO/v1` (o app publicado só aceita
`https`). A distribuição para teste continua fora da AWS: TestFlight (iPhone) e teste interno do
Google Play.

## O que este primeiro deploy ainda não é

- As **máquinas continuam simuladas** (`DEERE_PROVEDOR=fake`): posição, horas e andamento não são
  de máquinas reais até a integração com a John Deere ficar pronta. Talhões e linhas importados
  pelo app são reais e ficam no banco.
- O provedor simulado guarda **uma fazenda só**: sirva uma única organização neste ambiente.
- Só existe o usuário administrador das variáveis; não há cadastro de usuários nem troca de senha.
- Sem monitoramento de erros nem alarmes além dos registros do CloudWatch.
