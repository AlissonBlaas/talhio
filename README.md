# Talhio

Gestão de máquinas agrícolas: planejar no app, enviar ao trator e receber o relatório pronto.

## Rodar

Requisitos: Node 22+ e pnpm 10 (`corepack enable`).

```bash
pnpm install
pnpm build      # compila packages/shared e packages/deere
pnpm api        # terminal 1: API em http://localhost:3333/v1
pnpm mobile     # terminal 2: Expo na porta 8082 (tecle i para o simulador iOS)
```

A API sobe com dados falsos (`DEERE_PROVEDOR=fake`), então o app funciona sem trator e sem conta
da John Deere. Copie `apps/api/.env.example` para `apps/api/.env` para mudar a configuração.

## Estrutura

```text
apps/mobile      React Native + Expo
apps/api         NestJS
packages/shared  contrato da API (Zod)
packages/deere   porta para a John Deere (provedor falso e real)
```

As regras de arquitetura estão em [CLAUDE.md](./CLAUDE.md).
# talhio
