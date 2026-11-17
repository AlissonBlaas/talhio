import { areaHaDoPoligono, type Poligono } from '@talhio/shared';
import { useMemo, useState } from 'react';

import { arredondarCanto } from '../arredondar';

export type Canto = [lng: number, lat: number];

/**
 * Estado do desenho de um talhão: os cantos, na ordem em que foram tocados,
 * e qual canto está selecionado para ser movido ou removido.
 */
export function useDesenhoTalhao() {
  const [cantos, setCantos] = useState<Canto[]>([]);
  const [selecionado, setSelecionado] = useState<number | null>(null);

  // Recalculado só quando os cantos ou a seleção mudam (digitar o nome do talhão não mexe no mapa).
  const { contorno, geo, meios } = useMemo(() => {
    const primeiro = cantos[0];
    const fechado: Canto[] = primeiro && cantos.length >= 3 ? [...cantos, primeiro] : cantos;
    const poligono: Poligono | null = cantos.length >= 3 ? { type: 'Polygon', coordinates: [fechado] } : null;
    // O meio de cada lado (inclusive o que fecha a área): tocar ali cria um canto entre os dois.
    const meios = fechado.slice(0, -1).map((a, i): Canto => { const b = fechado[i + 1]!; return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; });
    // Tudo o que o mapa desenha: a área (3 cantos ou mais), a linha que liga os cantos e os cantos.
    const colecao: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: [
        ...(poligono ? [{ type: 'Feature' as const, properties: { tipo: 'area' }, geometry: poligono }] : []),
        ...(cantos.length >= 2 ? [{ type: 'Feature' as const, properties: { tipo: 'linha' }, geometry: { type: 'LineString' as const, coordinates: fechado } }] : []),
        ...(cantos.length >= 2 ? meios.map((meio, depoisDe) => ({ type: 'Feature' as const, properties: { tipo: 'meio', depoisDe }, geometry: { type: 'Point' as const, coordinates: meio } })) : []),
        ...cantos.map((canto, indice) => ({
          type: 'Feature' as const,
          properties: { tipo: 'canto', indice, selecionado: indice === selecionado },
          geometry: { type: 'Point' as const, coordinates: canto },
        })),
      ],
    };
    return { contorno: poligono, geo: colecao, meios: cantos.length >= 2 ? meios : [] };
  }, [cantos, selecionado]);

  return {
    cantos,
    contorno,
    geo,
    selecionado,
    areaHa: contorno ? areaHaDoPoligono(contorno) : 0,
    /** O meio de cada lado, na ordem dos cantos: `meios[i]` fica entre o canto `i` e o seguinte. */
    meios,
    adicionar: (canto: Canto) => setCantos((atuais) => [...atuais, canto]),
    /** Começa de um contorno que já existe (editar um talhão). O ponto que fecha o anel, igual ao primeiro, fica de fora. */
    carregar: (anel: Canto[]) => {
      const primeiro = anel[0];
      const ultimo = anel[anel.length - 1];
      const fechado = anel.length > 1 && primeiro && ultimo && primeiro[0] === ultimo[0] && primeiro[1] === ultimo[1];
      setCantos(fechado ? anel.slice(0, -1) : anel);
      setSelecionado(null);
    },
    /**
     * Cria um canto no meio do lado que começa no canto `depoisDe` e já o deixa selecionado: o próximo toque no mapa
     * leva o canto novo para o lugar certo. É assim que se acompanha uma curva sem redesenhar o talhão.
     */
    inserirNoMeio: (depoisDe: number) => {
      const meio = meios[depoisDe];
      if (!meio) return;
      setCantos((atuais) => [...atuais.slice(0, depoisDe + 1), meio, ...atuais.slice(depoisDe + 1)]);
      setSelecionado(depoisDe + 1);
    },
    /** Seleciona um canto; tocar de novo no mesmo canto tira a seleção. */
    selecionar: (indice: number) => setSelecionado((atual) => (atual === indice ? null : indice)),
    /** Leva o canto selecionado para a nova posição e encerra a seleção. */
    moverSelecionado: (canto: Canto) => {
      if (selecionado === null) return;
      setCantos((atuais) => atuais.map((c, i) => (i === selecionado ? canto : c)));
      setSelecionado(null);
    },
    /** Leva um canto para a nova posição sem mexer na seleção: é o que acompanha o dedo durante o arrasto. */
    mover: (indice: number, canto: Canto) => setCantos((atuais) => atuais.map((c, i) => (i === indice ? canto : c))),
    /** Troca o canto selecionado por uma curva (pontos de verdade no contorno) e encerra a seleção. */
    arredondarSelecionado: () => {
      if (selecionado === null) return;
      setCantos((atuais) => arredondarCanto(atuais, selecionado));
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
