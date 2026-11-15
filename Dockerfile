# Imagem da API do Talhio (apps/api). Construa a partir da RAIZ do repositório:
#   docker build -t talhio-api .
# O app (apps/mobile) e o site (apps/site) não entram na imagem.

FROM node:22-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@10.28.0 --activate
WORKDIR /app

# --- Compila os pacotes e a API ---
FROM base AS construcao
# Primeiro só os manifestos: a instalação das dependências fica em cache e só roda de novo quando um
# package.json ou o pnpm-lock.yaml muda. Mudar código não reinstala nada.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/package.json
COPY packages/deere/package.json ./packages/deere/package.json
COPY apps/api/package.json ./apps/api/package.json
# Só o que a API usa (ela e os pacotes de que depende), exatamente nas versões do pnpm-lock.yaml.
RUN pnpm install --frozen-lockfile --filter "@talhio/api..."
# Agora o código (o .dockerignore já deixa node_modules e dist de fora).
COPY packages ./packages
COPY apps/api ./apps/api
RUN pnpm --filter "./packages/*" build && pnpm --filter @talhio/api build
# Junta numa pasta só a API compilada e as dependências de produção dela (sem compilador, sem
# testes e sem nada do aplicativo). É essa pasta que vai para a imagem final.
RUN pnpm --filter @talhio/api deploy --prod --legacy /saida

# --- Imagem final ---
FROM base AS final
ENV NODE_ENV=production
ENV PORT=3333
# Atrás do balanceador da AWS: usa o IP real de quem chamou (limite de requisições por pessoa).
ENV ATRAS_DE_PROXY=1
# Certificados da AWS para o Postgres do RDS, que só aceita conexão cifrada.
# Com isto, use DATABASE_URL terminando em ?sslmode=verify-full
ADD --chmod=644 https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem /etc/ssl/certs/aws-rds.pem
ENV NODE_EXTRA_CA_CERTS=/etc/ssl/certs/aws-rds.pem
# O --chmod=644 do ADD também vale para as pastas que ele cria (/etc/ssl ficava sem permissão de
# entrada e o Node não achava nem o openssl.cnf). Devolve o acesso às pastas.
RUN chmod 755 /etc/ssl /etc/ssl/certs

COPY --from=construcao --chown=node:node /saida/package.json ./package.json
COPY --from=construcao --chown=node:node /saida/node_modules ./node_modules
COPY --from=construcao --chown=node:node /saida/dist ./dist
# Migrações do banco: a API aplica as pendentes ao subir.
COPY --from=construcao --chown=node:node /saida/drizzle ./drizzle

# Sem privilégios de administrador dentro do contêiner. A pasta é do usuário comum para o teste
# local (sem DATABASE_URL) poder criar o banco embutido; em produção nada é gravado nela.
RUN chown node:node /app
USER node
EXPOSE 3333
# O balanceador da AWS usa a mesma rota para saber se a API está de pé.
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/v1/saude').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/main.js"]
