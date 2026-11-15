import { Body, Controller, Get, Inject, Param, Post } from '@nestjs/common';
import { NovoPlanoSchema, type Plano } from '@talhio/shared';
import type { z } from 'zod';
import { OrgAtual, SoAdmin } from '../auth/auth.decorators.js';
import { IdSchema, ZodPipe } from '../shared/zod.pipe.js';
import { PlanosService } from './planos.service.js';

@Controller('planos')
export class PlanosController {
  constructor(@Inject(PlanosService) private readonly planos: PlanosService) {}

  /** Os planos mais recentes da fazenda. */
  @Get()
  listar(@OrgAtual() orgId: string): Promise<Plano[]> {
    return this.planos.listar(orgId);
  }

  @Get(':id')
  buscar(@OrgAtual() orgId: string, @Param('id', new ZodPipe(IdSchema)) id: string): Promise<Plano> {
    return this.planos.buscar(orgId, id);
  }

  @SoAdmin()
  @Post()
  criar(@OrgAtual() orgId: string, @Body(new ZodPipe(NovoPlanoSchema)) dados: z.output<typeof NovoPlanoSchema>): Promise<Plano> {
    return this.planos.criar(orgId, dados);
  }
}
