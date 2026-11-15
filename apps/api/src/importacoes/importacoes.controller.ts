import { Body, Controller, HttpCode, Inject, Post } from '@nestjs/common';
import { ImportacaoSchema, type Importacao, type ResultadoImportacao } from '@talhio/shared';
import { OrgAtual, SoAdmin } from '../auth/auth.decorators.js';
import { ZodPipe } from '../shared/zod.pipe.js';
import { ImportacoesService } from './importacoes.service.js';

@Controller('importacoes')
export class ImportacoesController {
  constructor(
    @Inject(ImportacoesService) private readonly importacoes: ImportacoesService,
  ) {}

  /** Talhões e linhas da exportação para o monitor John Deere Geração 4. */
  @SoAdmin()
  @Post('gen4')
  @HttpCode(200)
  gen4(@OrgAtual() orgId: string, @Body(new ZodPipe(ImportacaoSchema)) dados: Importacao): Promise<ResultadoImportacao> {
    return this.importacoes.importarGen4(orgId, dados);
  }
}
