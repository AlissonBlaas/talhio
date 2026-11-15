import type { Painel } from '@talhio/shared';
import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { cores, fontes } from '@/shared/theme/tokens';

import { usePainelParte } from '../hooks/usePainelParte';

const contagemDe = (p: Painel) => p.contagem;

/** Contadores do topo da tela Início. Ficam sobre o verde-lavoura, separados por fios, sem cartões. */
export const ResumoStatus = memo(function ResumoStatus() {
  const contagem = usePainelParte(contagemDe);
  if (!contagem) return null;
  return (
    <View style={styles.linha}>
      <Bloco valor={contagem.trabalhando} rotulo="Trabalhando" corPonto={cores.folhaClara} corValor={cores.textoSobreEscuro} />
      <Bloco valor={contagem.parada} rotulo={contagem.parada === 1 ? 'Parada' : 'Paradas'} corPonto={cores.milho} corValor={cores.milho} separado />
      <Bloco valor={contagem.semSinal} rotulo="Sem sinal" corValor={cores.textoSobreEscuro} separado />
    </View>
  );
});

type BlocoProps = { valor: number; rotulo: string; corValor: string; corPonto?: string; separado?: boolean };

function Bloco({ valor, rotulo, corValor, corPonto, separado }: BlocoProps) {
  return (
    <View style={[styles.bloco, separado && styles.separado]}>
      <Text style={[styles.valor, { color: corValor }]}>{valor}</Text>
      <View style={styles.legenda}>
        <View style={[styles.ponto, corPonto ? { backgroundColor: corPonto } : styles.pontoVazado]} />
        <Text style={styles.rotulo}>{rotulo}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  linha: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: 'rgba(241,242,236,0.2)', paddingTop: 14 },
  bloco: { flex: 1, gap: 2 },
  separado: { paddingLeft: 16, borderLeftWidth: 1, borderLeftColor: 'rgba(241,242,236,0.2)' },
  valor: { fontFamily: fontes.titulo, fontSize: 43, lineHeight: 45 },
  legenda: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  ponto: { width: 9, height: 9, borderRadius: 5 },
  pontoVazado: { borderWidth: 2, borderColor: '#B9C7B4' },
  rotulo: { fontFamily: fontes.regular, fontSize: 14, lineHeight: 18, color: cores.suaveSobreEscuro },
});
