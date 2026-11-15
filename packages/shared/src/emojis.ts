import type { Operacao } from './talhoes';

/** Emoji da máquina nas mensagens do WhatsApp, pelo nome ("Colheitadeira S760", "Pulverizador 4730"...). */
export function emojiDaMaquina(nome: string): string {
  if (/colh/i.test(nome)) return '🌾';
  if (/pulver/i.test(nome)) return '💦';
  return '🚜';
}

const DA_OPERACAO: Record<Operacao, string> = { plantio: '🌱', pulverizacao: '💦', adubacao: '🧪', colheita: '🌾' };

export const emojiDaOperacao = (operacao: Operacao): string => DA_OPERACAO[operacao];

/** Emoji de uma tarefa escrita ("Plantio de soja", "Pulverização"); vazio quando não reconhece. */
export function emojiDaTarefa(tarefa: string): string {
  if (/plant/i.test(tarefa)) return '🌱';
  if (/pulver/i.test(tarefa)) return '💦';
  if (/adub/i.test(tarefa)) return '🧪';
  if (/colh/i.test(tarefa)) return '🌾';
  return '';
}
