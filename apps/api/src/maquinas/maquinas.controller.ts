import { Body, Controller, Get, HttpCode, Inject, Param, Post, Query } from '@nestjs/common';
import { DiaSchema, LarguraDoImplementoSchema, type AnaliseDaMaquina, type LarguraDoImplemento, type Maquina, type RastroDaMaquina } from '@talhio/shared';
import { IdSchema, ZodPipe } from '../shared/zod.pipe.js';
import { OrgAtual, SoAdmin } from '../auth/auth.decorators.js';
import { MaquinasService } from './maquinas.service.js';

// Controller fino: recebe a requisição e delega. A regra mora no service.
@Controller('maquinas')
export class MaquinasController {
  constructor(
    @Inject(MaquinasService) private readonly maquinas: MaquinasService,
  ) {}

  @Get()
  listar(@OrgAtual() orgId: string): Promise<Maquina[]> {
    return this.maquinas.listar(orgId);
  }

  /** Antes de `:id`, para "rastros" não ser lido como id de máquina. */
  @Get('rastros')
  rastros(@OrgAtual() orgId: string): Promise<RastroDaMaquina[]> {
    return this.maquinas.rastros(orgId);
  }

  @Get(':id')
  buscar(@OrgAtual() orgId: string, @Param('id', new ZodPipe(IdSchema)) id: string): Promise<Maquina> {
    return this.maquinas.buscar(orgId, id);
  }

  /** Todas as medições do Analisador da Máquina da Deere, de `?de=` a `?ate=` (AAAA-MM-DD, até 30 dias; sem datas, hoje). */
  @Get(':id/analise')
  analise(
    @OrgAtual() orgId: string,
    @Param('id', new ZodPipe(IdSchema)) id: string,
    @Query('de', new ZodPipe(DiaSchema.optional())) de?: string,
    @Query('ate', new ZodPipe(DiaSchema.optional())) ate?: string,
  ): Promise<AnaliseDaMaquina> {
    return this.maquinas.analise(orgId, id, de, ate);
  }

  /** Largura do implemento que a máquina está puxando, em metros: entra na conta dos hectares. Só o administrador. */
  @SoAdmin()
  @Post(':id/largura')
  @HttpCode(200)
  definirLargura(@OrgAtual() orgId: string, @Param('id', new ZodPipe(IdSchema)) id: string, @Body(new ZodPipe(LarguraDoImplementoSchema)) dados: LarguraDoImplemento): Promise<Maquina> {
    return this.maquinas.definirLargura(orgId, id, dados.larguraM);
  }
}
