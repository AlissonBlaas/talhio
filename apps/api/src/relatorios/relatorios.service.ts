import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { AtividadeDiariaExterna, ProvedorMaquinas } from '@talhio/deere';
import type { Operacao, Periodo, Relatorio } from '@talhio/shared';
import { PROVEDOR_MAQUINAS } from '../integracoes/deere/deere.tokens.js';
import { MaquinasService } from '../maquinas/maquinas.service.js';
import { PlanosRepository } from '../planos/planos.repository.js';
import { escreverResumo } from './resumo.js';
import { intervalosDo } from './periodos.js';
import { diaLocal } from '../shared/dia.js';

const ZERO: AtividadeDiariaExterna = { horas: 0, areaHa: 0, combustivelL: 0, paradoMin: 0 };
const somar = (a: AtividadeDiariaExterna, b: AtividadeDiariaExterna): AtividadeDiariaExterna => ({
  horas: a.horas + b.horas,
  areaHa: a.areaHa + b.areaHa,
  combustivelL: a.combustivelL + b.combustivelL,
  paradoMin: a.paradoMin + b.paradoMin,
  areaForaDosTalhoesHa: (a.areaForaDosTalhoesHa ?? 0) + (b.areaForaDosTalhoesHa ?? 0),
  combustivelEstimado: !!a.combustivelEstimado || !!b.combustivelEstimado,
  // Vale a partir da leitura mais tardia: é dela em diante que todas as máquinas somadas têm litros.
  combustivelComHorasL: (a.combustivelComHorasL ?? 0) + (b.combustivelComHorasL ?? 0),
  horasMotorLeitura: (a.horasMotorLeitura ?? 0) + (b.horasMotorLeitura ?? 0),
  combustivelDesde: [a.combustivelDesde, b.combustivelDesde].filter((h): h is string => !!h).sort().at(-1),
});
const arredondar = (valor: number, casas = 1) => Math.round(valor * 10 ** casas) / 10 ** casas;
/**
 * Litros por hectare. Nulo quando não há leitura de combustível (zero litros com máquina trabalhando é falta de
 * dado, não economia) ou quando não houve área.
 */
const litrosPorHa = (t: AtividadeDiariaExterna) => (t.combustivelL > 0 && t.areaHa > 0 && !t.combustivelDesde ? arredondar(t.combustivelL / t.areaHa) : null);
/** Litros por hora de máquina. Nulo sem leitura de combustível. */
export const litrosPorHora = (t: AtividadeDiariaExterna) =>
  (t.combustivelComHorasL ?? 0) > 0 && (t.horasMotorLeitura ?? 0) > 0 && !t.combustivelDesde ? arredondar((t.combustivelComHorasL ?? 0) / (t.horasMotorLeitura ?? 0)) : null;

/**
 * Maior consumo médio possível de uma máquina num dia (L por hora de motor). Acima disso o litro ou a hora estão errados
 * (hora e litro vindos de fontes diferentes, boia do tanque, coluna do export lida errado): o combustível daquela
 * máquina e dia vira "sem leitura" ("—"), nunca um número impossível. Combustível sem nenhuma hora de motor também cai.
 */
export const LIMITE_L_POR_HORA = 90;
export const leituraPossivel = (t: AtividadeDiariaExterna): AtividadeDiariaExterna => {
  if (t.combustivelL <= 0) return t;
  // Com as horas da mesma leitura da ISO, o teste usa elas; sem, usa as horas do rastro, como antes.
  const impossivel = (t.horasMotorLeitura ?? 0) > 0 ? (t.combustivelComHorasL ?? 0) / (t.horasMotorLeitura ?? 1) > LIMITE_L_POR_HORA : t.horas <= 0 || t.combustivelL / t.horas > LIMITE_L_POR_HORA;
  return impossivel ? { ...t, combustivelL: 0, combustivelEstimado: false, combustivelDesde: undefined, combustivelComHorasL: 0, horasMotorLeitura: 0 } : t;
};

/** Máquina sem sinal só entra no texto se deu sinal há pouco: colheitadeira guardada há semanas não é notícia. */
const SEM_SINAL_QUE_IMPORTA_MS = 48 * 3_600_000;

