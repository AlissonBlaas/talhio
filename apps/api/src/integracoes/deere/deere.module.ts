import { Global, Logger, Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { DeereProvedor, FakeProvedor, lerPastaGen4, type ProvedorMaquinas } from '@talhio/deere';
import { CONFIG, type Config } from '../../core/config.js';
import { DeereErroFilter } from './deere-erro.filter.js';
import { AtividadeDeereRepository } from './atividade-deere.repository.js';
import { CombustivelAcumuladoRepository } from './combustivel-acumulado.repository.js';
import { ConsumoDeereRepository } from './consumo-deere.repository.js';
import { ConsumoDeereService } from './consumo-deere.service.js';
import { UsoDiarioRepository } from './uso-diario.repository.js';
import { LarguraImplementoRepository } from './largura-implemento.repository.js';
import { SincronizacaoDeereService } from './sincronizacao-deere.service.js';
import { ConexaoDeereController } from './conexao-deere.controller.js';
import { ConexaoDeereRepository } from './conexao-deere.repository.js';
import { ConexaoDeereService } from './conexao-deere.service.js';
import { DEERE_HTTP } from './deere.http.js';
import { PROVEDOR_MAQUINAS } from './deere.tokens.js';

const logDaDeere = new Logger('Deere');

/**
 * Único lugar que escolhe a fonte dos dados de máquinas.
 * As features injetam PROVEDOR_MAQUINAS e não sabem qual implementação está em uso.
 */
@Global()
@Module({
  controllers: [ConexaoDeereController],
  providers: [
    ConexaoDeereRepository,
    ConexaoDeereService,
    AtividadeDeereRepository,
    UsoDiarioRepository,
    LarguraImplementoRepository,
    CombustivelAcumuladoRepository,
    ConsumoDeereRepository,
    ConsumoDeereService,
    SincronizacaoDeereService,
    { provide: APP_FILTER, useClass: DeereErroFilter },
    { provide: DEERE_HTTP, useValue: fetch },
    {
      provide: PROVEDOR_MAQUINAS,
      inject: [CONFIG, ConexaoDeereService, AtividadeDeereRepository, UsoDiarioRepository, LarguraImplementoRepository, CombustivelAcumuladoRepository],
      useFactory: (config: Config, conexao: ConexaoDeereService, armazem: AtividadeDeereRepository, diario: UsoDiarioRepository, larguras: LarguraImplementoRepository, combustivel: CombustivelAcumuladoRepository): ProvedorMaquinas =>
        config.deereProvedor === 'fake' || !config.deere
          ? new FakeProvedor(undefined, config.pastaGen4 ? lerPastaGen4(config.pastaGen4) : null)
          : new DeereProvedor({
              clientId: config.deere.clientId,
              clientSecret: config.deere.clientSecret,
              baseUrl: config.deere.baseUrl,
              equipamentosUrl: config.deere.equipamentosUrl,
              aempUrl: config.deere.aempUrl,
              obterToken: (orgId) => conexao.obterToken(orgId),
              obterOrganizacao: (orgId) => conexao.organizacaoDaDeere(orgId),
              obterOrganizacoes: (orgId) => conexao.organizacoesDaDeere(orgId),
              armazem,
              diario,
              combustivel,
              combustivelPeloTanque: config.combustivelPeloTanque,
              obterLarguras: (orgId) => larguras.todas(orgId),
              // Cada chamada à John Deere vira uma linha no log do servidor (LOG_DEERE=0 desliga).
              registrar: config.logDeere ? (linha) => logDaDeere.log(linha) : undefined,
            }),
    },
  ],
  exports: [PROVEDOR_MAQUINAS, ConexaoDeereService, SincronizacaoDeereService, LarguraImplementoRepository, AtividadeDeereRepository],
})
export class DeereModule {}
