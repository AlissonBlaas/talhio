import type { Maquina } from '@talhio/shared';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { useSessao } from '@/shared/lib/sessao';
import { cores, fontes } from '@/shared/theme/tokens';

import { useDefinirLargura } from '../hooks/useDefinirLargura';

const comVirgula = (v: number) => String(v).replace('.', ',');

/**
 * Largura do implemento que a máquina está puxando. É ela que transforma os metros andados em hectares; sem ela o
 * servidor usa a largura das linhas do talhão. Só o administrador altera; os demais só veem.
 */
export function LarguraDoImplemento({ maquina }: { maquina: Maquina }) {
  const sessao = useSessao();
  const admin = sessao.status === 'logado' && sessao.usuario.papel === 'admin';
  const { definir, salvando, erro } = useDefinirLargura(maquina.id);
  const atual = maquina.larguraImplementoM;
  const [texto, setTexto] = useState(atual === null ? '' : comVirgula(atual));

  const digitado = texto.trim() === '' ? null : Number(texto.replace(',', '.'));
  const valido = digitado === null || (Number.isFinite(digitado) && digitado >= 0.5 && digitado <= 60);
  const mudou = valido && digitado !== atual;

  return (
    <View style={styles.linha}>
      <View style={styles.topo}>
        <Text style={styles.rotulo}>Largura do implemento</Text>
        {admin ? (
          <View style={styles.campo}>
            <TextInput
              accessibilityLabel="Largura do implemento em metros"
              value={texto}
              onChangeText={setTexto}
              placeholder="—"
              placeholderTextColor={cores.textoSuave}
              keyboardType="decimal-pad"
              maxLength={5}
              style={styles.entrada}
            />
            <Text style={styles.unidade}>m</Text>
          </View>
        ) : (
          <Text style={styles.valor}>{atual === null ? '—' : `${comVirgula(atual)} m`}</Text>
        )}
      </View>
      <Text style={[styles.apoio, !valido && styles.erro]}>
        {!valido ? 'Use um valor entre 0,5 e 60 metros.' : atual === null ? 'Sem largura informada: os hectares usam a largura das linhas do talhão.' : 'Usada para calcular os hectares desta máquina.'}
      </Text>
      {erro ? <Text style={[styles.apoio, styles.erro]}>Não deu para salvar. Tente de novo.</Text> : null}
      {admin && mudou ? (
        <Pressable accessibilityRole="button" disabled={salvando} onPress={() => definir(digitado)} style={styles.salvar}>
          <Text style={styles.salvarTexto}>{salvando ? 'Salvando…' : digitado === null ? 'Remover largura' : 'Salvar largura'}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  linha: { paddingVertical: 13, gap: 6, borderBottomWidth: 1, borderBottomColor: cores.divisor, marginBottom: -1 },
  topo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 16 },
  rotulo: { fontFamily: fontes.regular, fontSize: 14, lineHeight: 18, color: cores.textoMedio },
  valor: { fontFamily: fontes.semi, fontSize: 14, lineHeight: 18, color: cores.texto },
  campo: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  entrada: { minWidth: 64, minHeight: 44, borderRadius: 22, borderWidth: 1, borderColor: cores.borda, paddingHorizontal: 14, textAlign: 'right', fontFamily: fontes.semi, fontSize: 15, color: cores.texto, backgroundColor: cores.fundo },
  unidade: { fontFamily: fontes.semi, fontSize: 14, color: cores.textoMedio },
  apoio: { fontFamily: fontes.regular, fontSize: 12, lineHeight: 16, color: cores.textoSuave },
  erro: { color: cores.aviso },
  salvar: { alignSelf: 'flex-end', minHeight: 44, borderRadius: 22, paddingHorizontal: 18, backgroundColor: cores.milho, alignItems: 'center', justifyContent: 'center' },
  salvarTexto: { fontFamily: fontes.rotulo, fontSize: 14, color: cores.sobreMilho },
});
