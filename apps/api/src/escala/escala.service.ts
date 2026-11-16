import { ConflictException, Inject, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { ORDEM_DOS_TURNOS, type Escala, type EscalaItem, type Turno } from '@talhio/shared';
import { MaquinasService } from '../maquinas/maquinas.service.js';
import { diaLocal } from '../shared/dia.js';
import { TalhoesService } from '../talhoes/talhoes.service.js';
import { EscalaRepository, type DadosDaEscala } from './escala.repository.js';

/** O dia de calendário anterior a `dia` (AAAA-MM-DD). */
const diaAntes = (dia: string) => new Date(Date.parse(`${dia}T12:00:00Z`) - 86_400_000).toISOString().slice(0, 10);

const mesmoNome = (a: string, b: string) => a.trim().localeCompare(b.trim(), 'pt-BR', { sensitivity: 'base' }) === 0;
/** Dois turnos se cruzam quando são o mesmo ou um deles é o dia todo. */
const turnosSeCruzam = (a: Turno, b: Turno) => a === b || a === 'dia-todo' || b === 'dia-todo';

@Injectable()
export class EscalaService {
  constructor(
    @Inject(EscalaRepository) private readonly escalas: EscalaRepository,
    @Inject(MaquinasService) private readonly maquinas: MaquinasService,
    @Inject(TalhoesService) private readonly talhoes: TalhoesService,
  ) {}

  /**
   * A escala de um dia (hoje, se não disser qual): uma linha por máquina e turno escalado (máquina sem turno gravado tem uma linha só). Máquina sem escala gravada aparece como
   * sugestão ainda não confirmada: repete a escala gravada no dia anterior (mesmo operador, tarefa, talhão e turno) e,
   * sem ela, usa o operador que a própria máquina informa.
   */
  async deHoje(orgId: string, agora = new Date(), dia = diaLocal(agora)): Promise<Escala> {
    const [maquinas, talhoes, gravadas, ontem] = await Promise.all([this.maquinas.listar(orgId, agora), this.talhoes.listar(orgId), this.escalas.doDia(orgId, dia), this.escalas.doDia(orgId, diaAntes(dia))]);
    const nomeDoTalhao = new Map(talhoes.map((t) => [t.id, t.nome]));

    const naOrdem = <T extends { turno: Turno }>(linhas: T[]) => [...linhas].sort((a, b) => ORDEM_DOS_TURNOS.indexOf(a.turno) - ORDEM_DOS_TURNOS.indexOf(b.turno));
    const itens = maquinas.flatMap((maquina): EscalaItem[] => {
      const base = { maquinaId: maquina.id, maquinaNome: maquina.nome, implemento: maquina.implemento, maquinaStatus: maquina.status, maquinaTipo: maquina.tipo };
      const doDia = naOrdem(gravadas.filter((g) => g.maquinaId === maquina.id));
      if (doDia.length > 0) {
        return doDia.map((gravada) => ({
          ...base,
          operador: gravada.operador,
          tarefa: gravada.tarefa,
          talhaoId: gravada.talhaoId,
          // Talhão apagado depois de escalado: a escala continua, sem o nome.
          talhaoNome: gravada.talhaoId ? (nomeDoTalhao.get(gravada.talhaoId) ?? null) : null,
          turno: gravada.turno,
          definida: true,
          enviadaEm: gravada.enviadaEm?.toISOString() ?? null,
        }));
      }
      // Sem nada gravado hoje: repete os turnos de ontem, cada um com o seu operador.
      const repetidas = naOrdem(ontem.filter((g) => g.maquinaId === maquina.id));
      if (repetidas.length > 0) {
        return repetidas.map((repetida) => {
          // Talhão apagado desde ontem: a sugestão segue sem ele.
          const talhaoId = repetida.talhaoId && nomeDoTalhao.has(repetida.talhaoId) ? repetida.talhaoId : null;
          return { ...base, operador: repetida.operador, tarefa: repetida.tarefa, talhaoId, talhaoNome: talhaoId ? (nomeDoTalhao.get(talhaoId) ?? null) : null, turno: repetida.turno, definida: false, enviadaEm: null };
        });
      }
      return [{ ...base, operador: maquina.operador, tarefa: null, talhaoId: maquina.talhaoId, talhaoNome: maquina.talhaoNome, turno: 'dia-todo', definida: false, enviadaEm: null }];
    });
    return { dia, itens };
  }

  async definir(orgId: string, maquinaId: string, { substitui, ...dados }: DadosDaEscala & { substitui?: Turno }, agora = new Date(), dia = diaLocal(agora)): Promise<Escala> {
    const [maquinas, talhoes, gravadas] = await Promise.all([this.maquinas.listar(orgId, agora), this.talhoes.listar(orgId), this.escalas.doDia(orgId, dia)]);
    if (!maquinas.some((m) => m.id === maquinaId)) throw new NotFoundException({ codigo: 'MAQUINA_NAO_ENCONTRADA', mensagem: 'Máquina não encontrada' });
    if (dados.talhaoId && !talhoes.some((t) => t.id === dados.talhaoId)) {
      throw new UnprocessableEntityException({ codigo: 'TALHAO_NAO_ENCONTRADO', mensagem: 'Esse talhão não existe mais. Escolha outro.' });
    }
    const outra = gravadas.find((g) => g.maquinaId !== maquinaId && mesmoNome(g.operador, dados.operador) && turnosSeCruzam(g.turno, dados.turno));
    if (outra) {
      const nome = maquinas.find((m) => m.id === outra.maquinaId)?.nome ?? 'outra máquina';
      throw new ConflictException({ codigo: 'OPERADOR_JA_ESCALADO', mensagem: `${dados.operador.trim()} já está em ${nome} nesse turno.` });
    }
    await this.escalas.definir(orgId, dia, maquinaId, dados, substitui);
    return this.deHoje(orgId, agora, dia);
  }

  /**
   * Confirma a escala sugerida do dia: grava de uma vez todas as linhas que ainda são sugestão e têm operador, sem
   * marcar como enviada. É o "está certo, vale" de quem só confere a escala que o app já montou.
   */
  async confirmar(orgId: string, agora = new Date(), dia = diaLocal(agora)): Promise<Escala> {
    const { itens } = await this.deHoje(orgId, agora, dia);
    for (const item of itens) {
      if (!item.definida && item.operador) {
        await this.escalas.definir(orgId, dia, item.maquinaId, { operador: item.operador, tarefa: item.tarefa, talhaoId: item.talhaoId, turno: item.turno });
      }
    }
    return this.deHoje(orgId, agora, dia);
  }

  async tirar(orgId: string, maquinaId: string, agora = new Date(), dia = diaLocal(agora), turno?: Turno): Promise<Escala> {
    await this.escalas.tirar(orgId, dia, maquinaId, turno);
    return this.deHoje(orgId, agora, dia);
  }

  /**
   * Registra que a escala de hoje foi mandada para a equipe. As sugestões que foram na mensagem
   * passam a valer como escala: o que fica gravado é o que a equipe recebeu.
   */
  async marcarEnviada(orgId: string, agora = new Date(), dia = diaLocal(agora), maquinaIds?: string[]): Promise<Escala> {
    // Envio de um plano: só as máquinas dele, que já foram gravadas uma a uma.
    const { itens } = maquinaIds ? { itens: [] } : await this.deHoje(orgId, agora, dia);
    for (const item of itens) {
      if (!item.definida && item.operador) {
        await this.escalas.definir(orgId, dia, item.maquinaId, { operador: item.operador, tarefa: item.tarefa, talhaoId: item.talhaoId, turno: item.turno });
      }
    }
    await this.escalas.marcarEnviada(orgId, dia, agora, maquinaIds);
    return this.deHoje(orgId, agora, dia);
  }
}
