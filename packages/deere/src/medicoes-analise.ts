/** Os tipos seguem o contrato `AnaliseDaMaquina` do @talhio/shared (este pacote não depende dele; o backend repassa). */
export interface ItemDaAnalise {
  id: string;
  nome: string;
  unidade: string;
  tipo: 'valor' | 'faixas';
  valor: number | null;
  faixas: { rotulo: string; valor: number | null }[];
  agregacao: 'soma' | 'media' | 'ultimo' | 'maximo' | 'minimo';
}
export interface GrupoDaAnalise {
  id: string;
  nome: string;
  itens: ItemDaAnalise[];
}
export interface AnaliseDaMaquina {
  maquinaId: string;
  de: string;
  ate: string;
  grupos: GrupoDaAnalise[];
}

/**
 * "Todos os dados" da máquina a partir das Machine Measurements: o que o Analisador da Máquina do Operations Center
 * mostra. Agrupa como lá (`axesGroup`), traduz os nomes que conhecemos e põe as unidades em algo legível
 * (segundos viram horas; "litros·s/h" vira litros). Medição que a Deere esconde no Operations Center
 * (`OpsCenterExcluded`: dados de calibração e histogramas internos) não entra.
 */

type Balde = { value?: number; sequenceNumber?: string | number };
type Definicao = {
  id?: string;
  name?: string;
  unitOfMeasure?: string;
  measurementType?: { value?: string };
  aggregationType?: { value?: string };
  axesGroup?: { value?: string; priority?: number };
  uiVisibleIndicator?: string;
  bucketDefinitions?: { bucketDefinitions?: { description?: string; sequenceNumber?: string | number; minimumValue?: number }[] };
};
type Medicao = { machineMeasurementDefinition?: Definicao; series?: { intervals?: { buckets?: { buckets?: Balde[] } }[] } };

const GRUPOS: Record<string, string> = {
  'Engine Information': 'Motor',
  'Fuel Information': 'Combustível',
  'Guidance Track Utilization': 'Pista de orientação do AutoTrac™',
  'Hitch Settings': 'Configurações do engate',
  'Machine Utilization by Machine State': 'Uso da máquina por estado',
  NoAxesGroup: 'Sistema elétrico',
  'On Time': 'Tempo ligado',
  'SCV Settings (251=Continuous)': 'Válvulas hidráulicas (SCV)',
  'Spin Control': 'Patinagem das rodas',
  'StarFire Differential Corrections': 'Correção diferencial do StarFire™',
  'StarFire Receiver Accuracy': 'Precisão do receptor StarFire™',
  'StarFire Receiver Signal Strength': 'Intensidade do sinal do StarFire™',
  Temperatures: 'Temperaturas',
  'Transmission Setting': 'Transmissão',
};

const NOMES: Record<string, string> = {
  'FieldCruise™ Selected Engine Speed': 'Rotação do motor no FieldCruise™',
  'Avg Fuel Rate': 'Taxa média de combustível',
  'Period Fuel Consumed': 'Combustível consumido no período',
  'Fuel Tank Level': 'Nível do tanque de combustível',
  'AutoTrac™ Guidance Track': 'Pista de orientação do AutoTrac™',
  'Rear Hitch Upper Set Limit': 'Limite superior do engate traseiro',
  'Rear Hitch Drop Rate': 'Taxa de descida do engate traseiro',
  'Rear Hitch Raise Rate': 'Taxa de subida do engate traseiro',
  'Rear Hitch Operating Depth': 'Profundidade de operação do engate traseiro',
  'Average Engine Speed': 'Rotação média do motor',
  'Fuel Consumed': 'Combustível consumido',
  'Avg Ground Speed': 'Velocidade média de avanço',
  'Machine Utilization': 'Utilização da máquina',
  'Avg Engine Load Factor': 'Fator de carga médio do motor',
  'Avg System Voltage': 'Tensão média do sistema',
  'Rear PTO': 'TDP traseira',
  'StarFire™ 6000 Machine Receiver': 'Receptor da máquina StarFire™ 6000',
  'Diff Lock': 'Bloqueio do diferencial',
  'Wheel Slip Time at Level': 'Tempo de patinagem das rodas por nível',
  'Machine StarFire™ Differential Correction': 'Correção diferencial do StarFire™',
  'Machine StarFire™ Receiver Accuracy': 'Precisão do receptor StarFire™',
  'Machine StarFire™ Signal Strength': 'Intensidade do sinal do StarFire™',
  'Max Coolant Temp': 'Temp. máxima do líquido de arrefecimento',
  'Avg Coolant Temp': 'Temp. média do líquido de arrefecimento',
  'Maximum Hydraulic Oil Temperature': 'Temperatura máxima do óleo hidráulico',
  'Average Hydraulic Oil Temperature': 'Temperatura média do óleo hidráulico',
  'Max Trans Oil Temp': 'Temp. máxima do óleo da transmissão',
  'Avg Trans Oil Temp': 'Temp. média do óleo da transmissão',
  'Efficiency Manager™ On Time': 'Tempo de ativação do Efficiency Manager™',
};

const FAIXAS: Record<string, string> = {
  Idle: 'Ocioso',
  Working: 'Em operação',
  Transport: 'Transporte',
  On: 'Ligado',
  Off: 'Desligado',
  Manual: 'Manual',
  Auto: 'Automático',
  'Boundary Track': 'Pista de limite',
  'Circle Track': 'Pista circular',
  'Curve Track': 'Pista curva',
  'Straight Track': 'Pista reta',
  'No Differential Corrections': 'Sem correção diferencial',
  'Satellite Based Augmentation System': 'Correção por satélite (SBAS)',
};

