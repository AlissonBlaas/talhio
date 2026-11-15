import type { Maquina } from '@talhio/shared';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useLinhasDoTalhao } from '@/features/linhas';
import { useTalhoes } from '@/features/talhoes';
import { CamadaContornos, CamadaPassadas, CamadaPonto, MapaBase, type LngLat } from '@/mapa-motor';
import { cores, fontes } from '@/shared/theme/tokens';

const COR_STATUS = { trabalhando: cores.primario, parada: cores.parada, 'sem-sinal': cores.mapaFundo } as const;
const SEM_CONTORNO: GeoJSON.FeatureCollection<GeoJSON.Polygon> = { type: 'FeatureCollection', features: [] };

/** Onde a máquina está: satélite, contorno do talhão, linhas do trator e o ponto da máquina. */
export function MapaDaMaquina({ maquina }: { maquina: Maquina }) {
  const { talhoes } = useTalhoes();
  const talhao = talhoes.find((t) => t.id === maquina.talhaoId) ?? null;
  const linhas = useLinhasDoTalhao(talhao);
  const contorno = useMemo<GeoJSON.FeatureCollection<GeoJSON.Polygon>>(
    () => (talhao ? { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: talhao.contorno }] } : SEM_CONTORNO),
    [talhao],
  );
  const lng = maquina.posicao?.lng;
  const lat = maquina.posicao?.lat;
  const centro = useMemo<LngLat | undefined>(() => (lng !== undefined && lat !== undefined ? [lng, lat] : undefined), [lng, lat]);

  if (!centro) {
    return (
      <View style={[styles.caixa, styles.vazio]}>
        <Text style={styles.vazioTexto}>Ainda não recebemos a posição desta máquina.</Text>
      </View>
    );
  }

  return (
    <View style={styles.caixa}>
      <MapaBase centro={centro} zoom={15.5} mostrarAtribuicao={false}>
        <CamadaContornos geo={contorno} estilo="linha" />
        <CamadaPassadas geo={linhas.geo} />
        <CamadaPonto lng={centro[0]} lat={centro[1]} cor={COR_STATUS[maquina.status]} />
      </MapaBase>
      {linhas.total > 0 && talhao?.operacao ? (
        <View style={styles.selo}>
          <Text style={styles.seloTexto}>
            {linhas.feitas} de {linhas.total} passadas feitas
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  caixa: { height: 240, borderRadius: 22, overflow: 'hidden', backgroundColor: cores.mapaFundo },
  vazio: { alignItems: 'center', justifyContent: 'center', padding: 24 },
  vazioTexto: { fontFamily: fontes.regular, fontSize: 13, lineHeight: 18, color: cores.sobreEscuro, textAlign: 'center' },
  selo: { position: 'absolute', left: 12, bottom: 12, height: 30, borderRadius: 22, paddingHorizontal: 12, justifyContent: 'center', backgroundColor: cores.controleMapa },
  seloTexto: { fontFamily: fontes.semi, fontSize: 12, color: cores.sobreEscuro },
});
