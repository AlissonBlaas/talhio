import { emojiDaMaquina, type Periodo, type Relatorio } from '@talhio/shared';

import { hectares, litros } from '@/shared/lib/format';

const numero = (valor: number, casas = 0) => valor.toLocaleString('pt-BR', { maximumFractionDigits: casas });

export function duracao(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = Math.round(minutos % 60);
  return h === 0 ? `${m} min` : m === 0 ? `${h} h` : `${h}h${String(m).padStart(2, '0')}`;
}

const dataCurta = (dia: string, comMes = true) =>
  new Date(`${dia}T12:00:00`).toLocaleDateString('pt-BR', comMes ? { day: 'numeric', month: 'long' } : { day: 'numeric' });

/** "Terça, 10 de novembro", "7 dias · 4 a 10 de novembro" ou "Novembro de 2026". */
export function rotuloDoPeriodo(relatorio: Relatorio): string {
  if (relatorio.periodo === 'dia') {
    const texto = new Date(`${relatorio.fim}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
    return texto.charAt(0).toUpperCase() + texto.slice(1);
  }
  if (relatorio.periodo === 'mes') {
    const texto = new Date(`${relatorio.inicio}T12:00:00`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    return texto.charAt(0).toUpperCase() + texto.slice(1);
  }
  const mesmoMes = relatorio.inicio.slice(0, 7) === relatorio.fim.slice(0, 7);
  return `7 dias · ${dataCurta(relatorio.inicio, !mesmoMes)} a ${dataCurta(relatorio.fim)}`;
}

export type Indicador = { rotulo: string; valor: string; variacao: string; bom: boolean };

function variacaoPct(valor: number, anterior: number): number | null {
  return anterior > 0 ? Math.round(((valor - anterior) / anterior) * 100) : null;
}
const comSinal = (pct: number) => `${pct > 0 ? '+' : ''}${pct}%`;

/** Os quatro cartões do relatório, já com o texto de comparação e se a mudança é boa ou ruim. */
export function indicadoresDe(relatorio: Relatorio): Indicador[] {
  const { areaHa, horas, consumoLPorHa, consumoLPorHora, paradoMin } = relatorio.indicadores;
  // Por hectare quando a área cobre o trabalho; senão por hora, que sempre faz sentido. Sem leitura de combustível, traço.
  const porHa = consumoLPorHa.valor !== null;
  const consumoMostrado = porHa ? consumoLPorHa : consumoLPorHora;
  const referencia = relatorio.periodo === 'dia' ? 'ontem' : relatorio.periodo === 'mes' ? 'mês anterior' : '7 dias antes';
  const semBase = 'sem comparação';

  const area = variacaoPct(areaHa.valor, areaHa.anterior);
  const hora = variacaoPct(horas.valor, horas.anterior);
  const consumo = consumoMostrado.valor !== null && consumoMostrado.anterior !== null ? variacaoPct(consumoMostrado.valor, consumoMostrado.anterior) : null;
  const diferencaParado = paradoMin.valor - paradoMin.anterior;
  const parada = relatorio.maiorParada;

  return [
    { rotulo: 'Área trabalhada', valor: hectares(areaHa.valor), variacao: area === null ? semBase : `${comSinal(area)} vs ${referencia}`, bom: (area ?? 0) >= 0 },
    { rotulo: 'Horas de máquina', valor: `${numero(horas.valor, horas.valor < 100 ? 1 : 0)} h`, variacao: hora === null ? semBase : `${comSinal(hora)} vs ${referencia}`, bom: (hora ?? 0) >= 0 },
    {
      rotulo: `${porHa || consumoLPorHora.valor === null ? 'Consumo por ha' : 'Consumo por hora'}${relatorio.combustivelEstimado && consumoMostrado.valor !== null ? ' (estimado)' : ''}${relatorio.combustivelDesde && consumoMostrado.valor !== null ? ` (desde ${relatorio.combustivelDesde})` : ''}`,
      valor: consumoMostrado.valor === null ? '—' : `${numero(consumoMostrado.valor, 1)} L`,
      // Consumo menor é melhor.
      variacao: consumoMostrado.valor === null ? 'sem leitura de combustível' : consumo === null ? semBase : consumo === 0 ? 'igual' : `${comSinal(consumo)} (${consumo < 0 ? 'melhor' : 'pior'})`,
      bom: (consumo ?? 0) <= 0,
    },
    {
      rotulo: 'Tempo parado',
      valor: duracao(paradoMin.valor),
      // No dia, diz quem mais parou; na semana, compara com a anterior. Menos tempo parado é melhor.
      variacao:
        relatorio.periodo === 'dia' && parada
          ? `${parada.maquinaNome.replace(/^(Trator|Pulverizador|Colheitadeira)\s+/, '')}: ${duracao(parada.minutos)}`
          : diferencaParado === 0
            ? 'igual'
            : `${diferencaParado > 0 ? '+' : '-'}${duracao(Math.abs(diferencaParado))}`,
      bom: relatorio.periodo === 'dia' ? !parada || parada.minutos < 45 : diferencaParado <= 0,
    },
  ];
}

const TITULO: Record<Periodo, string> = { dia: 'Relatório do dia', semana: 'Relatório da semana', mes: 'Relatório do mês' };

/** O relatório em texto simples, para mandar por WhatsApp. */
export function textoParaCompartilhar(relatorio: Relatorio, fazendaNome?: string): string {
  const linhas = [
    `📋 *${TITULO[relatorio.periodo]}${fazendaNome ? ` · ${fazendaNome}` : ''}*`,
    `📅 ${rotuloDoPeriodo(relatorio)}`,
    ...(relatorio.soMaquinas ? [`🚜 Só: ${relatorio.soMaquinas.map((m) => m.nome).join(', ')}`] : []),
    '',
    relatorio.resumo,
    '',
    ...indicadoresDe(relatorio).map((i, n) => `${['🌱', '⏱️', '⛽', '⏸️'][n]} ${i.rotulo}: ${i.valor} (${i.variacao})`),
    '',
    '*Hectares e combustível por máquina*',
    ...relatorio.porMaquina.map((m) => `${emojiDaMaquina(m.nome)} ${m.nome}: ${hectares(m.areaHa)}${m.litros !== null ? ` · ${litros(m.litros)}` : ''}`),
  ];
  return linhas.join('\n');
}
