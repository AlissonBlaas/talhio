import type { Talhao } from '@talhio/shared';
import { StyleSheet, Text, View } from 'react-native';

import { CamadaContornos, MapaBase } from '@/mapa-motor';
import { hectares } from '@/shared/lib/format';
import { cores, fontes } from '@/shared/theme/tokens';

import { limitesDosTalhoes } from '../limites';

const MARGEM = { top: 28, right: 28, bottom: 44, left: 28 };

/** O talhão para onde o operador vai, no satélite, com o contorno destacado. Parado: não arrasta nem dá zoom. */
export function MapaDoTalhao({ talhao, altura = 190 }: { talhao: Talhao; altura?: number }) {
  const limites = limitesDosTalhoes([talhao]);
  if (!limites) return null;
  return (
    <View style={[styles.caixa, { height: altura }]} accessible accessibilityLabel={`Mapa do talhão ${talhao.nome}, ${hectares(talhao.areaHa)}`}>
      <MapaBase limites={limites} margem={MARGEM} interativo={false} mostrarAtribuicao={false}>
        <CamadaContornos geo={{ type: 'Feature', properties: {}, geometry: talhao.contorno }} estilo="foco" />
      </MapaBase>
      <View style={styles.etiqueta} pointerEvents="none">
        <Text style={styles.nome} numberOfLines={1}>
          {talhao.nome}
        </Text>
        <Text style={styles.area}>{hectares(talhao.areaHa)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  caixa: { borderRadius: 22, overflow: 'hidden', backgroundColor: cores.mapaFundo },
  etiqueta: { position: 'absolute', left: 10, right: 10, bottom: 10, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: cores.controleMapa, borderRadius: 22, paddingVertical: 8, paddingHorizontal: 12 },
  nome: { flex: 1, fontFamily: fontes.semi, fontSize: 13, lineHeight: 17, color: cores.sobreEscuro },
  area: { fontFamily: fontes.titulo, fontSize: 13, lineHeight: 15, color: cores.destaqueSobreEscuro },
});