@Injectable()
export class RelatoriosService {
  constructor(
    @Inject(PROVEDOR_MAQUINAS) private readonly provedor: ProvedorMaquinas,
    @Inject(MaquinasService) private readonly maquinas: MaquinasService,
    @Inject(PlanosRepository) private readonly planos: PlanosRepository,
  ) {}

  /**
   * Relatório de um dia, de 7 dias ou de um mês, sempre comparado com o período anterior.
   * `data` (AAAA-MM-DD) é o dia pedido, o último dos 7 dias ou um dia do mês; sem ela vale hoje.
   * Toda conta é feita aqui; o texto do resumo só descreve estes números.
   */
  /** Pedidos iguais ao mesmo tempo (ou em até 10 s) dividem a mesma conta: trocar de dia de ida e volta não refaz nada. */
  private readonly recentes = new Map<string, { ate: number; relatorio: Promise<Relatorio> }>();

  /** `maquinaIds`: só essas máquinas entram na conta (totais, comparação, gráficos e resumo); sem ele, a fazenda inteira. */
  montar(orgId: string, periodo: Periodo, data?: string, agora = new Date(), maquinaIds?: string[]): Promise<Relatorio> {
    const chave = `${orgId}|${periodo}|${data ?? diaLocal(agora)}|${maquinaIds ? [...maquinaIds].sort().join(',') : ''}`;
    const guardado = this.recentes.get(chave);
    if (guardado && guardado.ate > Date.now()) return guardado.relatorio;
    for (const [k, v] of this.recentes) if (v.ate <= Date.now()) this.recentes.delete(k);
    const relatorio = this.calcular(orgId, periodo, data, agora, maquinaIds).catch((e) => {
      this.recentes.delete(chave);
      throw e;
    });
    this.recentes.set(chave, { ate: Date.now() + 10_000, relatorio });
    return relatorio;
  }

