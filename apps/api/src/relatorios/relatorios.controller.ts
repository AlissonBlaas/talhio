import { Controller, Get, Header, HttpCode, Inject, Param, Post, Query, StreamableFile } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { DiaSchema, FiltroDeMaquinasSchema, PeriodoSchema, type EnvioAoGrupo, type Periodo, type Relatorio } from '@talhio/shared';
import { OrgAtual, SoAdmin } from '../auth/auth.decorators.js';
import { ZodPipe } from '../shared/zod.pipe.js';
import { gerarPdfDoRelatorio, nomeDoArquivoPdf } from './relatorio-pdf.js';
import { RelatoriosEnvioService } from './relatorios-envio.service.js';
import { RelatoriosService } from './relatorios.service.js';

@Controller('relatorios')
export class RelatoriosController {
  constructor(
    @Inject(RelatoriosService) private readonly relatorios: RelatoriosService,
    @Inject(RelatoriosEnvioService) private readonly envio: RelatoriosEnvioService,
  ) {}

  /** `/relatorios/dia`, `/relatorios/semana` ou `/relatorios/mes`, com `?data=AAAA-MM-DD` para outro dia e `?maquinas=id1,id2` para só algumas máquinas (vale também no PDF e no envio). */
  @Get(':periodo')
  montar(
    @OrgAtual() orgId: string,
    @Param('periodo', new ZodPipe(PeriodoSchema)) periodo: Periodo,
    @Query('data', new ZodPipe(DiaSchema.optional())) data?: string,
    @Query('maquinas', new ZodPipe(FiltroDeMaquinasSchema.optional())) maquinas?: string[],
  ): Promise<Relatorio> {
    return this.relatorios.montar(orgId, periodo, data, undefined, maquinas);
  }

  /** O mesmo relatório em PDF, com gráficos e a marca. `?data=` escolhe o dia, a semana ou o mês. */
  @Get(':periodo/pdf')
  @Header('Content-Type', 'application/pdf')
  async pdf(
    @OrgAtual() orgId: string,
    @Param('periodo', new ZodPipe(PeriodoSchema)) periodo: Periodo,
    @Query('data', new ZodPipe(DiaSchema.optional())) data?: string,
    @Query('maquinas', new ZodPipe(FiltroDeMaquinasSchema.optional())) maquinas?: string[],
  ): Promise<StreamableFile> {
    const relatorio = await this.relatorios.montar(orgId, periodo, data, undefined, maquinas);
    const arquivo = await gerarPdfDoRelatorio(relatorio);
    return new StreamableFile(arquivo, { type: 'application/pdf', disposition: `attachment; filename="${nomeDoArquivoPdf(relatorio)}"` });
  }

  /** Manda o relatório (PDF + resumo) ao grupo do WhatsApp da fazenda. `?data=` escolhe o dia, a semana ou o mês. */
  @SoAdmin()
  @Throttle({ default: { limit: 6, ttl: 60_000 } })
  @Post(':periodo/envio')
  @HttpCode(200)
  enviar(
    @OrgAtual() orgId: string,
    @Param('periodo', new ZodPipe(PeriodoSchema)) periodo: Periodo,
    @Query('data', new ZodPipe(DiaSchema.optional())) data?: string,
    @Query('maquinas', new ZodPipe(FiltroDeMaquinasSchema.optional())) maquinas?: string[],
  ): Promise<EnvioAoGrupo> {
    return this.envio.enviarAoGrupo(orgId, periodo, data, maquinas);
  }
}
