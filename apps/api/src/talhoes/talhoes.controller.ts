import { Body, Controller, Delete, Get, Inject, Param, Post, Put, Query } from '@nestjs/common';
import { EditarTalhaoSchema, NovoTalhaoSchema, PedidoDeApagarTalhaoSchema, type Talhao, type TalhaoApagado } from '@talhio/shared';
import type { z } from 'zod';
import { OrgAtual, SoAdmin } from '../auth/auth.decorators.js';
import { IdSchema, ZodPipe } from '../shared/zod.pipe.js';
import { TalhoesService } from './talhoes.service.js';

@Controller('talhoes')
export class TalhoesController {
  constructor(
    @Inject(TalhoesService) private readonly talhoes: TalhoesService,
  ) {}

  @Get()
  listar(@OrgAtual() orgId: string): Promise<Talhao[]> {
    return this.talhoes.listar(orgId);
  }

  @SoAdmin()
  @Post()
  criar(@OrgAtual() orgId: string, @Body(new ZodPipe(NovoTalhaoSchema)) dados: z.output<typeof NovoTalhaoSchema>): Promise<Talhao> {
    return this.talhoes.criar(orgId, dados);
  }

  @SoAdmin()
  @Put(':id')
  editar(@OrgAtual() orgId: string, @Param('id', new ZodPipe(IdSchema)) id: string, @Body(new ZodPipe(EditarTalhaoSchema)) dados: z.output<typeof EditarTalhaoSchema>): Promise<Talhao> {
    return this.talhoes.editar(orgId, id, dados);
  }

  @SoAdmin()
  @Delete(':id')
  apagar(@OrgAtual() orgId: string, @Param('id', new ZodPipe(IdSchema)) id: string, @Query(new ZodPipe(PedidoDeApagarTalhaoSchema)) pedido: z.output<typeof PedidoDeApagarTalhaoSchema>): Promise<TalhaoApagado> {
    return this.talhoes.apagar(orgId, id, pedido.naDeere === '1');
  }
}
