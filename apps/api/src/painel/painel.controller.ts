import { Controller, Get, Inject } from '@nestjs/common';
import type { Painel } from '@talhio/shared';
import { OrgAtual } from '../auth/auth.decorators.js';
import { PainelService } from './painel.service.js';

@Controller('painel')
export class PainelController {
  constructor(
    @Inject(PainelService) private readonly painel: PainelService,
  ) {}

  @Get()
  montar(@OrgAtual() orgId: string): Promise<Painel> {
    return this.painel.montar(orgId);
  }
}
