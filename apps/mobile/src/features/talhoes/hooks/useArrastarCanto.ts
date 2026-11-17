import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { PanResponder } from 'react-native';

import type { MapaControle } from '@/mapa-motor';

import type { Canto } from './useDesenhoTalhao';

/** Lado da área de toque em volta do canto selecionado, em pontos de tela. */
export const LADO_DA_ALCA = 64;
/** Abaixo disso o dedo não arrastou: foi um toque. */
const FOLGA_DE_TOQUE = 5;
const PASSO = 100;

type Base = { x: number; y: number; origem: Canto; porX: Canto; porY: Canto };

type Entrada = {
  controle: RefObject<MapaControle | null>;
  /** Índice do canto selecionado, ou null. */
  selecionado: number | null;
  cantos: Canto[];
  aoMover: (indice: number, canto: Canto) => void;
  /** Tocou no canto sem arrastar. */
  aoTocar: (indice: number) => void;
};

/**
 * Arrastar o canto selecionado sem o mapa andar junto. Sobre o canto fica uma área de toque invisível (a "alça"):
 * o dedo que começa nela move o canto; fora dela, o mapa continua arrastando e aproximando como sempre.
 *
 * A conversão tela -> mapa é medida uma vez, com o mapa parado (três pontos dão a escala e o giro); durante o
 * arrasto a conta é local, sem perguntar ao mapa a cada movimento do dedo.
 */
export function useArrastarCanto({ controle, selecionado, cantos, aoMover, aoTocar }: Entrada) {
  const [base, setBase] = useState<Base | null>(null);
  const [desvio, setDesvio] = useState<[number, number]>([0, 0]);
  const [versao, setVersao] = useState(0);
  const atual = useRef({ base, selecionado, cantos, aoMover, aoTocar });
  useLayoutEffect(() => {
    atual.current = { base, selecionado, cantos, aoMover, aoTocar };
  });
  const arrastando = useRef(false);

  // Onde o canto está na tela e quanto de mapa vale cada ponto de tela. Refeito quando muda o canto selecionado,
  // quando o mapa para (a câmera mudou) e ao soltar o dedo.
  useEffect(() => {
    setDesvio([0, 0]);
    const canto = selecionado === null ? undefined : atual.current.cantos[selecionado];
    if (!canto) return setBase(null);
    let valido = true;
    void (async () => {
      const mapa = controle.current;
      const tela = await mapa?.projetar(canto).catch(() => null);
      if (!mapa || !tela) return valido && setBase(null);
      const [x, y] = tela;
      const [origem, emX, emY] = await Promise.all([mapa.desprojetar([x, y]), mapa.desprojetar([x + PASSO, y]), mapa.desprojetar([x, y + PASSO])]).catch(() => [null, null, null]);
      if (!valido) return;
      if (!origem || !emX || !emY) return setBase(null);
      setBase({
        x,
        y,
        origem,
        porX: [(emX[0] - origem[0]) / PASSO, (emX[1] - origem[1]) / PASSO],
        porY: [(emY[0] - origem[0]) / PASSO, (emY[1] - origem[1]) / PASSO],
      });
    })();
    return () => {
      valido = false;
    };
  }, [controle, selecionado, versao]);

  const gesto = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        arrastando.current = true;
      },
      onPanResponderMove: (_evento, { dx, dy }) => {
        const { base: b, selecionado: indice, aoMover: mover } = atual.current;
        if (!b || indice === null || Math.hypot(dx, dy) < FOLGA_DE_TOQUE) return;
        setDesvio([dx, dy]);
        mover(indice, [b.origem[0] + dx * b.porX[0] + dy * b.porY[0], b.origem[1] + dx * b.porX[1] + dy * b.porY[1]]);
      },
      onPanResponderRelease: (_evento, { dx, dy }) => {
        arrastando.current = false;
        const { selecionado: indice, aoTocar: tocar } = atual.current;
        if (indice !== null && Math.hypot(dx, dy) < FOLGA_DE_TOQUE) tocar(indice);
        else setVersao((v) => v + 1);
      },
      onPanResponderTerminate: () => {
        arrastando.current = false;
        setVersao((v) => v + 1);
      },
    }),
  ).current;

  return {
    /** Canto de cima à esquerda da alça, na área do mapa; null sem canto selecionado (ou enquanto a posição é medida). */
    alca: base ? { left: base.x + desvio[0] - LADO_DA_ALCA / 2, top: base.y + desvio[1] - LADO_DA_ALCA / 2 } : null,
    manipuladores: gesto.panHandlers,
    /** Ligar em `MapaBase.aoParar`: a câmera mudou, a alça precisa voltar para cima do canto. */
    aoPararOMapa: () => {
      if (!arrastando.current) setVersao((v) => v + 1);
    },
  };
}
