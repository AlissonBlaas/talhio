/**
 * Alertas que a máquina registra (GET /machines/{id}/alerts): códigos de diagnóstico (DTC), cerca eletrônica e
 * manutenção. `time` é a hora em que a máquina registrou. Só o que o Talhio usa para avisar.
 */
export interface AlertaDaMaquina {
  id: string;
  /** ISO, a hora do alerta. */
  quando: string;
  /** HIGH vira alta, MEDIUM vira media, LOW vira baixa; o resto (INFO, NONE, DTC...) é só informativo. */
  severidade: 'alta' | 'media' | 'baixa' | 'info';
  descricao: string;
  reconhecido: boolean;
  ocorrencias: number;
}

type Bruto = {
  id?: string | number;
  time?: string;
  severity?: string;
  color?: string;
  acknowledgementStatus?: string;
  ignored?: boolean;
  invisible?: boolean;
  occurrences?: string | number;
  definition?: { description?: string; threeLetterAcronym?: string; suspectParameterName?: string; failureModeIndicator?: string };
};

const SEVERIDADE: Record<string, AlertaDaMaquina['severidade']> = { HIGH: 'alta', MEDIUM: 'media', LOW: 'baixa' };
const COR: Record<string, AlertaDaMaquina['severidade']> = { RED: 'alta', YELLOW: 'media' };

/** Texto da falha, sem espaços repetidos; sem descrição, o código (ex.: "AIC 524019.31"). */
function descricaoDe(a: Bruto): string {
  const d = a.definition;
  const texto = (d?.description ?? '').replace(/\s+/g, ' ').trim();
  if (texto) return texto;
  const codigo = [d?.threeLetterAcronym, d?.suspectParameterName && d?.failureModeIndicator ? `${d.suspectParameterName}.${d.failureModeIndicator}` : d?.suspectParameterName].filter(Boolean).join(' ');
  return codigo || 'Falha registrada pela máquina';
}

/** Lê a lista de alertas. Alerta escondido (`invisible`) ou ignorado pela Deere não entra; sem id ou hora, também não. */
export function lerAlertas(valores: unknown): AlertaDaMaquina[] {
  if (!Array.isArray(valores)) return [];
  const saida: AlertaDaMaquina[] = [];
  for (const v of valores as Bruto[]) {
    if (!v || v.id === undefined || !v.time || !Number.isFinite(Date.parse(v.time))) continue;
    if (v.invisible === true || v.ignored === true) continue;
    saida.push({
      id: String(v.id),
      quando: new Date(Date.parse(v.time)).toISOString(),
      severidade: SEVERIDADE[(v.severity ?? '').toUpperCase()] ?? COR[(v.color ?? '').toUpperCase()] ?? 'info',
      descricao: descricaoDe(v),
      reconhecido: (v.acknowledgementStatus ?? 'N').toUpperCase() === 'Y',
      ocorrencias: Number(v.occurrences) > 0 ? Number(v.occurrences) : 1,
    });
  }
  return saida.sort((a, b) => a.quando.localeCompare(b.quando));
}
