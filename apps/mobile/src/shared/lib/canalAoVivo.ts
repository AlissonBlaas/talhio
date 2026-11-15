import { FECHAMENTO_NAO_AUTENTICADO, QuadroDoServidorSchema, type QuadroDoApp, type QuadroDoServidor } from '@talhio/shared';
import { AppState } from 'react-native';
import { useSyncExternalStore } from 'react';

import { apiClient, URL_DO_CANAL } from './apiClient';
import { sessao } from './sessao';

/**
 * Canal ao vivo com o servidor: um WebSocket só, aberto enquanto há login e o app está na tela.
 * O servidor empurra as máquinas quando algo muda e transmite as respostas do assistente aos poucos.
 *
 * Este arquivo só cuida do transporte (conectar, reconectar, enviar, entregar quadros). O que fazer com cada
 * quadro é das features: quem se interessa chama `canalAoVivo.ouvir`.
 *
 * Reconexão: espera 1 s, 2 s, 4 s... até 30 s, com sorteio para não reconectar todos de uma vez. Se o servidor
 * recusa o token (venceu), renova a sessão por uma chamada normal e tenta de novo. Sem o canal, as telas
 * seguem atualizando pela consulta de 15 s (`intervaloDeAtualizacao`).
 */
export type EstadoDoCanal = 'fechado' | 'conectando' | 'aberto';

let socket: WebSocket | null = null;
let estado: EstadoDoCanal = 'fechado';
let querLigado = false;
let tentativas = 0;
let religar: ReturnType<typeof setTimeout> | null = null;
const ouvintesDeQuadro = new Set<(quadro: QuadroDoServidor) => void>();
const ouvintesDeEstado = new Set<() => void>();

function mudarEstado(novo: EstadoDoCanal) {
  if (estado === novo) return;
  estado = novo;
  for (const o of ouvintesDeEstado) o();
}

function agendarReconexao() {
  if (!querLigado || religar) return;
  const espera = Math.min(30_000, 1000 * 2 ** tentativas++) * (0.75 + Math.random() * 0.5);
  religar = setTimeout(() => {
    religar = null;
    abrir();
  }, espera);
}

function abrir() {
  if (!querLigado || socket || sessao.atual().status !== 'logado') return;
  const token = sessao.tokenAcesso();
  if (!token) return;
  mudarEstado('conectando');
  const ws = new WebSocket(URL_DO_CANAL);
  socket = ws;
  ws.onopen = () => ws.send(JSON.stringify({ tipo: 'auth', token } satisfies QuadroDoApp));
  ws.onmessage = (evento) => {
    let quadro: QuadroDoServidor;
    try {
      quadro = QuadroDoServidorSchema.parse(JSON.parse(String(evento.data)));
    } catch {
      return; // quadro que não conhecemos (servidor mais novo que o app): ignora
    }
    if (quadro.tipo === 'pronto') {
      tentativas = 0;
      mudarEstado('aberto');
    }
    for (const o of ouvintesDeQuadro) o(quadro);
  };
  ws.onerror = () => undefined; // o fechamento logo depois trata
  ws.onclose = (evento) => {
    if (socket === ws) socket = null;
    mudarEstado('fechado');
    if (evento.code === FECHAMENTO_NAO_AUTENTICADO) {
      // Token vencido: uma chamada normal renova a sessão; depois reconecta com o token novo.
      void apiClient.get('/auth/eu').catch(() => undefined).finally(agendarReconexao);
    } else {
      agendarReconexao();
    }
  };
}

function fechar() {
  if (religar) clearTimeout(religar);
  religar = null;
  const ws = socket;
  socket = null;
  ws?.close(1000);
  mudarEstado('fechado');
}

export const canalAoVivo = {
  /** Liga o canal e o mantém enquanto o app estiver na tela e houver login. Devolve a função que desliga. */
  ligar(): () => void {
    querLigado = true;
    abrir();
    const app = AppState.addEventListener('change', (e) => {
      // Em segundo plano o sistema derruba o socket de qualquer jeito: fecha limpo e reabre ao voltar.
      if (e === 'active') {
        tentativas = 0;
        abrir();
      } else fechar();
    });
    const sessaoAssinada = sessao.assinar(() => {
      if (sessao.atual().status === 'logado') abrir();
      else fechar();
    });
    return () => {
      querLigado = false;
      app.remove();
      sessaoAssinada();
      fechar();
    };
  },
  /** Recebe todos os quadros do servidor. Devolve a função que para de ouvir. */
  ouvir(ouvinte: (quadro: QuadroDoServidor) => void): () => void {
    ouvintesDeQuadro.add(ouvinte);
    return () => ouvintesDeQuadro.delete(ouvinte);
  },
  /** Envia um quadro; false se o canal não está aberto (quem chamou usa a rota normal da API). */
  enviar(quadro: QuadroDoApp): boolean {
    if (estado !== 'aberto' || !socket) return false;
    socket.send(JSON.stringify(quadro));
    return true;
  },
  estado: () => estado,
};

/** Quanto esperar entre consultas à API: com o canal aberto o servidor já empurra o que muda, então só confere de vez em quando. */
export const intervaloDeAtualizacao = () => (estado === 'aberto' ? 60_000 : 15_000);

export function useEstadoDoCanal(): EstadoDoCanal {
  return useSyncExternalStore(
    (ouvinte) => {
      ouvintesDeEstado.add(ouvinte);
      return () => ouvintesDeEstado.delete(ouvinte);
    },
    () => estado,
  );
}
