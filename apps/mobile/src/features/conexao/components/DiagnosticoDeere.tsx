import { memo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { cores, fontes } from '@/shared/theme/tokens';

import { useAvisoDeere } from '../hooks/useAvisoDeere';
import { useDiagnosticoDeere } from '../hooks/useDiagnosticoDeere';

/** Mostra, para o administrador, o que a John Deere respondeu em cada parte (status e quantidade). */
export const DiagnosticoDeere = memo(function DiagnosticoDeere() {
  const { passos, carregando, falhou, rodar } = useDiagnosticoDeere();
  const aviso = useAvisoDeere();
  return (
    <View style={styles.caixa}>
      <Pressable accessibilityRole="button" disabled={carregando} onPress={rodar} style={styles.botao}>
        {carregando ? <ActivityIndicator color={cores.mata} /> : <Text style={styles.botaoTexto}>Ver diagnóstico da John Deere</Text>}
      </Pressable>
      <Pressable accessibilityRole="button" disabled={aviso.ativando} onPress={aviso.ativar} style={styles.botao}>
        {aviso.ativando ? <ActivityIndicator color={cores.mata} /> : <Text style={styles.botaoTexto}>{aviso.resultado ? 'Conferir avisos da John Deere de novo' : 'Ligar avisos de dados novos da John Deere'}</Text>}
      </Pressable>
      <Text style={styles.nota}>
        {aviso.erro
          ? aviso.erro.message
          : aviso.resultado
            ? aviso.resultado.avisos.map((a) => `${a.evento}: ${{ criado: 'criado', 'ja-ligado': 'já estava ligado', reativado: 'ligado de novo', recusado: `recusado (${a.detalhe ?? ''})` }[a.situacao]}`).join(' · ') || `Situação: ${aviso.resultado.status ?? 'não informada'}`
            : 'Cria até 5 avisos na sua conta John Deere (export pronto, operação de campo, talhão, contorno e linha) para os dados chegarem na hora. Sem eles, o Talhio confere a cada 2 minutos.'}
      </Text>
      {falhou ? <Text style={styles.nota}>Não consegui rodar o diagnóstico. Tente de novo.</Text> : null}
      {passos?.map((p) => (
        <View key={p.passo} style={styles.linha}>
          <Text style={styles.passo}>{p.passo}</Text>
          <Text style={styles.valor}>{`${p.status}${p.total !== null ? ` · ${p.total}` : ''}`}</Text>
          {p.nota ? <Text style={styles.nota}>{p.nota}</Text> : null}
        </View>
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  caixa: { gap: 8, paddingTop: 12 },
  botao: { minHeight: 44, borderRadius: 999, borderWidth: 1, borderColor: cores.campoBorda, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  botaoTexto: { fontFamily: fontes.rotulo, fontSize: 14, color: cores.mata },
  linha: { gap: 2 },
  passo: { fontFamily: fontes.medio, fontSize: 13, color: cores.texto },
  valor: { fontFamily: fontes.regular, fontSize: 13, color: cores.textoMedio },
  nota: { fontFamily: fontes.regular, fontSize: 12, lineHeight: 16, color: cores.textoMedio },
});
