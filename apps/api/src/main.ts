import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';

// Lê apps/api/.env se existir (segredos ficam lá, fora do Git). Em produção as variáveis vêm do ambiente.
try {
  process.loadEnvFile();
} catch {
  // Sem .env: segue com as variáveis do ambiente e os padrões de desenvolvimento.
}

const { AppModule } = await import('./app.module.js');
const { configurarApp } = await import('./configurar-app.js');

const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false });
const config = configurarApp(app);
// Com o login padrão de desenvolvimento, a API só atende este computador (simulador e emulador
// funcionam). Para abrir na rede (celular de verdade), defina as credenciais no .env.
const endereco = config.credenciaisDeDesenvolvimento ? '127.0.0.1' : '0.0.0.0';
await app.listen(config.porta, endereco);

console.log(`API em http://localhost:${config.porta}/v1 (provedor: ${config.deereProvedor}${config.pastaGen4 ? `, fazenda de ${config.pastaGen4}` : ', fazenda de demonstração'})`);
if (!config.iaChave) console.warn('AVISO: assistente de IA desligado (defina ANTHROPIC_API_KEY em apps/api/.env para ligar).');
if (config.credenciaisDeDesenvolvimento) {
  console.warn(`AVISO: usando login e segredo de desenvolvimento (${config.adminEmail} / ${config.adminSenha}). Por isso a API só atende este computador. Para usar de outro aparelho, defina ADMIN_EMAIL, ADMIN_SENHA e JWT_SECRET em apps/api/.env.`);
}
