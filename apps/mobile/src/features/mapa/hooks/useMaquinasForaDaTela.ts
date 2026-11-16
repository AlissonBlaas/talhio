import type { Maquina } from '@talhio/shared';
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';

import type { MapaControle } from '@/mapa-motor';

import { indicadoresNaBorda, type AreaOcupada, type AreaVisivel, type Indicador } from '../foraDaTela';

/** Só mexe no estado quando algo mudou de lugar de verdade (1 px), para não redesenhar à toa. */
function iguais(a: Indicador<Maquina>[], b: Indicador<Maquina>[]): boolean {
  return a.length === b.length && a.every((ia, i) => {
    const ib = b[i]!;
    return ia.alvo.id === ib.alvo.id && ia.alvo.status === ib.alvo.status && Math.abs(ia.x - ib.x) < 1 && Math.abs(ia.y - ib.y) < 1 && Math.abs(ia.anguloGraus - ib.anguloGraus) < 1;
  });
}

/**
 * Máquinas com sinal (trabalhando ou parada) que ficaram fora da parte visível do mapa, com o lugar da borda onde
 * avisar. `recalcular` é chamado quando a câmera PARA (nunca durante o movimento) e sozinho quando as máquinas mudam.
 */
export function useMaquinasForaDaTela(controle: RefObject<MapaControle | null>, maquinas: Maquina[], area: AreaVisivel, ocupada: AreaOcupada) {
  const [indicadores, setIndicadores] = useState<Indicador<Maquina>[]>([]);
  const rodada = useRef(0);
  const dados = useRef({ maquinas, area, ocupada });
  dados.current = { maquinas, area, ocupada };

  const recalcular = useCallback(() => {
    const minha = (rodada.current += 1);
    void (async () => {
      const atual = dados.current;
      const comSinal = atual.maquinas.filter((m) => m.posicao && m.status !== 'sem-sinal');
      // O mapa recusa a pergunta enquanto abre ou fecha: nesse caso fica como está e a próxima parada confere de novo.
      const pontos = await Promise.all(comSinal.map(async (m) => (await controle.current?.projetar([m.posicao!.lng, m.posicao!.lat]).catch(() => null)) ?? null));
      // Chegou outro pedido enquanto este esperava o mapa: vale o mais novo.
      if (minha !== rodada.current) return;
      const alvos = comSinal.flatMap((alvo, i) => (pontos[i] ? [{ alvo, ponto: pontos[i]! }] : []));
      const novos = indicadoresNaBorda(alvos, atual.area, atual.ocupada);
      setIndicadores((antes) => (iguais(antes, novos) ? antes : novos));
    })();
  }, [controle]);

  // Máquina andou, mudou de estado ou o painel de baixo abriu/fechou: confere de novo sem esperar a câmera.
  const assinatura = maquinas.map((m) => `${m.id}:${m.status}:${m.posicao?.lng ?? ''}:${m.posicao?.lat ?? ''}`).join('|');
  useEffect(recalcular, [recalcular, assinatura, area.topo, area.baixo, area.direita]);

  return { indicadores, recalcular };
}
