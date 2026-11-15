import type { GrupoDaAnalise, ItemDaAnalise } from '@talhio/shared';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Icone } from '@/shared/components/Icone';
import { horasMinutos } from '@/shared/lib/format';
import { cores, fontes } from '@/shared/theme/tokens';

import { PERIODOS_DA_ANALISE, useAnaliseDaMaquina, type PeriodoDaAnalise } from '../hooks/useAnaliseDaMaquina';

/** Grupos que já abrem expandidos: o que mais se consulta. */
const ABERTOS_NO_INICIO = new Set(['Machine Utilization by Machine State', 'Fuel Information']);

const numero = (valor: number, casas = 2) => valor.toLocaleString('pt-BR', { maximumFractionDigits: casas });

/** "13h07" para horas, "347,2 L", "82,8 %". Sem valor da Deere, "—" (não é zero). */
export function formatarValor(valor: number | null, unidade: string): string {
  if (valor === null) return '—';
  if (unidade === 'h') return horasMinutos(valor);
  return unidade ? `${numero(valor)} ${unidade}` : numero(valor);
}

/**
 * Todos os dados da máquina: as medições do Analisador da Máquina do Operations Center, agrupadas como lá, num
 * período (hoje, ontem, 7 ou 30 dias). Só aparece com telemetria ativa.
 */
export function AnaliseDaMaquina({ maquinaId, telemetriaAtiva }: { maquinaId: string; telemetriaAtiva: boolean }) {
  const [periodo, setPeriodo] = useState<PeriodoDaAnalise>('hoje');
  const { analise, carregando, erro, atualizar } = useAnaliseDaMaquina(maquinaId, periodo, telemetriaAtiva);
  if (!telemetriaAtiva) return null;
  return (
    <View style={styles.secao}>
      <Text style={styles.titulo}>Todos os dados</Text>
      <View style={styles.periodos}>
        {PERIODOS_DA_ANALISE.map((p) => (
          <Pressable key={p.id} accessibilityRole="button" accessibilityState={{ selected: periodo === p.id }} onPress={() => setPeriodo(p.id)} style={[styles.chip, periodo === p.id ? styles.chipAtivo : null]}>
            <Text style={[styles.chipTexto, periodo === p.id ? styles.chipTextoAtivo : null]}>{p.rotulo}</Text>
          </Pressable>
        ))}
      </View>
      {carregando ? (
        <View style={styles.estado}>
          <ActivityIndicator color={cores.primario} />
        </View>
      ) : erro ? (
        <View style={styles.estado}>
          <Text style={styles.estadoTexto}>Não consegui ler os dados da máquina agora.</Text>
          <Pressable accessibilityRole="button" onPress={atualizar} style={styles.tentar}>
            <Text style={styles.tentarTexto}>Tentar de novo</Text>
          </Pressable>
        </View>
      ) : !analise || analise.grupos.length === 0 ? (
        <View style={styles.estado}>
          <Text style={styles.estadoTexto}>A máquina não reportou medições neste período.</Text>
        </View>
      ) : (
        analise.grupos.map((g) => <Grupo key={`${periodo}-${g.id}`} grupo={g} />)
      )}
      <Text style={styles.rodape}>Dados enviados pela telemetria da John Deere, em blocos de 30 minutos. Podem chegar com atraso.</Text>
    </View>
  );
}

function Grupo({ grupo }: { grupo: GrupoDaAnalise }) {
  const [aberto, setAberto] = useState(ABERTOS_NO_INICIO.has(grupo.id));
  return (
    <View style={styles.cartao}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: aberto }} accessibilityLabel={`${grupo.nome}, ${grupo.itens.length} medições`} onPress={() => setAberto((v) => !v)} style={styles.cabecalho}>
        <Text style={styles.grupoNome}>{grupo.nome}</Text>
        <Text style={styles.contagem}>{grupo.itens.length}</Text>
        <View style={aberto ? styles.setaAberta : styles.setaFechada}>
          <Icone nome="expandir" cor={cores.textoSuave} tamanho={18} />
        </View>
      </Pressable>
      {aberto ? grupo.itens.map((item) => <Item key={item.id} item={item} />) : null}
    </View>
  );
}

function Item({ item }: { item: ItemDaAnalise }) {
  if (item.tipo === 'valor') {
    return (
      <View style={styles.linha}>
        <Text style={styles.rotulo}>{item.nome}</Text>
        <Text style={styles.valor}>{formatarValor(item.valor, item.unidade)}</Text>
      </View>
    );
  }
  return (
    <View style={styles.linha}>
      <Text style={styles.rotulo}>{item.nome}</Text>
      <View style={styles.faixas}>
        {item.faixas.map((f) => (
          <View key={f.rotulo} style={styles.faixa}>
            <Text style={styles.faixaRotulo}>{f.rotulo}</Text>
            <Text style={styles.faixaValor}>{formatarValor(f.valor, item.unidade)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  secao: { gap: 8 },
  titulo: { fontFamily: fontes.semi, fontSize: 13, lineHeight: 16, color: cores.textoSuave },
  periodos: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: { minHeight: 40, paddingHorizontal: 16, borderRadius: 20, backgroundColor: cores.cartao, borderWidth: 1, borderColor: cores.borda, alignItems: 'center', justifyContent: 'center' },
  chipAtivo: { backgroundColor: cores.primario, borderColor: cores.primario },
  chipTexto: { fontFamily: fontes.semi, fontSize: 14, color: cores.texto },
  chipTextoAtivo: { color: cores.cartao },
  estado: { backgroundColor: cores.cartao, borderWidth: 1, borderColor: cores.borda, borderRadius: 22, padding: 20, alignItems: 'center', gap: 12 },
  estadoTexto: { fontFamily: fontes.regular, fontSize: 14, lineHeight: 18, color: cores.textoMedio, textAlign: 'center' },
  tentar: { minHeight: 44, paddingHorizontal: 18, borderRadius: 22, backgroundColor: cores.primarioSuave, alignItems: 'center', justifyContent: 'center' },
  tentarTexto: { fontFamily: fontes.semi, fontSize: 14, color: cores.primario },
  cartao: { backgroundColor: cores.cartao, borderWidth: 1, borderColor: cores.borda, borderRadius: 22, paddingHorizontal: 16, overflow: 'hidden' },
  cabecalho: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 10 },
  grupoNome: { flex: 1, fontFamily: fontes.semi, fontSize: 15, lineHeight: 19, color: cores.texto },
  contagem: { fontFamily: fontes.regular, fontSize: 13, color: cores.textoSuave },
  setaAberta: { transform: [{ rotate: '180deg' }] },
  setaFechada: {},
  linha: { paddingVertical: 12, gap: 8, borderTopWidth: 1, borderTopColor: cores.divisor },
  rotulo: { fontFamily: fontes.regular, fontSize: 14, lineHeight: 18, color: cores.textoMedio },
  valor: { fontFamily: fontes.semi, fontSize: 15, lineHeight: 19, color: cores.texto },
  faixas: { gap: 6 },
  faixa: { flexDirection: 'row', justifyContent: 'space-between', gap: 16 },
  faixaRotulo: { flexShrink: 1, fontFamily: fontes.regular, fontSize: 13, lineHeight: 17, color: cores.textoSuave },
  faixaValor: { fontFamily: fontes.semi, fontSize: 13, lineHeight: 17, color: cores.texto },
  rodape: { fontFamily: fontes.regular, fontSize: 11, lineHeight: 15, color: cores.textoSuave },
});
