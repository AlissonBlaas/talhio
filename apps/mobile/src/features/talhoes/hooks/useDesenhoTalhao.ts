import { areaHaDoPoligono, type Poligono } from '@talhio/shared';
import { useMemo, useState } from 'react';

export type Canto = [lng: number, lat: number];

/**
 * Estado do desenho de um talhão: os cantos, na ordem em que foram tocados,
 * e qual canto está selecionado para ser movido ou removido.
 */
export function useDesenhoTalhao() {
  const [cantos, setCantos] = useState<Canto[]>([]);
  const [selecionado, setSelecionado] = useState<number | null>(null);

  // Recalculado só quando os cantos ou a seleção mudam (digitar o nome do talhão não mexe no mapa).
  const { contorno, geo } = useMemo(() => {
    const primeiro = cantos[0];
    const fechado: Canto[] = primeiro && cantos.length >= 3 ? [...cantos, primeiro] : cantos;
    const poligono: Poligono | null = cantos.length >= 3 ? { type: 'Polygon', coordinates: [fechado] } : null;
    // Tudo o que o mapa desenha: a área (3 cantos ou mais), a linha que liga os cantos e os cantos.
    const colecao: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: [
        ...(poligono ? [{ type: 'Feature' as const, properties: { tipo: 'area' }, geometry: poligono }] : []),
        ...(cantos.length >= 2 ? [{ type: 'Feature' as const, properties: { tipo: 'linha' }, geometry: { type: 'LineString' as const, coordinates: fechado } }] : []),
        ...cantos.map((canto, indice) => ({
          type: 'Feature' as const,
          properties: { tipo: 'canto', indice, selecionado: indice === selecionado },
          geometry: { type: 'Point' as const, coordinates: canto },
        })),
      ],
    };
    return { contorno: poligono, geo: colecao };
  }, [cantos, selecionado]);

  return {
    cantos,
    contorno,
    geo,
    selecionado,
    areaHa: contorno ? areaHaDoPoligono(contorno) : 0,
    adicionar: (canto: Canto) => setCantos((atuais) => [...atuais, canto]),
    /** Seleciona um canto; tocar de novo no mesmo canto tira a seleção. */
    selecionar: (indice: number) => setSelecionado((atual) => (atual === indice ? null : indice)),
    /** Leva o canto selecionado para a nova posição e encerra a seleção. */
    moverSelecionado: (canto: Canto) => {
      if (selecionado === null) return;
      setCantos((atuais) => atuais.map((c, i) => (i === selecionado ? canto : c)));
      setSelecionado(null);
    },
    /** Remove o canto selecionado ou, sem seleção, o último canto. */
    remover: () => {
      setCantos((atuais) => (selecionado === null ? atuais.slice(0, -1) : atuais.filter((_, i) => i !== selecionado)));
      setSelecionado(null);
    },
    limpar: () => {
      setCantos([]);
      setSelecionado(null);
    },
  };
}
