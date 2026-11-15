import type { Talhao } from '@talhio/shared';
import { useMemo, useState } from 'react';

import { useLinhasDoTalhao } from '@/features/linhas';
import { limitesDosTalhoes, useTalhoes } from '@/features/talhoes';
import type { PropriedadesDoTalhao, RotuloDeTalhao } from '@/mapa-motor';
import { siglaTalhao } from '@/shared/lib/format';

/** Centro aproximado do talhão, para posicionar a etiqueta. */
function centro(talhao: Talhao): [number, number] {
  const anel = (talhao.contorno.coordinates[0] ?? []).slice(0, -1);
  const n = anel.length || 1;
  return [anel.reduce((s, p) => s + p[0], 0) / n, anel.reduce((s, p) => s + p[1], 0) / n];
}

/** Primeiro passo do plano: os talhões da fazenda no mapa e qual foi escolhido. */
export function useEscolhaDoTalhao() {
  const { talhoes, carregando, erro, atualizar } = useTalhoes();
  const [escolhidoId, setEscolhidoId] = useState<string | null>(null);
  const escolhido = talhoes.find((t) => t.id === escolhidoId) ?? null;
  const linhas = useLinhasDoTalhao(escolhido);

  // A escolha não entra nos dados das camadas: tocar muda só a pintura, sem reenviar contornos.
  const geo = useMemo<GeoJSON.FeatureCollection<GeoJSON.Polygon, PropriedadesDoTalhao>>(
    () => ({ type: 'FeatureCollection', features: talhoes.map((t) => ({ type: 'Feature', id: t.id, properties: { id: t.id, operacao: t.operacao ?? 'nenhuma' }, geometry: t.contorno })) }),
    [talhoes],
  );
  const rotulos = useMemo<RotuloDeTalhao[]>(() => talhoes.map((t) => ({ id: t.id, texto: siglaTalhao(t.nome), descricao: t.nome, centro: centro(t) })), [talhoes]);
  const limites = useMemo(() => limitesDosTalhoes(talhoes), [talhoes]);

  return {
    geo,
    rotulos,
    limites,
    quantidade: talhoes.length,
    carregando,
    erro,
    atualizar,
    escolhido,
    escolher: setEscolhidoId,
    limpar: () => setEscolhidoId(null),
    linhasGeo: linhas.geo,
    /** Tem linha de trator (própria ou a padrão da fazenda)? Sem ela, o passo seguinte é criar a linha. */
    temLinha: linhas.direcaoGraus !== null,
    resumoDaLinha:
      linhas.direcaoGraus === null
        ? 'Sem linha AB: você cria no próximo passo'
        : linhas.tipo === 'curva'
          ? `${linhas.nome ?? 'Linha curva'} · ${linhas.total} passadas`
          : `${linhas.propria ? (linhas.nome ?? 'Linha do talhão') : 'Linha padrão da fazenda'} · ${Math.round(linhas.direcaoGraus)}°`,
  };
}
