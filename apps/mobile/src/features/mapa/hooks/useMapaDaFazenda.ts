import type { Maquina, Talhao } from '@talhio/shared';
import { useMemo, useState } from 'react';

import { useLinhasDoTalhao, type LinhasDoTalhao } from '@/features/linhas';
import { useMaquinas, useParadasDasMaquinas, usePontosDasMaquinas, useRastrosDasMaquinas } from '@/features/maquinas';
import { limitesDosTalhoes, useTalhoes } from '@/features/talhoes';
import type { PropriedadesDoTalhao, RotuloDeTalhao } from '@/mapa-motor';
import { siglaTalhao } from '@/shared/lib/format';

/** Centro aproximado do talhão, para posicionar a etiqueta. */
function centro(talhao: Talhao): [number, number] {
  const anel = (talhao.contorno.coordinates[0] ?? []).slice(0, -1);
  const n = anel.length || 1;
  return [anel.reduce((s, p) => s + p[0], 0) / n, anel.reduce((s, p) => s + p[1], 0) / n];
}

export type Selecao = { tipo: 'talhao'; talhao: Talhao; maquinasNoTalhao: number; linhas: LinhasDoTalhao } | { tipo: 'maquina'; maquina: Maquina } | null;

/**
 * Lógica da tela de mapa: junta talhões e máquinas, monta o GeoJSON das camadas
 * e controla o que está selecionado. A tela só desenha.
 */
export function useMapaDaFazenda() {
  const { talhoes, carregando: carregandoTalhoes, erro: erroTalhoes, atualizar: atualizarTalhoes } = useTalhoes();
  const { maquinas, carregando: carregandoMaquinas, erro: erroMaquinas, atualizar: atualizarMaquinas } = useMaquinas();
  const [selecionado, setSelecionado] = useState<{ tipo: 'talhao' | 'maquina'; id: string } | null>(null);

  // Os dados das camadas não levam a seleção: tocar num talhão ou máquina muda só a pintura
  // (ver CamadaTalhoes e CamadaMaquinas), sem reenviar nenhum contorno ou ponto ao mapa.
  const talhoesGeo = useMemo<GeoJSON.FeatureCollection<GeoJSON.Polygon, PropriedadesDoTalhao>>(
    () => ({
      type: 'FeatureCollection',
      features: talhoes.map((t) => ({ type: 'Feature', id: t.id, properties: { id: t.id, operacao: t.operacao ?? 'nenhuma' }, geometry: t.contorno })),
    }),
    [talhoes],
  );
  const rotulos = useMemo<RotuloDeTalhao[]>(() => talhoes.map((t) => ({ id: t.id, texto: siglaTalhao(t.nome), descricao: t.nome, centro: centro(t) })), [talhoes]);
  const maquinasGeo = usePontosDasMaquinas();
  const rastrosDoServidor = useRastrosDasMaquinas();
  const paradasGeo = useParadasDasMaquinas();
  // A ponta de cada caminho vai até onde a máquina está AGORA: a posição chega a cada 2 s, o caminho a cada 10 s.
  // Sem isso a linha ficaria sempre um pedaço atrás do trator. Só liga se o ponto está perto do fim do caminho
  // (até ~500 m), para não riscar uma reta que a máquina não percorreu.
  const rastrosGeo = useMemo(() => {
    const posicoes = new Map(maquinasGeo.features.map((f) => [f.properties.id, f.geometry.coordinates as [number, number]]));
    let mudou = false;
    const features = rastrosDoServidor.features.map((f) => {
      const agora = posicoes.get(f.properties.id);
      const ultimoTrecho = f.geometry.coordinates.at(-1);
      const fim = ultimoTrecho?.at(-1);
      if (!agora || !ultimoTrecho || !fim) return f;
      const dLat = (agora[1] - fim[1]!) * 111_320;
      const dLng = (agora[0] - fim[0]!) * 111_320 * Math.cos((fim[1]! * Math.PI) / 180);
      const metros = Math.hypot(dLat, dLng);
      if (metros < 1 || metros > 500) return f;
      mudou = true;
      return { ...f, geometry: { ...f.geometry, coordinates: [...f.geometry.coordinates.slice(0, -1), [...ultimoTrecho, agora]] } };
    });
    return mudou ? { ...rastrosDoServidor, features } : rastrosDoServidor;
  }, [rastrosDoServidor, maquinasGeo]);
  // Sem talhões (ex.: organização só com máquinas), o mapa enquadra as máquinas, para nunca ficar vazio.
  // Esse enquadramento é calculado UMA vez: se acompanhasse cada movimento, o mapa voltaria a afastar
  // sempre que um trator andasse, desfazendo o zoom de quem tocou numa máquina.
  const [limitesDasMaquinas, setLimitesDasMaquinas] = useState<[number, number, number, number] | null>(null);
  if (!limitesDasMaquinas && maquinasGeo.features.length > 0) {
    const pontos = maquinasGeo.features.map((f) => f.geometry.coordinates);
    const lngs = pontos.map((p) => p[0]!);
    const lats = pontos.map((p) => p[1]!);
    setLimitesDasMaquinas([Math.min(...lngs) - 0.01, Math.min(...lats) - 0.01, Math.max(...lngs) + 0.01, Math.max(...lats) + 0.01]);
  }
  const limitesDosTalhoesDaFazenda = useMemo(() => limitesDosTalhoes(talhoes), [talhoes]);
  const limites = limitesDosTalhoesDaFazenda ?? limitesDasMaquinas;

  // Linhas do trator: do talhão selecionado ou do talhão onde está a máquina selecionada.
  const talhaoDasLinhasId = selecionado?.tipo === 'maquina' ? maquinas.find((m) => m.id === selecionado.id)?.talhaoId : selecionado?.id;
  const linhas = useLinhasDoTalhao(talhoes.find((t) => t.id === talhaoDasLinhasId) ?? null);

  let selecao: Selecao = null;
  if (selecionado?.tipo === 'talhao') {
    const talhao = talhoes.find((t) => t.id === selecionado.id);
    if (talhao) selecao = { tipo: 'talhao', talhao, maquinasNoTalhao: maquinas.filter((m) => m.talhaoId === talhao.id).length, linhas };
  } else if (selecionado?.tipo === 'maquina') {
    const maquina = maquinas.find((m) => m.id === selecionado.id);
    if (maquina) selecao = { tipo: 'maquina', maquina };
  }

  return {
    talhoes,
    maquinas,
    talhoesGeo,
    maquinasGeo,
    rastrosGeo,
    paradasGeo,
    linhaGeo: linhas.geo,
    limites,
    rotulos,
    talhaoSelecionadoId: selecionado?.tipo === 'talhao' ? selecionado.id : null,
    maquinaSelecionadaId: selecionado?.tipo === 'maquina' ? selecionado.id : null,
    selecao,
    selecionarTalhao: (id: string) => setSelecionado({ tipo: 'talhao', id }),
    selecionarMaquina: (id: string) => setSelecionado({ tipo: 'maquina', id }),
    limparSelecao: () => setSelecionado(null),
    // O mapa abre com o que chegar primeiro (talhões ou máquinas); o resto entra quando estiver pronto.
    carregando: carregandoTalhoes && carregandoMaquinas,
    carregandoResto: carregandoTalhoes || carregandoMaquinas,
    erro: talhoes.length === 0 && maquinas.length === 0 ? (erroTalhoes ?? erroMaquinas) : null,
    atualizar: () => {
      atualizarTalhoes();
      atualizarMaquinas();
    },
  };
}
