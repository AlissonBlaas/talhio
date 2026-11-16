import type { Atalho } from '@talhio/shared';

/**
 * As telas que uma resposta do assistente pode oferecer como botão. O modelo só escreve o identificador; o rótulo e a
 * rota saem daqui. Identificador desconhecido é ignorado: o modelo não consegue mandar a pessoa para outro lugar.
 */
const TELAS: Record<string, Atalho> = {
  escala: { rotulo: 'Abrir a Escala', rota: '/escala' },
  relatorios: { rotulo: 'Abrir os Relatórios', rota: '/relatorios' },
  mapa: { rotulo: 'Abrir o mapa', rota: '/mapa' },
  maquinas: { rotulo: 'Ver as máquinas', rota: '/maquinas' },
  'novo-plano': { rotulo: 'Criar um plano', rota: '/novo-plano' },
  importar: { rotulo: 'Importar talhões', rota: '/importar' },
  config: { rotulo: 'Abrir a Config', rota: '/config' },
  notificacoes: { rotulo: 'Ver as notificações', rota: '/notificacoes' },
  'primeiros-passos': { rotulo: 'Rever os primeiros passos', rota: '/onboarding' },
};

/** Os identificadores, para as instruções do modelo. */
export const IDS_DAS_TELAS = Object.keys(TELAS);

const semAcento = (texto: string) => texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/**
 * Transforma o que o modelo pediu em botões. "maquina: 8270R - 22" abre a tela daquela máquina, se o nome existir na
 * fazenda. No máximo 3, sem repetir.
 */
export function resolverAtalhos(pedidos: string[], maquinas: { id: string; nome: string }[]): Atalho[] {
  const prontos: Atalho[] = [];
  for (const pedido of pedidos) {
    const limpo = pedido.trim();
    const daMaquina = limpo.match(/^m[aá]quina\s*:\s*(.+)$/i);
    const maquina = daMaquina ? maquinas.find((m) => semAcento(m.nome) === semAcento(daMaquina[1]!)) : undefined;
    const atalho = maquina ? { rotulo: `Ver ${maquina.nome}`.slice(0, 40), rota: `/maquina/${encodeURIComponent(maquina.id)}` } : TELAS[semAcento(limpo).replace(/ /g, '-')];
    if (atalho && !prontos.some((p) => p.rota === atalho.rota)) prontos.push(atalho);
    if (prontos.length === 3) break;
  }
  return prontos;
}
