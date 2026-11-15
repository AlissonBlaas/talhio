import { Inject, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import type { Maquina, Operacao, Plano, Talhao } from '@talhio/shared';
import { EscalaRepository } from '../escala/escala.repository.js';
import { MaquinasService } from '../maquinas/maquinas.service.js';
import { diaLocal } from '../shared/dia.js';
import { TalhoesService } from '../talhoes/talhoes.service.js';
import { PlanosRepository, type DadosDoPlano, type PlanoGravado } from './planos.repository.js';

const NOME_DA_OPERACAO: Record<Operacao, string> = { plantio: 'Plantio', pulverizacao: 'Pulverização', adubacao: 'Adubação', colheita: 'Colheita' };

/** "Plantio de soja", "Pulverização"... É o que aparece na escala como tarefa. */
export function tarefaDoPlano(plano: Pick<DadosDoPlano, 'operacao' | 'cultura'>): string {
  return plano.cultura ? `${NOME_DA_OPERACAO[plano.operacao]} de ${plano.cultura.toLowerCase()}` : NOME_DA_OPERACAO[plano.operacao];
}

@Injectable()
export class PlanosService {
  constructor(
    @Inject(PlanosRepository) private readonly planos: PlanosRepository,
    @Inject(EscalaRepository) private readonly escalas: EscalaRepository,
    @Inject(MaquinasService) private readonly maquinas: MaquinasService,
    @Inject(TalhoesService) private readonly talhoes: TalhoesService,
  ) {}

  async listar(orgId: string): Promise<Plano[]> {
    const [gravados, maquinas, talhoes] = await Promise.all([this.planos.listar(orgId), this.maquinas.listar(orgId), this.talhoes.listar(orgId)]);
    return gravados.map((p) => this.montar(p, maquinas, talhoes));
  }

  async buscar(orgId: string, id: string): Promise<Plano> {
    const [gravado, maquinas, talhoes] = await Promise.all([this.planos.buscar(orgId, id), this.maquinas.listar(orgId), this.talhoes.listar(orgId)]);
    if (!gravado) throw new NotFoundException({ codigo: 'PLANO_NAO_ENCONTRADO', mensagem: 'Plano não encontrado' });
    return this.montar(gravado, maquinas, talhoes);
  }

  /**
   * Salva o plano. O envio ao monitor ainda não acontece: depende de a John Deere liberar o
   * Work Plans. Enquanto isso, se o plano começa hoje, ele entra na escala das máquinas que já
   * têm operador (tarefa e talhão), e segue para a equipe pela mensagem da escala.
   */
  async criar(orgId: string, dados: DadosDoPlano, agora = new Date()): Promise<Plano> {
    const [maquinas, talhoes] = await Promise.all([this.maquinas.listar(orgId, agora), this.talhoes.listar(orgId)]);
    if (dados.talhaoIds.some((id) => !talhoes.some((t) => t.id === id))) {
      throw new UnprocessableEntityException({ codigo: 'TALHAO_NAO_ENCONTRADO', mensagem: 'Um dos talhões não existe mais. Abra o plano de novo pelo mapa.' });
    }
    if (dados.maquinaIds.some((id) => !maquinas.some((m) => m.id === id))) {
      throw new UnprocessableEntityException({ codigo: 'MAQUINA_NAO_ENCONTRADA', mensagem: 'Uma das máquinas escolhidas não existe mais. Confira a lista.' });
    }
    const unicos = { ...dados, talhaoIds: [...new Set(dados.talhaoIds)], maquinaIds: [...new Set(dados.maquinaIds)] };
    const gravado = await this.planos.salvar(orgId, unicos);

    const hoje = diaLocal(agora);
    if (unicos.dataInicio === hoje) {
      const escala = await this.escalas.doDia(orgId, hoje);
      for (const id of unicos.maquinaIds) {
        const atual = escala.find((e) => e.maquinaId === id);
        const operador = atual?.operador ?? maquinas.find((m) => m.id === id)?.operador;
        // Sem operador não há o que escalar: quem monta a escala escolhe depois.
        if (operador) await this.escalas.definir(orgId, hoje, id, { operador, tarefa: tarefaDoPlano(unicos), talhaoId: unicos.talhaoIds[0]!, turno: atual?.turno ?? 'dia-todo' });
      }
    }
    return this.montar(gravado, maquinas, talhoes);
  }

  private montar(p: PlanoGravado, maquinas: Maquina[], talhoes: Talhao[]): Plano {
    return {
      id: p.id,
      // Talhão ou máquina que deixou de existir sai do plano mostrado.
      talhoes: p.talhaoIds.flatMap((id) => talhoes.filter((t) => t.id === id).map((t) => ({ id, nome: t.nome }))),
      operacao: p.operacao,
      cultura: p.cultura,
      variedade: p.variedade,
      sementesPorHa: p.sementesPorHa,
      espacamentoCm: p.espacamentoCm,
      produto: p.produto,
      doseProduto: p.doseProduto,
      dataInicio: p.dataInicio,
      recado: p.recado,
      maquinas: p.maquinaIds.flatMap((id) => maquinas.filter((m) => m.id === id).map((m) => ({ id, nome: m.nome, envio: 'aguardando-liberacao' as const }))),
      criadoEm: p.criadoEm.toISOString(),
    };
  }
}
