/**
 * Machine Measurements da John Deere (GET /machines/{id}/machineMeasurements): o que o Analisador da Máquina do
 * Operations Center mostra, por máquina e por dia. Aqui só o que o Talhio usa: combustível consumido e utilização
 * (tempo com o motor ligado) por estado da máquina.
 *
 * Conferido contra o Operations Center e o export CSV (8270R - 29, 5 a 12/11/2026): os litros de cada dia batem ao
 * centésimo.
 *   - "Fuel Consumed" vem em `l sec/hr` (litros x segundos por hora): litros = valor / 3600.
 *   - "Machine Utilization" vem em `sec`: horas = valor / 3600.
 *   - Cada balde (bucket) é um estado: 0 = Idle (ocioso), 1 = Working (trabalhando), 2 = Transport.
 */

/** Consumo e uso de uma máquina num dia (no horário de Brasília). Estado sem leitura fica em 0. */
export interface ConsumoDoDia {
  /** AAAA-MM-DD, no fuso usado na consulta. */
  dia: string;
  litros: number;
  litrosTrabalhando: number;
  litrosOcioso: number;
  litrosTransporte: number;
  /** Horas de motor ligado no dia (trabalhando + ocioso + transporte), da mesma leitura dos litros. */
  horasMotor: number;
  horasTrabalhando: number;
  horasOcioso: number;
  horasTransporte: number;
}

export const NOME_COMBUSTIVEL = 'Fuel Consumed';
export const NOME_UTILIZACAO = 'Machine Utilization';

type Balde = { value?: number; sequenceNumber?: string | number };
type Intervalo = { intervalStartDate?: string; buckets?: { buckets?: Balde[] } };
type Medicao = {
  machineMeasurementDefinition?: {
    id?: string;
    name?: string;
    unitOfMeasure?: string;
    bucketDefinitions?: { bucketDefinitions?: { description?: string; sequenceNumber?: string | number }[] };
  };
  series?: { level?: string; intervals?: Intervalo[] };
};
type Resposta = { values?: Medicao[] };

const arredondar = (n: number, casas = 2) => Math.round(n * 10 ** casas) / 10 ** casas;

/** Os ids das medições (mudam por marca, tipo e modelo da máquina; o nome é o mesmo). */
export function acharIdsDeMedicao(resposta: unknown): { combustivel: string | null; utilizacao: string | null } {
  const valores = (resposta as Resposta | null)?.values ?? [];
  const id = (nome: string) => valores.find((v) => v.machineMeasurementDefinition?.name?.trim() === nome)?.machineMeasurementDefinition?.id ?? null;
  return { combustivel: id(NOME_COMBUSTIVEL), utilizacao: id(NOME_UTILIZACAO) };
}

type Estado = 'ocioso' | 'trabalhando' | 'transporte';

/** O estado de cada balde, pela descrição que a Deere manda (e, sem ela, pela ordem: 0, 1, 2). */
function estadoDoBalde(medicao: Medicao, sequencia: string | number | undefined): Estado | null {
  const seq = String(sequencia);
  const descricao = medicao.machineMeasurementDefinition?.bucketDefinitions?.bucketDefinitions?.find((d) => String(d.sequenceNumber) === seq)?.description?.toLowerCase();
  if (descricao) {
    if (descricao.includes('idle')) return 'ocioso';
    if (descricao.includes('work')) return 'trabalhando';
    if (descricao.includes('transp')) return 'transporte';
    return null;
  }
  return seq === '0' ? 'ocioso' : seq === '1' ? 'trabalhando' : seq === '2' ? 'transporte' : null;
}

/** AAAA-MM-DD do início do intervalo no fuso pedido (`deslocamentoHoras`, ex.: -3 para Brasília). */
function diaLocal(inicioIso: string, deslocamentoHoras: number): string | null {
  const t = Date.parse(inicioIso);
  if (!Number.isFinite(t)) return null;
  return new Date(t + deslocamentoHoras * 3_600_000).toISOString().slice(0, 10);
}

