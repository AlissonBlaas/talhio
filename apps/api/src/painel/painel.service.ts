import { Inject, Injectable } from '@nestjs/common';
import type { ProvedorMaquinas } from '@talhio/deere';
import type { Painel } from '@talhio/shared';
import { PROVEDOR_MAQUINAS } from '../integracoes/deere/deere.tokens.js';
import { MaquinasService } from '../maquinas/maquinas.service.js';
import { TalhoesService } from '../talhoes/talhoes.service.js';

/** Monta, em uma chamada, tudo o que a tela Início mostra. */
@Injectable()
export class PainelService {
  constructor(
    @Inject(PROVEDOR_MAQUINAS) private readonly provedor: ProvedorMaquinas,
    @Inject(MaquinasService) private readonly maquinas: MaquinasService,
    @Inject(TalhoesService) private readonly talhoes: TalhoesService,
  ) {}

  async montar(orgId: string, agora: Date = new Date()): Promise<Painel> {
    const [maquinas, talhoes, resumo] = await Promise.all([
      this.maquinas.listar(orgId, agora),
      this.talhoes.listar(orgId),
      this.provedor.resumoDaFazenda(orgId),
    ]);
    const contar = (status: Painel['maquinas'][number]['status']) => maquinas.filter((m) => m.status === status).length;

    // Alerta: a máquina parada há mais tempo.
    const parada = maquinas
      .filter((m) => m.status === 'parada' && m.paradaDesde)
      .sort((a, b) => (a.paradaDesde ?? '').localeCompare(b.paradaDesde ?? ''))[0];

    return {
      fazendaNome: resumo.nome || (await this.provedor.nomeDaFazenda?.(orgId).catch(() => '')) || 'Fazenda',
      contagem: { trabalhando: contar('trabalhando'), parada: contar('parada'), semSinal: contar('sem-sinal') },
      talhoes: talhoes.map((t) => ({
        id: t.id,
        nome: t.nome,
        contorno: t.contorno,
        operacao: t.operacao,
      })),
      maquinas: maquinas.map((m) => ({ id: m.id, nome: m.nome, status: m.status, posicao: m.posicao })),
      alerta:
        parada && parada.paradaDesde
          ? {
              tipo: 'maquina-parada',
              maquinaId: parada.id,
              maquinaNome: parada.nome,
              desde: parada.paradaDesde,
              talhaoNome: parada.talhaoNome,
              // Parada com motor ligado ainda não é detectada: depende de telemetria do motor.
              motorLigado: false,
            }
          : null,
      operacaoAtual: resumo.operacaoAtual,
    };
  }
}
