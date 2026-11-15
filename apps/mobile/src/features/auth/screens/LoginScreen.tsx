import { EntrarSchema } from '@talhio/shared';
import { useRouter } from 'expo-router';
import { useRef, useState, type ComponentRef } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icone } from '@/shared/components/Icone';
import { Marca } from '@/shared/components/Marca';
import { IMAGEM_DEMO } from '@/shared/lib/fazendaDemo';
import { cores, fontes } from '@/shared/theme/tokens';

import { useEntrar } from '../hooks/useEntrar';

export function LoginScreen() {
  const { bottom } = useSafeAreaInsets();
  const router = useRouter();
  const { entrar, entrando, erro, limparErro } = useEntrar();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [tentou, setTentou] = useState(false);
  const campoSenha = useRef<ComponentRef<typeof TextInput>>(null);

  const validacao = EntrarSchema.safeParse({ email, senha });
  const campoComErro = (campo: 'email' | 'senha') => tentou && !validacao.success && validacao.error.issues.some((i) => i.path[0] === campo);

  const enviar = () => {
    setTentou(true);
    if (validacao.success) entrar(validacao.data);
  };
  const aoDigitar = (definir: (texto: string) => void) => (texto: string) => {
    definir(texto);
    if (erro) limparErro();
  };

  return (
    <KeyboardAvoidingView style={styles.tela} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.capa}>
        <Image source={IMAGEM_DEMO.fonte} style={styles.capaImagem} resizeMode="cover" />
        <View style={styles.capaVeu} />
        <View style={styles.capaTextos}>
          <View style={styles.marca}>
            <Marca tamanho={40} />
            <Text style={styles.marcaNome}>talhio</Text>
          </View>
          <Text style={styles.chamada}>Suas máquinas e talhões, num relatório só.</Text>
        </View>
      </View>

      <ScrollView
        style={styles.folha}
        contentContainerStyle={[styles.folhaConteudo, { paddingBottom: Math.max(bottom, 16) + 16 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <Text style={styles.titulo}>Entrar</Text>

        <View style={styles.campo}>
          <Text style={styles.rotulo}>E-mail</Text>
          <TextInput
            value={email}
            onChangeText={aoDigitar(setEmail)}
            placeholder="voce@fazenda.com.br"
            placeholderTextColor={cores.textoSuave}
            keyboardType="email-address"
            textContentType="username"
            autoComplete="email"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
            onSubmitEditing={() => campoSenha.current?.focus()}
            editable={!entrando}
            style={[styles.entrada, campoComErro('email') && styles.entradaErro]}
          />
          {campoComErro('email') ? <Text style={styles.erroCampo}>Digite um e-mail válido</Text> : null}
        </View>

        <View style={styles.campo}>
          <Text style={styles.rotulo}>Senha</Text>
          <TextInput
            ref={campoSenha}
            value={senha}
            onChangeText={aoDigitar(setSenha)}
            placeholder="Sua senha"
            placeholderTextColor={cores.textoSuave}
            secureTextEntry
            textContentType="password"
            autoComplete="current-password"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="go"
            onSubmitEditing={enviar}
            editable={!entrando}
            style={[styles.entrada, campoComErro('senha') && styles.entradaErro]}
          />
          {campoComErro('senha') ? <Text style={styles.erroCampo}>Digite a senha (mínimo 6 caracteres)</Text> : null}
        </View>

        {erro ? (
          <View accessibilityRole="alert" style={styles.erro}>
            <Icone nome="atencao" cor={cores.perigoTexto} tamanho={18} />
            <Text style={styles.erroTexto}>{erro.message}</Text>
          </View>
        ) : null}

        <Pressable accessibilityRole="button" accessibilityState={{ busy: entrando }} disabled={entrando} onPress={enviar} style={styles.botao}>
          {entrando ? <ActivityIndicator color={cores.sobreMilho} /> : <Text style={styles.botaoTexto}>Entrar</Text>}
        </Pressable>

        <Pressable accessibilityRole="button" onPress={() => router.navigate('/cadastro')} style={styles.criar}>
          <Text style={styles.criarTexto}>Primeira vez aqui? Criar conta</Text>
        </Pressable>

        <Text style={styles.rodape}>Esqueceu a senha? Fale com o administrador da fazenda.</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  capa: { height: 330, backgroundColor: cores.mapaFundo, overflow: 'hidden' },
  capaImagem: { position: 'absolute', left: -300, top: -260, width: 1178, height: 923 },
  capaVeu: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(18,32,26,0.55)' },
  capaTextos: { position: 'absolute', left: 24, right: 24, bottom: 64, gap: 8 },
  marca: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  marcaIcone: { width: 40, height: 40, borderRadius: 12, backgroundColor: cores.primario, alignItems: 'center', justifyContent: 'center' },
  marcaNome: { fontFamily: fontes.titulo, fontSize: 20, color: cores.sobreEscuro },
  chamada: { fontFamily: fontes.titulo, fontSize: 28, lineHeight: 31, color: cores.sobreEscuro },
  folha: { flex: 1, marginTop: -40, backgroundColor: cores.fundo, borderTopLeftRadius: 28, borderTopRightRadius: 28 },
  folhaConteudo: { paddingTop: 28, paddingHorizontal: 24, gap: 16 },
  titulo: { fontFamily: fontes.titulo, fontSize: 22, lineHeight: 25, color: cores.texto },
  campo: { gap: 6 },
  rotulo: { fontFamily: fontes.medio, fontSize: 13, lineHeight: 16, color: cores.textoMedio },
  entrada: {
    height: 52,
    paddingHorizontal: 14,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: cores.campoBorda,
    backgroundColor: cores.cartao,
    fontFamily: fontes.regular,
    fontSize: 16,
    color: cores.texto,
  },
  entradaErro: { borderColor: cores.erroBorda },
  erroCampo: { fontFamily: fontes.regular, fontSize: 12, lineHeight: 15, color: cores.perigo },
  erro: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: cores.perigoFundo, borderWidth: 1, borderColor: cores.perigoBorda, borderRadius: 22, paddingVertical: 12, paddingHorizontal: 14 },
  erroTexto: { flex: 1, fontFamily: fontes.medio, fontSize: 13, lineHeight: 18, color: cores.perigoTexto },
  botao: { height: 54, borderRadius: 999, backgroundColor: cores.milho, alignItems: 'center', justifyContent: 'center' },
  botaoTexto: { fontFamily: fontes.rotulo, fontSize: 17, color: cores.sobreMilho },
  criar: { minHeight: 48, borderRadius: 24, borderWidth: 2, borderColor: cores.mata, alignItems: 'center', justifyContent: 'center' },
  criarTexto: { fontFamily: fontes.rotulo, fontSize: 16, color: cores.mata },
  rodape: { fontFamily: fontes.regular, fontSize: 13, lineHeight: 19, color: cores.textoSuave, textAlign: 'center' },
});