/**
 * Lê uma resposta com baldes DIÁRIOS (pedido de mais de 1 e menos de 31 dias, com `utcOffSet`) e devolve um registro
 * por dia. Só aceita os baldes na unidade esperada: se a Deere mudar a unidade, devolve vazio em vez de números
 * errados. Dia que não veio na resposta (máquina sem dado) não aparece: não é zero litro.
 */
export function lerConsumoDiario(resposta: unknown, deslocamentoHoras = -3): ConsumoDoDia[] {
  const valores = (resposta as Resposta | null)?.values ?? [];
  const combustivel = valores.find((v) => v.machineMeasurementDefinition?.name?.trim() === NOME_COMBUSTIVEL);
  const utilizacao = valores.find((v) => v.machineMeasurementDefinition?.name?.trim() === NOME_UTILIZACAO);
  if (!combustivel || !utilizacao) return [];
  if (!combustivel.machineMeasurementDefinition?.unitOfMeasure?.toLowerCase().includes('sec')) return [];
  if (utilizacao.machineMeasurementDefinition?.unitOfMeasure?.trim().toLowerCase() !== 'sec') return [];
  if (combustivel.series?.level !== 'daily' || utilizacao.series?.level !== 'daily') return [];

  const dias = new Map<string, ConsumoDoDia>();
  const dia = (d: string) => {
    let c = dias.get(d);
    if (!c) dias.set(d, (c = { dia: d, litros: 0, litrosTrabalhando: 0, litrosOcioso: 0, litrosTransporte: 0, horasMotor: 0, horasTrabalhando: 0, horasOcioso: 0, horasTransporte: 0 }));
    return c;
  };
  for (const intervalo of combustivel.series?.intervals ?? []) {
    const d = diaLocal(intervalo.intervalStartDate ?? '', deslocamentoHoras);
    if (!d) continue;
    const c = dia(d);
    for (const b of intervalo.buckets?.buckets ?? []) {
      const estado = estadoDoBalde(combustivel, b.sequenceNumber);
      if (!estado || typeof b.value !== 'number' || !Number.isFinite(b.value)) continue;
      const litros = b.value / 3600;
      if (estado === 'trabalhando') c.litrosTrabalhando += litros;
      else if (estado === 'ocioso') c.litrosOcioso += litros;
      else c.litrosTransporte += litros;
    }
  }
  for (const intervalo of utilizacao.series?.intervals ?? []) {
    const d = diaLocal(intervalo.intervalStartDate ?? '', deslocamentoHoras);
    if (!d) continue;
    const c = dia(d);
    for (const b of intervalo.buckets?.buckets ?? []) {
      const estado = estadoDoBalde(utilizacao, b.sequenceNumber);
      if (!estado || typeof b.value !== 'number' || !Number.isFinite(b.value)) continue;
      const horas = b.value / 3600;
      if (estado === 'trabalhando') c.horasTrabalhando += horas;
      else if (estado === 'ocioso') c.horasOcioso += horas;
      else c.horasTransporte += horas;
    }
  }
  return [...dias.values()]
    .map((c) => {
      const litros = c.litrosTrabalhando + c.litrosOcioso + c.litrosTransporte;
      const horas = c.horasTrabalhando + c.horasOcioso + c.horasTransporte;
      return {
        dia: c.dia,
        litros: arredondar(litros),
        litrosTrabalhando: arredondar(c.litrosTrabalhando),
        litrosOcioso: arredondar(c.litrosOcioso),
        litrosTransporte: arredondar(c.litrosTransporte),
        horasMotor: arredondar(horas),
        horasTrabalhando: arredondar(c.horasTrabalhando),
        horasOcioso: arredondar(c.horasOcioso),
        horasTransporte: arredondar(c.horasTransporte),
      };
    })
    .filter((c) => c.litros > 0 || c.horasMotor > 0)
    .sort((a, b) => a.dia.localeCompare(b.dia));
}
