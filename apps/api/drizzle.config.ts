import { defineConfig } from 'drizzle-kit';

// Só para GERAR migrações a partir do schema (`pnpm banco:gerar`). Aplicar é com a própria API, ao subir.
export default defineConfig({ dialect: 'postgresql', schema: './src/banco/schema.ts', out: './drizzle' });
