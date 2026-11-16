import { CadastrarSchema } from '@talhio/shared';
import { useRouter } from 'expo-router';
import { useRef, useState, type ComponentRef, type RefObject } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CabecalhoTela } from '@/shared/components/CabecalhoTela';
import { Icone } from '@/shared/components/Icone';
import { cores, fontes, MARGEM_TELA } from '@/shared/theme/tokens';

import { useCadastrar } from '../hooks/useCadastrar';

type Campo = 'nome' | 'fazenda' | 'email' | 'senha';
const MENSAGEM: Record<Campo, string> = {
  nome: 'Digite seu nome',
  fazenda: 'Digite o nome da fazenda',
  email: 'Digite um e-mail válido',
  senha: 'A senha precisa de pelo menos 8 caracteres',
};

type Entrada = React.ComponentProps<typeof TextInput>;

interface CampoProps {
  rotulo: string;
  valor: string;
  aoMudar: (texto: string) => void;
  aoEnviar: () => void;
  proximo: boolean;
  desabilitado: boolean;
  comErro: boolean;
  mensagem: string;
  entradaRef: RefObject<ComponentRef<typeof TextInput> | null>;
  extras: Entrada;
}

/** Um campo do formulário. Componente próprio: cada um tem o seu ref e a tela não monta campos dentro de funções. */
function CampoTexto({ rotulo, valor, aoMudar, aoEnviar, proximo, desabilitado, comErro, mensagem, entradaRef, extras }: CampoProps) {
  return (
    <View style={styles.campo}>
      <Text style={styles.rotulo}>{rotulo}</Text>
      <TextInput
        ref={entradaRef}
        value={valor}
        onChangeText={aoMudar}
        placeholderTextColor={cores.textoSuave}
        editable={!desabilitado}
        returnKeyType={proximo ? 'next' : 'go'}
        onSubmitEditing={aoEnviar}
        style={[styles.entrada, comErro && styles.entradaErro]}
        {...extras}
      />
      {comErro ? <Text style={styles.erroCampo}>{mensagem}</Text> : null}
    </View>
  );
}

