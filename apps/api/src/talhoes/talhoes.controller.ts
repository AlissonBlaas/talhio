import { Body, Controller, Get, Inject, Post } from '@nestjs/common';
import { NovoTalhaoSchema, type Talhao } from '@talhio/shared';
import type { z } from 'zod';
import { OrgAtual, SoAdmin } from '../auth/auth.decorators.js';
import { ZodPipe } from '../shared/zod.pipe.js';
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
}
