import type { Relatorio } from '@talhio/shared';
import { StyleSheet, Text, View } from 'react-native';

import { BarraAnimada } from '@/shared/components/animacoes';
import { hectares, horasMinutos, litros } from '@/shared/lib/format';
import { cores, fontes } from '@/shared/theme/tokens';

const semTipo = (nome: string) => nome.replace(/^(Trator|Pulverizador|Colheitadeira)\s+/, '');

/** `semCartao`: sem moldura nem título, para quando já está dentro de outro cartão. */
export function BarrasPorMaquina({ maquinas, semCartao }: { maquinas: Relatorio['porMaquina']; semCartao?: boolean }) {
  // A barra mostra as HORAS de cada máquina: elas existem para toda máquina que ligou. A área só é medida dentro
  // dos talhões com contorno, então barra por hectare deixaria quem trabalhou o dia todo parecendo parado.
  const maior = Math.max(0.1, ...maquinas.map((m) => m.horas));
  return (
    <View style={semCartao ? styles.solto : styles.cartao}>
      {semCartao ? null : <Text style={styles.titulo}>Horas por máquina</Text>}
      {maquinas.map((maquina, indice) => (
        <View key={maquina.maquinaId} style={styles.linha} accessible accessibilityLabel={`${maquina.nome}: ${horasMinutos(maquina.horas)}${maquina.areaHa > 0 ? `, ${hectares(maquina.areaHa)}` : ''}${maquina.litros !== null ? `, ${litros(maquina.litros)} de combustível` : ''}`}>
          <Text style={styles.nome} numberOfLines={1}>
            {semTipo(maquina.nome)}
          </Text>
          <View style={styles.trilho}>
            <BarraAnimada percentual={Math.max(2, Math.round((maquina.horas / maior) * 100))} cor={maquina.destaque ? cores.milho : cores.folha} altura={10} atrasoMs={120 + indice * 70} />
          </View>
          <View style={styles.valores}>
            <Text style={styles.valor}>{horasMinutos(maquina.horas)}</Text>
            {maquina.areaHa > 0 ? <Text style={styles.area}>{hectares(maquina.areaHa)}</Text> : null}
            {maquina.litros !== null ? <Text style={styles.area}>{litros(maquina.litros)}</Text> : null}
          </View>
        </View>
      ))}
      {maquinas.some((m) => m.destaque) ? <Text style={styles.legenda}>Em amarelo: a máquina que mais ficou parada.</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  cartao: { backgroundColor: cores.cartao, borderWidth: 1, borderColor: cores.borda, borderRadius: 26, paddingVertical: 16, paddingHorizontal: 18, gap: 12 },
  solto: { gap: 10 },
  titulo: { fontFamily: fontes.titulo, fontSize: 20, lineHeight: 24, color: cores.texto },
  linha: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  nome: { width: 80, fontFamily: fontes.regular, fontSize: 13, color: cores.textoMedio },
  trilho: { flex: 1, height: 10, borderRadius: 5, backgroundColor: cores.divisor, overflow: 'hidden' },
  valores: { width: 62, alignItems: 'flex-end' },
  valor: { fontFamily: fontes.semi, fontSize: 13, color: cores.texto },
  area: { fontFamily: fontes.regular, fontSize: 11, lineHeight: 14, color: cores.textoSuave },
  legenda: { fontFamily: fontes.regular, fontSize: 11, lineHeight: 14, color: cores.textoSuave },
});