/** Conta nova: cria a fazenda e o primeiro usuário, que é o administrador. */
export function CadastroScreen() {
  const { bottom } = useSafeAreaInsets();
  const router = useRouter();
  const { cadastrar, cadastrando, emAnalise, erro, limparErro } = useCadastrar();
  const [dados, setDados] = useState({ nome: '', fazenda: '', email: '', senha: '' });
  const [tentou, setTentou] = useState(false);
  const refNome = useRef<ComponentRef<typeof TextInput>>(null);
  const refFazenda = useRef<ComponentRef<typeof TextInput>>(null);
  const refEmail = useRef<ComponentRef<typeof TextInput>>(null);
  const refSenha = useRef<ComponentRef<typeof TextInput>>(null);

  const validacao = CadastrarSchema.safeParse(dados);
  const comErro = (campo: Campo) => tentou && !validacao.success && validacao.error.issues.some((i) => i.path[0] === campo);
  const mudar = (campo: Campo, texto: string) => {
    setDados((atual) => ({ ...atual, [campo]: texto }));
    if (erro) limparErro();
  };
  const enviar = () => {
    setTentou(true);
    if (validacao.success) cadastrar(validacao.data);
  };

  // Cadastro recebido: a conta existe, mas só entra depois que a gente libera.
  if (emAnalise) {
    return (
      <View style={styles.tela}>
        <CabecalhoTela titulo="Cadastro recebido" subtitulo="Falta só a nossa liberação." />
        <View style={[styles.conteudo, { paddingBottom: Math.max(bottom, 16) + 24 }]}>
          <View accessibilityRole="alert" style={styles.recebido}>
            <Text style={styles.recebidoTitulo}>Vamos entrar em contato</Text>
            <Text style={styles.recebidoTexto}>
              Recebemos o cadastro de {dados.fazenda.trim()}. Cada conta nova passa pela nossa aprovação antes de ser ativada.
            </Text>
            <Text style={styles.recebidoTexto}>
              Avisamos em {dados.email.trim().toLowerCase()} quando a conta estiver liberada. Aí é só entrar com esse e-mail e a senha que você acabou de criar.
            </Text>
          </View>
          <Pressable accessibilityRole="button" onPress={() => router.replace('/login')} style={styles.botao}>
            <Text style={styles.botaoTexto}>Voltar para o login</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.tela} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <CabecalhoTela titulo="Criar conta" subtitulo="Você será o administrador da fazenda. A conta é ativada depois da nossa aprovação." voltar />
      <ScrollView contentContainerStyle={[styles.conteudo, { paddingBottom: Math.max(bottom, 16) + 24 }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <CampoTexto
          rotulo="Seu nome"
          valor={dados.nome}
          aoMudar={(t) => mudar('nome', t)}
          aoEnviar={() => refFazenda.current?.focus()}
          proximo
          desabilitado={cadastrando}
          comErro={comErro('nome')}
          mensagem={MENSAGEM.nome}
          entradaRef={refNome}
          extras={{ placeholder: 'Maria Souza', autoComplete: 'name', textContentType: 'name', autoCapitalize: 'words' }}
        />
        <CampoTexto
          rotulo="Nome da fazenda"
          valor={dados.fazenda}
          aoMudar={(t) => mudar('fazenda', t)}
          aoEnviar={() => refEmail.current?.focus()}
          proximo
          desabilitado={cadastrando}
          comErro={comErro('fazenda')}
          mensagem={MENSAGEM.fazenda}
          entradaRef={refFazenda}
          extras={{ placeholder: 'Fazenda Boa Safra', autoCapitalize: 'words' }}
        />
        <CampoTexto
          rotulo="E-mail"
          valor={dados.email}
          aoMudar={(t) => mudar('email', t)}
          aoEnviar={() => refSenha.current?.focus()}
          proximo
          desabilitado={cadastrando}
          comErro={comErro('email')}
          mensagem={MENSAGEM.email}
          entradaRef={refEmail}
          extras={{ placeholder: 'voce@fazenda.com.br', keyboardType: 'email-address', autoComplete: 'email', textContentType: 'username', autoCapitalize: 'none', autoCorrect: false }}
        />
        <CampoTexto
          rotulo="Senha"
          valor={dados.senha}
          aoMudar={(t) => mudar('senha', t)}
          aoEnviar={enviar}
          proximo={false}
          desabilitado={cadastrando}
          comErro={comErro('senha')}
          mensagem={MENSAGEM.senha}
          entradaRef={refSenha}
          extras={{ placeholder: 'Mínimo 8 caracteres', secureTextEntry: true, autoComplete: 'new-password', textContentType: 'newPassword', autoCapitalize: 'none', autoCorrect: false }}
        />

        {erro ? (
          <View accessibilityRole="alert" style={styles.erro}>
            <Icone nome="atencao" cor={cores.perigoTexto} tamanho={18} />
            <Text style={styles.erroTexto}>{erro.message}</Text>
          </View>
        ) : null}

        <Pressable accessibilityRole="button" accessibilityState={{ busy: cadastrando }} disabled={cadastrando} onPress={enviar} style={styles.botao}>
          {cadastrando ? <ActivityIndicator color={cores.sobreMilho} /> : <Text style={styles.botaoTexto}>Criar conta</Text>}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  conteudo: { paddingHorizontal: MARGEM_TELA, paddingTop: 22, gap: 16 },
  campo: { gap: 6 },
  rotulo: { fontFamily: fontes.medio, fontSize: 13, lineHeight: 16, color: cores.textoMedio },
  entrada: { height: 52, paddingHorizontal: 14, borderRadius: 22, borderWidth: 1, borderColor: cores.campoBorda, backgroundColor: cores.cartao, fontFamily: fontes.regular, fontSize: 16, color: cores.texto },
  entradaErro: { borderColor: cores.erroBorda },
  erroCampo: { fontFamily: fontes.regular, fontSize: 12, lineHeight: 15, color: cores.perigo },
  erro: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: cores.perigoFundo, borderWidth: 1, borderColor: cores.perigoBorda, borderRadius: 22, paddingVertical: 12, paddingHorizontal: 14 },
  erroTexto: { flex: 1, fontFamily: fontes.medio, fontSize: 13, lineHeight: 18, color: cores.perigoTexto },
  recebido: { backgroundColor: cores.primarioSuave, borderRadius: 24, padding: 18, gap: 10 },
  recebidoTitulo: { fontFamily: fontes.titulo, fontSize: 20, lineHeight: 24, color: cores.textoSobreSuave },
  recebidoTexto: { fontFamily: fontes.regular, fontSize: 15, lineHeight: 22, color: cores.textoSobreSuave },
  botao: { height: 54, borderRadius: 999, backgroundColor: cores.milho, alignItems: 'center', justifyContent: 'center' },
  botaoTexto: { fontFamily: fontes.rotulo, fontSize: 17, color: cores.sobreMilho },
});
