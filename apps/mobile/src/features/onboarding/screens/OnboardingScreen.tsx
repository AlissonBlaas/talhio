import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { adiarOnboarding, PassoConexao, useConexaoDeere } from '@/features/conexao';
import { CabecalhoTela } from '@/shared/components/CabecalhoTela';
import { useSessao } from '@/shared/lib/sessao';
import { cores, fontes, MARGEM_TELA } from '@/shared/theme/tokens';

/** Primeiros passos de quem acabou de criar a conta: ligar a fazenda à John Deere. */
export function OnboardingScreen() {
  const router = useRouter();
  const { bottom } = useSafeAreaInsets();
  const sessao = useSessao();
  const { conexao } = useConexaoDeere();
  const nome = sessao.status === 'logado' ? sessao.usuario.nome.split(' ')[0] : '';
  const estado = conexao?.estado ?? 'desconectado';
  // Conta criada, John Deere autorizada, organização escolhida e liberada.
  const progresso = [true, estado !== 'desconectado', estado === 'pronto'];
  const pronto = estado === 'pronto';

  const entrar = () => router.replace('/');
  const depois = () => {
    adiarOnboarding();
    entrar();
  };

  return (
    <View style={styles.tela}>
      <ScrollView contentContainerStyle={[styles.conteudo, { paddingBottom: Math.max(bottom, 16) + 24 }]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <CabecalhoTela titulo={nome ? `Bem-vindo, ${nome}` : 'Bem-vindo'} subtitulo="Falta pouco para ver suas máquinas e talhões." progresso={progresso} />
        <View style={styles.corpo}>
          <PassoConexao />
          {pronto ? (
            <Pressable accessibilityRole="button" onPress={entrar} style={styles.botao}>
              <Text style={styles.botaoTexto}>Entrar no app</Text>
            </Pressable>
          ) : (
            <Pressable accessibilityRole="button" onPress={depois} style={styles.depois}>
              <Text style={styles.depoisTexto}>Fazer depois</Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  conteudo: { flexGrow: 1, gap: 20 },
  corpo: { paddingHorizontal: MARGEM_TELA, gap: 16 },
  botao: { height: 54, borderRadius: 27, backgroundColor: cores.milho, alignItems: 'center', justifyContent: 'center' },
  botaoTexto: { fontFamily: fontes.rotulo, fontSize: 17, color: cores.sobreMilho },
  depois: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  depoisTexto: { fontFamily: fontes.rotuloLeve, fontSize: 16, color: cores.textoMedio },
});