  private async calcular(orgId: string, periodo: Periodo, data: string | undefined, agora: Date, maquinaIds?: string[]): Promise<Relatorio> {
    const hoje = diaLocal(agora);
    const { atuais, anteriores, emAndamento } = intervalosDo(periodo, data ?? hoje, hoje);
    const todas = await this.maquinas.listar(orgId, agora);
    const maquinas = maquinaIds ? todas.filter((m) => maquinaIds.includes(m.id)) : todas;
    if (maquinaIds && maquinas.length === 0) throw new NotFoundException({ codigo: 'MAQUINA_NAO_ENCONTRADA', mensagem: 'Nenhuma das máquinas escolhidas existe nesta fazenda.' });
    const nomeDaFazenda = this.provedor.nomeDaFazenda ? await this.provedor.nomeDaFazenda(orgId) : (await this.provedor.resumoDaFazenda(orgId)).nome;

    const diasDe = (maquinaId: string, lista: string[]) => Promise.all(lista.map(async (dia) => leituraPossivel(await this.provedor.atividadeNoDia(orgId, maquinaId, dia))));
    const [porMaquina, planos] = await Promise.all([
      Promise.all(
        maquinas.map(async (maquina) => {
          const dias = await diasDe(maquina.id, atuais);
          return { maquina, dias, atual: dias.reduce(somar, ZERO), anterior: (await diasDe(maquina.id, anteriores)).reduce(somar, ZERO) };
        }),
      ),
      this.planos.operacoes(orgId),
    ]);

    // Hectares por operação: a área de cada máquina em cada dia vai para a operação do plano que valia naquele dia.
    const areaPorOperacao = new Map<Operacao | null, number>();
    if (planos.length > 0) {
      for (const { maquina, dias } of porMaquina) {
        dias.forEach((atividade, i) => {
          if (atividade.areaHa <= 0) return;
          // `planos` vem do início mais recente para o mais antigo: o primeiro que já tinha começado é o que valia.
          const plano = planos.find((p) => p.dataInicio <= atuais[i]! && p.maquinaIds.includes(maquina.id));
          const operacao = plano?.operacao ?? null;
          areaPorOperacao.set(operacao, (areaPorOperacao.get(operacao) ?? 0) + atividade.areaHa);
        });
      }
    }
    const porOperacao = [...areaPorOperacao]
      .map(([operacao, areaHa]) => ({ operacao, areaHa: arredondar(areaHa) }))
      .filter((o) => o.areaHa > 0)
      // Operações com plano primeiro (da maior para a menor); "sem plano" por último.
      .sort((a, b) => Number(a.operacao === null) - Number(b.operacao === null) || b.areaHa - a.areaHa);

    const porDia = await Promise.all(
      atuais.map(async (dia) => {
        const total = (await Promise.all(maquinas.map(async (m) => leituraPossivel(await this.provedor.atividadeNoDia(orgId, m.id, dia))))).reduce(somar, ZERO);
        return { dia, areaHa: arredondar(total.areaHa), horas: arredondar(total.horas), paradoMin: Math.round(total.paradoMin), litros: total.combustivelL > 0 ? Math.round(total.combustivelL) : null };
      }),
    );
    const atual = porMaquina.map((m) => m.atual).reduce(somar, ZERO);
    const anterior = porMaquina.map((m) => m.anterior).reduce(somar, ZERO);
    const maisParada = [...porMaquina].sort((a, b) => b.atual.paradoMin - a.atual.paradoMin)[0];
    const maiorParada =
      maisParada && maisParada.atual.paradoMin > 0
        ? { maquinaId: maisParada.maquina.id, maquinaNome: maisParada.maquina.nome, minutos: Math.round(maisParada.atual.paradoMin), talhaoNome: maisParada.maquina.talhaoNome }
        : null;

    const dados = {
      periodo,
      indicadores: {
        areaHa: { valor: arredondar(atual.areaHa), anterior: arredondar(anterior.areaHa) },
        areaForaDosTalhoesHa: arredondar(Math.min(atual.areaHa, atual.areaForaDosTalhoesHa ?? 0)),
        horas: { valor: arredondar(atual.horas), anterior: arredondar(anterior.horas) },
        consumoLPorHa: { valor: litrosPorHa(atual), anterior: litrosPorHa(anterior) },
        consumoLPorHora: { valor: litrosPorHora(atual), anterior: litrosPorHora(anterior) },
        paradoMin: { valor: Math.round(atual.paradoMin), anterior: Math.round(anterior.paradoMin) },
        litros: { valor: atual.combustivelL > 0 ? Math.round(atual.combustivelL) : null, anterior: anterior.combustivelL > 0 ? Math.round(anterior.combustivelL) : null },
      },
      combustivelEstimado: atual.combustivelL > 0 && !!atual.combustivelEstimado,
      combustivelDesde: atual.combustivelL > 0 ? (atual.combustivelDesde ?? null) : null,
      maiorParada,
      porDia,
      porOperacao,
      // Só os tratores operantes: com atividade no período ou trabalhando agora. Parado na garagem não entra.
      porMaquina: porMaquina
        .filter(({ maquina, atual: t }) => t.areaHa > 0 || t.horas > 0 || t.paradoMin > 0 || maquina.status === 'trabalhando')
        .map(({ maquina, atual: total }) => ({ maquinaId: maquina.id, nome: maquina.nome, areaHa: arredondar(total.areaHa), horas: arredondar(total.horas), litros: total.combustivelL > 0 ? Math.round(total.combustivelL) : null, consumoLPorHa: litrosPorHa(total), consumoLPorHora: litrosPorHora(total), litrosEstimados: total.combustivelL > 0 && !!total.combustivelEstimado, paradoMin: Math.round(total.paradoMin), destaque: maquina.id === maiorParada?.maquinaId }))
        // Quem mais trabalhou primeiro: por horas (sempre existem); a área desempata.
        .sort((a, b) => b.horas - a.horas || b.areaHa - a.areaHa),
    };

    return {
      ...dados,
      fazendaNome: nomeDaFazenda,
      soMaquinas: maquinaIds ? maquinas.map((m) => ({ maquinaId: m.id, nome: m.nome })) : null,
      inicio: atuais[0]!,
      fim: atuais.at(-1)!,
      anteriorInicio: anteriores[0]!,
      anteriorFim: anteriores.at(-1)!,
      // Máquina sem sinal só importa para quem olha o período em andamento.
      resumo: escreverResumo({ ...dados, inicio: atuais[0]!, fim: atuais.at(-1)!, emAndamento, dias: atuais.length, semSinal: emAndamento ? maquinas.filter((m) => m.status === 'sem-sinal' && agora.getTime() - Date.parse(m.ultimoSinal) < SEM_SINAL_QUE_IMPORTA_MS).map((m) => m.nome) : [] }),
    };
  }
}
