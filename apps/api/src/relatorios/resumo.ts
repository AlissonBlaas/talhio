import type { Relatorio } from '@talhio/shared';

type Dados = Pick<Relatorio, 'periodo' | 'indicadores' | 'maiorParada' | 'porMaquina'> & {
  porOperacao?: Relatorio['porOperacao'];
  /** Primeiro e último dia do período (AAAA-MM-DD). Opcionais: sem eles, o texto fala de "hoje". */
  inicio?: string;
  fim?: string;
  /** O período termina hoje? Padrão: sim. */
  emAndamento?: boolean;
  /** Quantos dias tem o período. Padrão: 1 no dia, 7 na semana. */
  dias?: number;
  /** Máquinas sem sinal agora: o dado delas pode estar incompleto. */
  semSinal: string[];
};

const numero = (valor: number, casas = 0) => valor.toLocaleString('pt-BR', { maximumFractionDigits: casas });

function duracao(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = Math.round(minutos % 60);
  return h === 0 ? `${m} min` : m === 0 ? `${h} h` : `${h}h${String(m).padStart(2, '0')}`;
}

/** "9% a mais que ontem", "3% a menos que ontem" ou "o mesmo que ontem". */
function comparar(valor: number, anterior: number, referencia: string): string | null {
  if (anterior <= 0) return null;
  const pct = Math.round(((valor - anterior) / anterior) * 100);
  if (pct === 0) return `o mesmo que ${referencia}`;
  return `${Math.abs(pct)}% a ${pct > 0 ? 'mais' : 'menos'} que ${referencia}`;
}

/** Área pequena leva uma casa decimal. */
const casas = (v: number) => (v < 10 ? 1 : 0);
const NOME_DA_OPERACAO = { plantio: 'plantio', pulverizacao: 'pulverização', adubacao: 'adubação', colheita: 'colheita' } as const;
const juntar = (partes: string[]) => (partes.length <= 1 ? (partes[0] ?? '') : `${partes.slice(0, -1).join(', ')} e ${partes.at(-1)}`);

/** Parada só entra no texto quando passa disso (a soma do dia, ou a média diária nos outros períodos). */
const PARADA_QUE_IMPORTA_MIN = 45;

