import { Inject, Injectable } from '@nestjs/common';
import type { EnvioAoGrupo, Periodo } from '@talhio/shared';
import { WhatsappService } from '../whatsapp/whatsapp.service.js';
import { gerarPdfDoRelatorio, nomeDoArquivoPdf } from './relatorio-pdf.js';
import { RelatoriosService } from './relatorios.service.js';
import { textoDoRelatorioParaWhatsapp } from './texto-whatsapp.js';

/** Manda o relatório ao grupo do WhatsApp da fazenda: o PDF, com o resumo em texto como legenda. */
@Injectable()
export class RelatoriosEnvioService {
  constructor(
    @Inject(RelatoriosService) private readonly relatorios: RelatoriosService,
    @Inject(WhatsappService) private readonly whatsapp: WhatsappService,
  ) {}

  async enviarAoGrupo(orgId: string, periodo: Periodo, data?: string, maquinaIds?: string[]): Promise<EnvioAoGrupo> {
    // Confere antes de montar o PDF: sem WhatsApp ou sem grupo, responde logo com o motivo.
    await this.whatsapp.exigirGrupo(orgId);
    const relatorio = await this.relatorios.montar(orgId, periodo, data, undefined, maquinaIds);
    const arquivo = await gerarPdfDoRelatorio(relatorio);
    return this.whatsapp.notificarGrupo(orgId, textoDoRelatorioParaWhatsapp(relatorio), { arquivo, nome: nomeDoArquivoPdf(relatorio), tipo: 'application/pdf' });
  }
}
