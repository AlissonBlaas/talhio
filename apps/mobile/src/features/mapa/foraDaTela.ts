import type { PontoTela } from '@/mapa-motor';

/** Parte da tela onde o mapa aparece de verdade (sem o que fica por cima: topo, painel de baixo). */
export type AreaVisivel = { esquerda: number; topo: number; direita: number; baixo: number };
/** Pedaço da tela ocupado por botões, onde o indicador não pode parar. */
export type AreaOcupada = AreaVisivel;

export type Indicador<T> = { alvo: T; x: number; y: number; /** Para onde aponta, em graus (0 = direita, 90 = baixo). */ anguloGraus: number };

/** Meio indicador (44 px) mais uma folga da borda. */
const RECUO = 34;
/** Distância mínima entre dois indicadores, para um não cobrir o outro. */
const ESPACO = 52;

/**
 * Para cada alvo que está FORA da área visível, devolve onde desenhar o indicador: na borda, na direção do alvo
 * (a reta que sai do centro da área e vai até ele). Alvo dentro da área não gera indicador.
 * Função pura: recebe os pontos já projetados na tela.
 */
export function indicadoresNaBorda<T>(alvos: { alvo: T; ponto: PontoTela }[], area: AreaVisivel, ocupada?: AreaOcupada): Indicador<T>[] {
  const cx = (area.esquerda + area.direita) / 2;
  const cy = (area.topo + area.baixo) / 2;
  const meiaLargura = (area.direita - area.esquerda) / 2 - RECUO;
  const meiaAltura = (area.baixo - area.topo) / 2 - RECUO;
  if (meiaLargura <= 0 || meiaAltura <= 0) return [];

  const prontos: Indicador<T>[] = [];
  for (const { alvo, ponto } of alvos) {
    const [x, y] = ponto;
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    if (x >= area.esquerda && x <= area.direita && y >= area.topo && y <= area.baixo) continue;
    const dx = x - cx;
    const dy = y - cy;
    const escala = Math.min(dx === 0 ? Infinity : meiaLargura / Math.abs(dx), dy === 0 ? Infinity : meiaAltura / Math.abs(dy));
    let px = cx + dx * escala;
    let py = cy + dy * escala;
    // Caiu em cima dos botões do mapa: desce até passar deles.
    if (ocupada && px >= ocupada.esquerda && px <= ocupada.direita && py >= ocupada.topo && py <= ocupada.baixo) py = Math.min(ocupada.baixo + RECUO, cy + meiaAltura);
    // Dois tratores para o mesmo lado: o segundo anda pela borda até não cobrir o primeiro.
    const naLateral = Math.abs(Math.abs(px - cx) - meiaLargura) < 1;
    for (let tentativa = 0; tentativa < 8 && prontos.some((o) => Math.hypot(o.x - px, o.y - py) < ESPACO); tentativa += 1) {
      if (naLateral) py = py + ESPACO <= cy + meiaAltura ? py + ESPACO : py - ESPACO * (tentativa + 2);
      else px = px + ESPACO <= cx + meiaLargura ? px + ESPACO : px - ESPACO * (tentativa + 2);
    }
    prontos.push({ alvo, x: px, y: py, anguloGraus: (Math.atan2(dy, dx) * 180) / Math.PI });
  }
  return prontos;
}