const dataLonga = (dia: string) => new Date(`${dia}T12:00:00Z`).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', timeZone: 'UTC' });
const nomeDoMes = (dia: string) => new Date(`${dia}T12:00:00Z`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' });

/** Como o texto chama o período e a base de comparação. */
function nomes(dados: Dados, emAndamento: boolean) {
  const fim = dados.fim ?? '';
  if (dados.periodo === 'dia') {
    return emAndamento
      ? { quando: 'Hoje foram', vazio: 'Hoje ainda não há área trabalhada registrada.', contra: 'ontem' }
      : { quando: `Em ${dataLonga(fim)} foram`, vazio: `Não há área trabalhada registrada em ${dataLonga(fim)}.`, contra: 'o dia anterior' };
  }
  if (dados.periodo === 'semana') {
    return emAndamento
      ? { quando: 'Nos últimos 7 dias foram', vazio: 'Não há área trabalhada registrada nos últimos 7 dias.', contra: 'nos 7 dias anteriores' }
      : { quando: `Nos 7 dias até ${dataLonga(fim)} foram`, vazio: `Não há área trabalhada registrada nos 7 dias até ${dataLonga(fim)}.`, contra: 'nos 7 dias anteriores' };
  }
  const mes = nomeDoMes(dados.inicio ?? fim);
  return {
    quando: emAndamento ? `Em ${mes}, até hoje, foram` : `Em ${mes} foram`,
    vazio: `Não há área trabalhada registrada em ${mes}.`,
    contra: emAndamento ? 'o mesmo período do mês anterior' : 'o mês anterior',
  };
}

/**
 * Escreve o resumo a partir dos números já calculados.
 * Provisório: texto por modelo fixo. A IA entra aqui depois, recebendo estes mesmos números,
 * e continua sem calcular nada.
 */
export function escreverResumo(dados: Dados): string {
  const dia = dados.periodo === 'dia';
  const emAndamento = dados.emAndamento ?? true;
  const dias = dados.dias ?? (dia ? 1 : 7);
  const nome = nomes(dados, emAndamento);
  const { areaHa } = dados.indicadores;
  const frases: string[] = [];

  if (areaHa.valor <= 0) {
    frases.push(nome.vazio);
  } else {
    const comparacao = comparar(areaHa.valor, areaHa.anterior, nome.contra);
    // Área pequena aparece com uma casa (0,3 ha), senão viraria "0 ha".
    frases.push(`${nome.quando} ${numero(areaHa.valor, areaHa.valor < 10 ? 1 : 0)} ha${comparacao ? `, ${comparacao}` : ''}.`);
  }

  // A área conta em qualquer lugar; o talhão só separa o que foi dentro do que foi fora.
  const fora = dados.indicadores.areaForaDosTalhoesHa ?? 0;
  if (areaHa.valor > 0 && fora > 0) {
    const dentro = Math.max(0, areaHa.valor - fora);
    frases.push(
      dentro > 0
        ? `Desse total, ${numero(dentro, casas(dentro))} ha foram dentro dos talhões e ${numero(fora, casas(fora))} ha fora.`
        : 'Toda essa área foi fora dos talhões que têm contorno no mapa.',
    );
  }

  // Só fala de operação quando algum plano cobre parte da área; "sem plano" sozinho não diz nada.
  const comPlano = (dados.porOperacao ?? []).filter((o) => o.operacao !== null);
  if (comPlano.length > 0) {
    const partes = comPlano.map((o) => `${numero(o.areaHa, casas(o.areaHa))} ha de ${NOME_DA_OPERACAO[o.operacao!]}`);
    const semPlano = (dados.porOperacao ?? []).find((o) => o.operacao === null);
    frases.push(`Pelos planos: ${juntar(partes)}${semPlano ? `; ${numero(semPlano.areaHa, casas(semPlano.areaHa))} ha de máquinas sem plano` : ''}.`);
  }

  const parada = dados.maiorParada;
  if (parada && parada.minutos >= PARADA_QUE_IMPORTA_MIN * dias) {
    const onde = dia && parada.talhaoNome ? ` no ${parada.talhaoNome}` : '';
    frases.push(`O ${parada.maquinaNome} ficou ${duracao(parada.minutos)} parado${onde}${dia ? '' : ' no período, mais que as outras máquinas'}.`);
  }

  if (!dia && dados.porMaquina.length > 1) {
    // A lista vem por horas; quem mais fez área é outra conta. Sem área no período, o destaque é quem mais trabalhou.
    const maisArea = [...dados.porMaquina].sort((x, y) => y.areaHa - x.areaHa)[0]!;
    const maisHoras = [...dados.porMaquina].sort((x, y) => y.horas - x.horas)[0]!;
    if (maisArea.areaHa > 0) frases.push(`Quem mais fez área foi o ${maisArea.nome}, com ${numero(maisArea.areaHa)} ha.`);
    else if (maisHoras.horas > 0) frases.push(`Quem mais trabalhou foi o ${maisHoras.nome}, com ${numero(maisHoras.horas)} h de máquina.`);
  }

  if (dados.semSinal.length > 0) {
    const nomes = dados.semSinal.join(' e ');
    frases.push(
      dados.semSinal.length === 1
        ? `O ${nomes} está sem sinal: os dados dele entram quando reconectar.`
        : dados.semSinal.length <= 3
          ? `${nomes} estão sem sinal: os dados deles entram quando reconectarem.`
          : `${dados.semSinal.length} máquinas que deram sinal nos últimos dias estão sem sinal agora: os dados delas entram quando reconectarem.`,
    );
  }

  return frases.join(' ');
}
