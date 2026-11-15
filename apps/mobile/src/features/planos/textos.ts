import { emojiDaMaquina, emojiDaOperacao, type Maquina, type Operacao, type Plano, type TipoMaquina, type Turno } from '@talhio/shared';

import { rotuloDoTurno } from '@/features/escala';

import { horaDoDia, siglaTalhao } from '@/shared/lib/format';

export const OPERACOES: { valor: Operacao; rotulo: string; nome: string }[] = [
  { valor: 'plantio', rotulo: 'Plantio', nome: 'Plantio' },
  { valor: 'pulverizacao', rotulo: 'Pulverizar', nome: 'Pulverização' },
  { valor: 'adubacao', rotulo: 'Adubar', nome: 'Adubação' },
  { valor: 'colheita', rotulo: 'Colher', nome: 'Colheita' },
];
export const nomeDaOperacao = (operacao: Operacao) => OPERACOES.find((o) => o.valor === operacao)!.nome;

export const CULTURAS = ['Soja', 'Milho', 'Trigo', 'Feijão', 'Arroz'];

/** Que tipo de máquina faz cada operação. */
export const MAQUINA_DA_OPERACAO: Record<Operacao, TipoMaquina> = { plantio: 'trator', adubacao: 'trator', pulverizacao: 'pulverizador', colheita: 'colheitadeira' };

/** O produto e a unidade da dose mudam com a operação. Colheita não tem produto. */
export const PRODUTO: Record<Operacao, { rotulo: string; exemplo: string; unidade: string } | null> = {
  plantio: { rotulo: 'Adubo', exemplo: 'Ex.: 08-28-16', unidade: 'kg/ha' },
  adubacao: { rotulo: 'Adubo', exemplo: 'Ex.: ureia', unidade: 'kg/ha' },
  pulverizacao: { rotulo: 'Produto', exemplo: 'Ex.: nome do defensivo', unidade: 'L/ha' },
  colheita: null,
};

/** "65.000" ou "2,5" (como se digita no Brasil) -> número. Vazio ou inválido -> nulo. */
export function lerNumero(texto: string): number | null {
  const limpo = texto.trim().replace(/\./g, '').replace(',', '.');
  const valor = Number(limpo);
  return limpo !== '' && Number.isFinite(valor) && valor > 0 ? valor : null;
}

const doisDigitos = (n: number) => String(n).padStart(2, '0');
const paraDia = (data: Date) => `${data.getFullYear()}-${doisDigitos(data.getMonth() + 1)}-${doisDigitos(data.getDate())}`;

/** Os próximos dias para começar: "Hoje", "Amanhã", "qui. 12"... */
export function proximosDias(quantidade = 7, hoje = new Date()): { valor: string; rotulo: string }[] {
  return Array.from({ length: quantidade }, (_, i) => {
    const data = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + i);
    const rotulo = i === 0 ? 'Hoje' : i === 1 ? 'Amanhã' : data.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric' });
    return { valor: paraDia(data), rotulo };
  });
}

export type Conexao = 'online' | 'sem-sinal' | 'sem-internet';
export const conexaoDe = (maquina: Maquina): Conexao => (!maquina.telemetriaAtiva ? 'sem-internet' : maquina.status === 'sem-sinal' ? 'sem-sinal' : 'online');

/** "Plantadeira DB60 · trabalhando no T7". */
export function detalheDaMaquina(maquina: Maquina): string {
  const onde = maquina.status === 'trabalhando' ? `trabalhando${maquina.talhaoNome ? ` em ${siglaTalhao(maquina.talhaoNome)}` : ''}` : maquina.status === 'parada' ? 'parada agora' : null;
  return [maquina.implemento, onde].filter(Boolean).join(' · ');
}

export function textoDaConexao(maquina: Maquina): string {
  const conexao = conexaoDe(maquina);
  if (conexao === 'online') return 'Online · agora';
  if (conexao === 'sem-internet') return 'Sem internet · passe o plano ao operador';
  // Máquina que nunca mandou sinal vem com a data zero.
  const viuAlgumaVez = new Date(maquina.ultimoSinal).getTime() > 0;
  return viuAlgumaVez ? `Sem sinal · última vez às ${horaDoDia(maquina.ultimoSinal)}` : 'Sem sinal';
}

/** "Plantio de soja · Híbrido X · 65.000 sementes/ha". */
export function resumoDoPlano(plano: Plano): string {
  const partes = [`${nomeDaOperacao(plano.operacao)}${plano.cultura ? ` de ${plano.cultura.toLowerCase()}` : ''}`];
  if (plano.variedade) partes.push(plano.variedade);
  if (plano.sementesPorHa) partes.push(`${plano.sementesPorHa.toLocaleString('pt-BR')} sementes/ha`);
  if (plano.produto) partes.push(plano.doseProduto ? `${plano.produto} ${plano.doseProduto.toLocaleString('pt-BR')} ${PRODUTO[plano.operacao]?.unidade ?? ''}`.trim() : plano.produto);
  return partes.join(' · ');
}

/** "Começa em 12 de novembro · 2 talhões". */
export function quandoEOnde(plano: Plano): string {
  const data = new Date(`${plano.dataInicio}T12:00:00`).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' });
  const n = plano.talhoes.length;
  return `Começa em ${data} · ${n === 1 ? plano.talhoes[0]!.nome : `${n} talhões`}`;
}

/** "Plantio de milho", "Pulverização"... É a tarefa que vai para a escala. */
export function tarefaDoPlano(plano: Pick<Plano, 'operacao' | 'cultura'>): string {
  return `${nomeDaOperacao(plano.operacao)}${plano.cultura ? ` de ${plano.cultura.toLowerCase()}` : ''}`;
}

/** "hoje", "amanhã" ou "quinta-feira, 12 de novembro". */
export function quandoComeca(dataInicio: string, hoje = new Date()): string {
  const [hojeDia, amanha] = proximosDias(2, hoje).map((d) => d.valor);
  if (dataInicio === hojeDia) return 'hoje';
  if (dataInicio === amanha) return 'amanhã';
  return new Date(`${dataInicio}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
}

/** A mensagem da escala do plano, pronta para o grupo da equipe no WhatsApp. */
export function mensagemDaEscala(plano: Plano, linhas: { maquinaNome: string; implemento: string | null; operador: string; turno: Turno }[]): string {
  const talhoes = plano.talhoes.map((t) => t.nome).join(', ');
  const equipe = linhas.map((l) => {
    const maquina = `${l.maquinaNome}${l.implemento ? ` (${l.implemento})` : ''}`;
    const turno = l.turno === 'dia-todo' ? '' : ` · 🕐 ${rotuloDoTurno(l.turno).toLowerCase()}`;
    return `👤 *${l.operador.trim() || '[OPERADOR]'}*: ${emojiDaMaquina(l.maquinaNome)} ${maquina}${turno}`;
  });
  const dados = resumoDoPlano(plano).split(' · ').slice(1).join(' · ');
  return [`${emojiDaOperacao(plano.operacao)} *${tarefaDoPlano(plano)}*`, `📍 ${talhoes}`, `📅 Começa ${quandoComeca(plano.dataInicio)}`, ...(dados ? [dados] : []), '', ...equipe, ...(plano.recado ? ['', `💬 Recado: ${plano.recado}`] : [])].join('\n');
}
