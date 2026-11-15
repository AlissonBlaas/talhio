# Imagem do site do Talhio: só os arquivos prontos, servidos pelo nginx sem privilégio de administrador.
# Antes de construir, gere o site:  pnpm --filter @talhio/site build
# Depois, a partir de apps/site:    docker build -t talhio-site .
FROM nginxinc/nginx-unprivileged:stable-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY build/client /usr/share/nginx/html
EXPOSE 8080
