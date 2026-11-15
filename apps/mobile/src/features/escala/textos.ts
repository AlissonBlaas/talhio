import { emojiDaMaquina, emojiDaTarefa, type Escala, type EscalaItem, type Turno } from '@talhio/shared';

export const TURNOS: { valor: Turno; rotulo: string }[] = [
  { valor: 'dia-todo', rotulo: 'Dia todo' },
  { valor: 'manha', rotulo: 'Manhã' },
  { valor: 'tarde', rotulo: 'Tarde' },
  { valor: 'noite', rotulo: 'Noite' },
];
export const rotuloDoTurno = (turno: Turno) => TURNOS.find((t) => t.valor === turno)?.rotulo ?? '';

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

/** A escala em texto simples, por máquina, para mandar no grupo da equipe. */
export function textoDaEscala(escala: Escala): string {
  const blocos = itensComOperador(escala).map((item) => {
    const maquina = `${item.maquinaNome}${item.implemento ? ` (${item.implemento})` : ''}`;
    const tarefa = item.tarefa ? `${emojiDaTarefa(item.tarefa)} ${item.tarefa}`.trim() : null;
    const onde = [tarefa, item.talhaoNome ? `📍 ${item.talhaoNome}` : null, item.turno === 'dia-todo' ? null : `🕐 ${rotuloDoTurno(item.turno).toLowerCase()}`].filter(Boolean).join(' · ');
    return [`${emojiDaMaquina(item.maquinaNome)} *${maquina}*: 👤 ${item.operador}`, onde].filter(Boolean).join('\n');
  });
  return [`📋 *Escala de hoje*`, `📅 ${diaPorExtenso(escala.dia)}`, '', blocos.join('\n\n')].join('\n');
}