const UNIDADES: Record<string, string> = { prcnt: '%', C: '°C', 'l/hr': 'L/h', 'km/hr': 'km/h', RPM: 'rpm', V: 'V', kPa: 'kPa', hr: 'h', deg: '°' };

/** Nome em português: dicionário e, para as válvulas hidráulicas, o padrão "SCV<n> <tipo>". */
export function nomeEmPortugues(nome: string): string {
  const limpo = nome.trim();
  if (NOMES[limpo]) return NOMES[limpo]!;
  const scv = /^SCV(\d+) (Extend Flow|Retract Flow|Detent Time)$/.exec(limpo);
  if (scv) return `${{ 'Extend Flow': 'Fluxo de extensão', 'Retract Flow': 'Fluxo de retração', 'Detent Time': 'Tempo de retenção' }[scv[2]!]} da SCV${scv[1]}`;
  return limpo;
}

const AGREGACAO: Record<string, ItemDaAnalise['agregacao']> = { SUM: 'soma', WEIGHTED_AVERAGE: 'media', AVERAGE: 'media', LAST: 'ultimo', MAX: 'maximo', MIN: 'minimo' };

const arredondar = (n: number, casas = 2) => Math.round(n * 10 ** casas) / 10 ** casas;

/** Converte o valor bruto da Deere e devolve a unidade legível: segundos em horas, "l sec/hr" em litros. */
function converter(valor: number, unidade: string | undefined): { valor: number; unidade: string } {
  const u = (unidade ?? '').trim();
  if (u === 'sec') return { valor: arredondar(valor / 3600), unidade: 'h' };
  if (u === 'l sec/hr') return { valor: arredondar(valor / 3600), unidade: 'L' };
  return { valor: arredondar(valor), unidade: UNIDADES[u] ?? '' };
}

/**
 * Lê a resposta com a lista de medições (de um período inteiro, `interval=aggregated`, com `embed=measurementDefinition`).
 * Os grupos saem na ordem de prioridade que a Deere dá; dentro de cada um, na ordem da resposta.
 */
export function lerAnaliseDaMaquina(maquinaId: string, de: string, ate: string, resposta: unknown): AnaliseDaMaquina {
  const valores = ((resposta as { values?: Medicao[] } | null)?.values ?? []).filter((m) => m.machineMeasurementDefinition?.uiVisibleIndicator !== 'N');
  const grupos = new Map<string, { prioridade: number; grupo: GrupoDaAnalise }>();
  for (const m of valores) {
    const def = m.machineMeasurementDefinition;
    if (!def?.name || !def.id) continue;
    const nomeGrupo = def.axesGroup?.value ?? 'NoAxesGroup';
    if (nomeGrupo === 'OpsCenterExcluded') continue;
    const baldes = m.series?.intervals?.[0]?.buckets?.buckets ?? [];
    if (baldes.length === 0) continue;
    // Vetor de um balde só (ex.: combustível consumido no período) é um valor simples.
    const vetor = def.measurementType?.value === 'Vector' && baldes.length > 1;
    const base = { id: def.id, nome: nomeEmPortugues(def.name), agregacao: AGREGACAO[def.aggregationType?.value ?? ''] ?? 'ultimo' };
    let item: ItemDaAnalise;
    if (vetor) {
      const definicoes = def.bucketDefinitions?.bucketDefinitions ?? [];
      const faixas = baldes
        .map((b) => {
          const d = definicoes.find((x) => String(x.sequenceNumber) === String(b.sequenceNumber));
          const rotulo = (d?.description ?? String(b.sequenceNumber)).trim();
          return { rotulo: FAIXAS[rotulo] ?? rotulo, ordem: d?.minimumValue ?? Number(b.sequenceNumber) ?? 0, bruto: b.value };
        })
        .sort((a, b) => a.ordem - b.ordem);
      const unidade = converter(0, def.unitOfMeasure).unidade;
      item = {
        ...base,
        unidade,
        tipo: 'faixas',
        valor: null,
        faixas: faixas.map((f) => ({ rotulo: f.rotulo, valor: typeof f.bruto === 'number' && Number.isFinite(f.bruto) ? converter(f.bruto, def.unitOfMeasure).valor : null })),
      };
    } else {
      const bruto = baldes[0]?.value;
      const conv = converter(typeof bruto === 'number' && Number.isFinite(bruto) ? bruto : 0, def.unitOfMeasure);
      item = { ...base, unidade: conv.unidade, tipo: 'valor', valor: typeof bruto === 'number' && Number.isFinite(bruto) ? conv.valor : null, faixas: [] };
    }
    const atual = grupos.get(nomeGrupo) ?? { prioridade: def.axesGroup?.priority ?? 1000, grupo: { id: nomeGrupo, nome: GRUPOS[nomeGrupo] ?? nomeGrupo, itens: [] } };
    atual.grupo.itens.push(item);
    grupos.set(nomeGrupo, atual);
  }
  return {
    maquinaId,
    de,
    ate,
    grupos: [...grupos.values()].sort((a, b) => a.prioridade - b.prioridade).map((g) => g.grupo),
  };
}
