import { Body, Controller, Get, Inject, Post } from '@nestjs/common';
import { NovaLinhaSchema, type Linha } from '@talhio/shared';
import type { z } from 'zod';
import { OrgAtual, SoAdmin } from '../auth/auth.decorators.js';
import { ZodPipe } from '../shared/zod.pipe.js';
import { LinhasService } from './linhas.service.js';

@Controller('linhas')
export class LinhasController {
  constructor(
    @Inject(LinhasService) private readonly linhas: LinhasService,
  ) {}

  @Get()
  listar(@OrgAtual() orgId: string): Promise<Linha[]> {
    return this.linhas.listar(orgId);
  }

  @SoAdmin()
  @Post()
  criar(@OrgAtual() orgId: string, @Body(new ZodPipe(NovaLinhaSchema)) dados: z.output<typeof NovaLinhaSchema>): Promise<Linha> {
    return this.linhas.criar(orgId, dados);
  }
}
