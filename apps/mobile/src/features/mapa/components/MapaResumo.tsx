import { StyleSheet, View } from 'react-native';

import { CamadaMaquinas, CamadaTalhoes, MapaBase } from '@/mapa-motor';
import { cores } from '@/shared/theme/tokens';

import { useMapaDaFazenda } from '../hooks/useMapaDaFazenda';

const MARGEM = { top: 64, right: 28, bottom: 52, left: 28 };

/**
 * Visão geral da fazenda, parada: todos os talhões e máquinas enquadrados, sem arrastar nem zoom.
 * Qualquer toque chama `aoTocar` (normalmente, abrir o mapa em tela cheia).
 */
export function MapaResumo({ aoTocar }: { aoTocar: () => void }) {
  const mapa = useMapaDaFazenda();
  if (!mapa.limites) return <View style={styles.vazio} />;

  return (
    <MapaBase limites={mapa.limites} margem={MARGEM} interativo={false} mostrarAtribuicao={false} aoTocar={aoTocar}>
      <CamadaTalhoes geo={mapa.talhoesGeo} aoTocar={aoTocar} />
      <CamadaMaquinas geo={mapa.maquinasGeo} aoTocar={aoTocar} />
    </MapaBase>
  );
}

const styles = StyleSheet.create({ vazio: { flex: 1, backgroundColor: cores.mapaFundo } });
