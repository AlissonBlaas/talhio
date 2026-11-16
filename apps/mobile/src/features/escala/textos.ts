import { emojiDaMaquina, emojiDaTarefa, type Escala, type EscalaItem, type StatusMaquina, type Turno } from '@talhio/shared';

export const TURNOS: { valor: Turno; rotulo: string }[] = [
  { valor: 'dia-todo', rotulo: 'Dia todo' },
  { valor: 'manha', rotulo: 'Manhã' },
  { valor: 'tarde', rotulo: 'Tarde' },
  { valor: 'noite', rotulo: 'Noite' },
];
export const rotuloDoTurno = (turno: Turno) => TURNOS.find((t) => t.valor === turno)?.rotulo ?? '';

/** Como a máquina está agora, nas palavras da escala. */
export const ROTULO_DO_STATUS: Record<StatusMaquina, string> = { trabalhando: 'Operando', parada: 'Parada', 'sem-sinal': 'Inativa' };

export type MaquinaNaEscala = { maquinaId: string; maquinaNome: string; implemento: string | null; status: StatusMaquina; tipo: EscalaItem['maquinaTipo']; linhas: EscalaItem[] };

const ORDEM_DO_STATUS: StatusMaquina[] = ['trabalhando', 'parada', 'sem-sinal'];

/** As linhas da escala juntas por máquina (uma máquina pode ter um operador por turno). Quem está operando vem primeiro. */
export function porMaquina(escala: Escala): MaquinaNaEscala[] {
  const maquinas = new Map<string, MaquinaNaEscala>();
  for (const item of escala.itens) {
    const maquina = maquinas.get(item.maquinaId) ?? { maquinaId: item.maquinaId, maquinaNome: item.maquinaNome, implemento: item.implemento, status: item.maquinaStatus, tipo: item.maquinaTipo, linhas: [] };
    maquina.linhas.push(item);
    maquinas.set(item.maquinaId, maquina);
  }
  // `sort` é estável: dentro de cada estado fica a ordem que o servidor mandou.
  return [...maquinas.values()].sort((a, b) => ORDEM_DO_STATUS.indexOf(a.status) - ORDEM_DO_STATUS.indexOf(b.status));
}

/** O primeiro turno separado (manhã, tarde, noite) que a máquina ainda não tem. Nulo quando os três já estão ocupados. */
export function turnoLivre(linhas: EscalaItem[]): Turno | null {
  const usados = new Set(linhas.filter((l) => l.operador).map((l) => l.turno));
  return (['manha', 'tarde', 'noite'] as const).find((t) => !usados.has(t)) ?? null;
}

/** Atalhos para o campo "O que vai fazer". O campo aceita qualquer texto. */
export const TAREFAS = ['Plantio', 'Pulverização', 'Adubação', 'Colheita', 'Gradagem', 'Transporte'];

/** "Trator 8R 410" -> "8R 410", como no cartão da escala. */
export const nomeCurto = (maquinaNome: string) => maquinaNome.replace(/^(Trator|Pulverizador|Colheitadeira)\s+/, '');

/** O que a máquina faz hoje: "Maria · Plantio de soja · manhã". Sem operador: "Sem operador". */
export function detalheDoItem(item: EscalaItem): string {
  const partes = [item.operador ?? 'Sem operador', item.tarefa ?? item.implemento];
  if (item.turno !== 'dia-todo') partes.push(rotuloDoTurno(item.turno).toLowerCase());
  return partes.filter(Boolean).join(' · ');
}

export function diaPorExtenso(dia: string): string {
  const texto = new Date(`${dia}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** Quem tem operador entra na mensagem; máquina sem ninguém fica de fora. */
export const itensComOperador = (escala: Escala) => escala.itens.filter((i) => i.operador);

/** A escala em texto simples, por máquina (com um operador por turno, quando há), para mandar no grupo da equipe. */
export function textoDaEscala(escala: Escala): string {
  const blocos = porMaquina({ ...escala, itens: itensComOperador(escala) }).map(({ maquinaNome, implemento, linhas }) => {
    const maquina = `${emojiDaMaquina(maquinaNome)} *${maquinaNome}${implemento ? ` (${implemento})` : ''}*`;
    const detalhe = (item: EscalaItem) => {
      const tarefa = item.tarefa ? `${emojiDaTarefa(item.tarefa)} ${item.tarefa}`.trim() : null;
      return [tarefa, item.talhaoNome ? `📍 ${item.talhaoNome}` : null].filter(Boolean).join(' · ');
    };
    const unica = linhas.length === 1 ? linhas[0]! : null;
    if (unica && unica.turno === 'dia-todo') return [`${maquina}: 👤 ${unica.operador}`, detalhe(unica)].filter(Boolean).join('\n');
    return [maquina, ...linhas.map((item) => [`🕐 ${rotuloDoTurno(item.turno)}: 👤 ${item.operador}`, detalhe(item)].filter(Boolean).join(' · '))].join('\n');
  });
  return [`📋 *Escala de hoje*`, `📅 ${diaPorExtenso(escala.dia)}`, '', blocos.join('\n\n')].join('\n');
}

/**
 * O aviso de uma troca na escala, para o grupo da equipe: quem sai e quem entra em qual máquina e turno.
 * `sai` nulo = turno novo; `entra` nulo = turno tirado da escala.
 */
export function textoDaTroca(troca: { maquinaNome: string; implemento: string | null; turno: Turno; sai: string | null; entra: string | null; tarefa: string | null; talhaoNome: string | null }): string {
  const maquina = `${emojiDaMaquina(troca.maquinaNome)} *${troca.maquinaNome}${troca.implemento ? ` (${troca.implemento})` : ''}* · 🕐 ${rotuloDoTurno(troca.turno)}`;
  const tarefa = troca.tarefa ? `${emojiDaTarefa(troca.tarefa)} ${troca.tarefa}`.trim() : null;
  const onde = [tarefa, troca.talhaoNome ? `📍 ${troca.talhaoNome}` : null].filter(Boolean).join(' · ');
  return ['🔄 *Mudança na escala de hoje*', maquina, troca.sai ? `➖ Sai: ${troca.sai}` : null, troca.entra ? `👤 Entra: ${troca.entra}` : null, troca.entra ? onde : null].filter(Boolean).join('\n');
}
