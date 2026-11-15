import { centroDoPoligono, gerarPassadas, linhaPelaDirecao, type Linha, type Posicao, type Talhao } from '@talhio/shared';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { linhasApi } from '../api/linhasApi';
import { linhasKeys } from '../linhas.keys';
import { LARGURA_IMPLEMENTO_M } from './useDesenhoLinha';

export type LinhasDoTalhao = {
  /** Linha, passadas feitas e passadas que faltam, prontas para o mapa. */
  geo: GeoJSON.FeatureCollection;
  nome: string | null;
  direcaoGraus: number | null;
  /** reta = linha AB com passadas calculadas; curva = passadas prontas vindas da John Deere. */
  tipo: 'reta' | 'curva' | null;
  /** true quando a linha foi criada para este talhão; false quando é a padrão da fazenda. */
  propria: boolean;
  total: number;
  feitas: number;
};

const trechos = (passadas: [Posicao, Posicao][]) => passadas.map(([p, q]) => [[p.lng, p.lat], [q.lng, q.lat]]);

/**
 * Linhas do trator dentro de um talhão: a linha AB do talhão (ou, se não houver, a padrão da
 * fazenda) e as passadas, separadas em feitas e por fazer.
 *
 * Provisório: as passadas feitas são estimadas pelo percentual da operação, na ordem.
 * Com a John Deere real, passam a vir da área trabalhada das operações de campo.
 */
export function useLinhasDoTalhao(talhao: Talhao | null): LinhasDoTalhao {
  const query = useQuery({ queryKey: linhasKeys.lista(), queryFn: linhasApi.listar, staleTime: 60 * 60 * 1000 });
  const todas = query.data;

  // As passadas só são recalculadas quando muda o talhão ou as linhas, não a cada desenho da tela.
  return useMemo(() => calcular(talhao, todas ?? []), [talhao, todas]);
}

const SEM_LINHAS: LinhasDoTalhao = { geo: { type: 'FeatureCollection', features: [] }, nome: null, direcaoGraus: null, tipo: null, propria: false, total: 0, feitas: 0 };

function calcular(talhao: Talhao | null, todas: Linha[]): LinhasDoTalhao {
  const propria = talhao ? (todas.filter((l) => l.talhaoId === talhao.id).at(-1) ?? null) : null;
  const padrao = todas.find((l) => l.padraoDaFazenda) ?? null;
  const linha = propria ?? padrao;

  if (!talhao || !linha) return SEM_LINHAS;

  const { a, b } = propria ?? linhaPelaDirecao(centroDoPoligono(talhao.contorno), linha.direcaoGraus);
  // Curva: as passadas já vêm prontas, ponto a ponto. Reta: são calculadas a partir de A-B.
  const curvas = propria?.tipo === 'curva' ? (propria.passadas ?? []) : null;
  const passadas: number[][][] = curvas ?? trechos(gerarPassadas(talhao.contorno, a, b, LARGURA_IMPLEMENTO_M));
  const feitas = Math.round((passadas.length * (talhao.percentualFeito ?? 0)) / 100);

  return {
    geo: {
      type: 'FeatureCollection',
      features: [
        { type: 'Feature', properties: { tipo: 'pendentes' }, geometry: { type: 'MultiLineString', coordinates: passadas.slice(feitas) } },
        { type: 'Feature', properties: { tipo: 'feitas', operacao: talhao.operacao ?? 'nenhuma' }, geometry: { type: 'MultiLineString', coordinates: passadas.slice(0, feitas) } },
        ...(propria && !curvas ? [{ type: 'Feature' as const, properties: { tipo: 'linha' }, geometry: { type: 'LineString' as const, coordinates: [[a.lng, a.lat], [b.lng, b.lat]] } }] : []),
      ],
    },
    nome: linha.nome,
    direcaoGraus: linha.direcaoGraus,
    tipo: curvas ? 'curva' : 'reta',
    propria: propria !== null,
    total: passadas.length,
    feitas,
  };
}
