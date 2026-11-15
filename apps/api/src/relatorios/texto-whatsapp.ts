import { emojiDaMaquina, type Periodo, type Relatorio } from '@talhio/shared';

const TITULO: Record<Periodo, string> = { dia: 'Relatório do dia', semana: 'Relatório da semana', mes: 'Relatório do mês' };
const numero = (valor: number, casas = 0) => valor.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
const data = (dia: string, opcoes: Intl.DateTimeFormatOptions) => new Date(`${dia}T12:00:00-03:00`).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', ...opcoes });
const maiuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

function duracao(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = Math.round(minutos % 60);
  return h === 0 ? `${m} min` : m === 0 ? `${h} h` : `${h}h${String(m).padStart(2, '0')}`;
}

function periodo(r: Relatorio): string {
  if (r.periodo === 'dia') return maiuscula(data(r.fim, { weekday: 'long', day: 'numeric', month: 'long' }));
  if (r.periodo === 'mes') return maiuscula(data(r.inicio, { month: 'long', year: 'numeric' }));
  return `${data(r.inicio, { day: 'numeric', month: 'long' })} a ${data(r.fim, { day: 'numeric', month: 'long' })}`;
}

/**
 * O relatório em texto para o grupo do WhatsApp (vai como legenda do PDF). Só escreve números que o
 * `RelatoriosService` já calculou; combustível sem leitura fica de fora, nunca vira zero.
 */
export function textoDoRelatorioParaWhatsapp(r: Relatorio): string {
  const { areaHa, horas, litros, consumoLPorHa, consumoLPorHora, paradoMin } = r.indicadores;
  const consumo = consumoLPorHa.valor !== null ? ` (${numero(consumoLPorHa.valor, 1)} L/ha)` : consumoLPorHora.valor !== null ? ` (${numero(consumoLPorHora.valor, 1)} L/h)` : '';
  const comArea = r.porMaquina.filter((m) => m.areaHa > 0);
  return [
    `📋 *${TITULO[r.periodo]} · ${r.fazendaNome}*`,
    `📅 ${periodo(r)}`,
    ...(r.soMaquinas ? [`🚜 Só: ${r.soMaquinas.map((m) => m.nome).join(', ')}`] : []),
    '',
    r.resumo,
    '',
    `🌱 Área trabalhada: ${numero(areaHa.valor, 1)} ha`,
    `⏱️ Horas de máquina: ${numero(horas.valor, 1)} h`,
    ...(litros.valor !== null ? [r.combustivelEstimado ? `⛽ Combustível (estimado pelo tanque): cerca de ${numero(litros.valor)} L${consumo}` : `⛽ Combustível${r.combustivelDesde ? ` (a partir das ${r.combustivelDesde})` : ''}: ${numero(litros.valor)} L${consumo}`] : []),
    `⏸️ Tempo parado: ${duracao(paradoMin.valor)}`,
    ...(comArea.length ? ['', '*Hectares por máquina*', ...comArea.map((m) => `${emojiDaMaquina(m.nome)} ${m.nome}: ${numero(m.areaHa, 1)} ha`)] : []),
  ].join('\n');
}
