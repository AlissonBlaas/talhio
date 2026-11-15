import { Logger } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import compression from 'compression';
import { json, urlencoded } from 'express';
import helmet from 'helmet';
import { CONFIG, type Config } from './core/config.js';

/**
 * Configuração de transporte e segurança, igual na API de verdade e nos testes de ponta a ponta.
 * Chamar antes de `listen()` / `init()`, numa aplicação criada com `bodyParser: false`.
 */
export function configurarApp(app: NestExpressApplication): Config {
  const config = app.get<Config>(CONFIG);

  // Cabeçalhos de segurança (sem "X-Powered-By", sem sniffing, HSTS quando há HTTPS, etc.).
  app.use(helmet());
  // Respostas JSON em gzip: o relatório e a lista de talhões (com contornos) ficam várias vezes menores no 4G.
  app.use(compression());
  // Atrás de um proxy (produção), o IP real vem no cabeçalho; sem isso o limite por IP trata todos como um só.
  if (config.atrasDeProxy) app.set('trust proxy', 1);

  // Um log por pedido do app: método, caminho (sem parâmetros, que podem levar código de login), resposta e tempo.
  if (config.logPedidos) {
    const log = new Logger('Pedido');
    app.use((req: { method: string; originalUrl: string }, res: { statusCode: number; on: (e: string, f: () => void) => void }, next: () => void) => {
      const inicio = Date.now();
      res.on('finish', () => {
        const caminho = req.originalUrl.split('?')[0];
        if (caminho !== '/v1/saude') log.log(`${req.method} ${caminho} -> ${res.statusCode} em ${Date.now() - inicio} ms`);
      });
      next();
    });
  }

  // Tamanho do corpo: pequeno por padrão; grande só na importação de arquivos (base64 dentro do JSON).
  app.use('/v1/importacoes', json({ limit: '30mb' }));
  app.use(json({ limit: '100kb' }));
  app.use(urlencoded({ extended: false, limit: '10kb' }));

  // Versão no caminho desde o início: o app instalado no celular não atualiza na hora.
  app.setGlobalPrefix('v1');
  // O app nativo não usa CORS. Só libera navegador para as origens listadas em CORS_ORIGENS.
  if (config.corsOrigens.length > 0) app.enableCors({ origin: config.corsOrigens });
  app.enableShutdownHooks();
  return config;
}
