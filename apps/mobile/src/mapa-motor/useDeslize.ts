import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

type Pontos = GeoJSON.FeatureCollection<GeoJSON.Point>;

/** Em quanto tempo o ponto vai da posição antiga à nova. Perto do intervalo em que o servidor manda posições. */
const DURACAO_MS = 2500;
/** Quadros por segundo do deslize: suave o bastante e leve para a thread do JavaScript. */
const INTERVALO_MS = 1000 / 15;
/** Salto maior que isso (~500 m) não é movimento de trator entre duas leituras: vai direto, sem deslizar. */
const SALTO_GRAUS = 0.005;

const chaveDe = (f: GeoJSON.Feature<GeoJSON.Point>) => String(f.properties?.id ?? f.id ?? '');

/**
 * Faz os pontos deslizarem até a posição nova em vez de pular. Recebe o GeoJSON com as posições reais e
 * devolve outro, com as posições do momento. Quando nada está em movimento devolve o MESMO objeto recebido
 * (a camada não é redesenhada). Com "Reduzir movimento" ligado no aparelho, não desliza.
 */
export function useDeslize(alvo: Pontos): Pontos {
  const [mostrado, setMostrado] = useState(alvo);
  /** Onde cada ponto está desenhado agora (para a próxima animação partir daqui, não do alvo antigo). */
  const atual = useRef(new Map<string, [number, number]>());
  const semMovimento = useRef(false);

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then((ligado) => (semMovimento.current = ligado));
    const ouvinte = AccessibilityInfo.addEventListener('reduceMotionChanged', (ligado) => (semMovimento.current = ligado));
    return () => ouvinte.remove();
  }, []);

  useEffect(() => {
    const destinos = new Map(alvo.features.map((f) => [chaveDe(f), f.geometry.coordinates as [number, number]]));
    const origens = new Map<string, [number, number]>();
    let algumMove = false;
    for (const [id, destino] of destinos) {
      const de = atual.current.get(id);
      const longe = de ? Math.abs(de[0] - destino[0]) > SALTO_GRAUS || Math.abs(de[1] - destino[1]) > SALTO_GRAUS : true;
      const parado = de ? de[0] === destino[0] && de[1] === destino[1] : true;
      origens.set(id, !de || longe || semMovimento.current ? destino : de);
      if (de && !longe && !parado && !semMovimento.current) algumMove = true;
    }

    const terminar = () => {
      atual.current = destinos;
      setMostrado(alvo);
    };
    if (!algumMove) {
      terminar();
      return;
    }

    const inicio = Date.now();
    const relogio = setInterval(() => {
      const t = Math.min(1, (Date.now() - inicio) / DURACAO_MS);
      if (t >= 1) {
        clearInterval(relogio);
        terminar();
        return;
      }
      const posicoes = new Map<string, [number, number]>();
      const features = alvo.features.map((f) => {
        const id = chaveDe(f);
        const de = origens.get(id)!;
        const para = destinos.get(id)!;
        const ponto: [number, number] = [de[0] + (para[0] - de[0]) * t, de[1] + (para[1] - de[1]) * t];
        posicoes.set(id, ponto);
        return { ...f, geometry: { ...f.geometry, coordinates: ponto } };
      });
      atual.current = posicoes;
      setMostrado({ ...alvo, features });
    }, INTERVALO_MS);
    // Chegou posição mais nova no meio do deslize: para este e o próximo parte de onde o ponto está.
    return () => clearInterval(relogio);
  }, [alvo]);

  return mostrado;
}
