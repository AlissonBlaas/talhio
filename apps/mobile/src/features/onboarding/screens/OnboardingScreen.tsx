import { useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { adiarOnboarding, PassoConexao, useConexaoDeere } from '@/features/conexao';
import { PassoImportar } from '@/features/importacao';
import { PassoLarguras, useMaquinas } from '@/features/maquinas';
import { useTalhoes } from '@/features/talhoes';
import { PassoWhatsapp, useWhatsapp } from '@/features/whatsapp';
import { CabecalhoTela } from '@/shared/components/CabecalhoTela';
import { useSessao } from '@/shared/lib/sessao';
import { cores, fontes, MARGEM_TELA } from '@/shared/theme/tokens';

import { SePular } from '../components/SePular';

type Passo = 1 | 2 | 3 | 4;

const TITULOS: Record<Passo, { titulo: string; apoio: string }> = {
  1: { titulo: 'Conecte a John Deere', apoio: 'É de lá que vêm as máquinas, as horas e o combustível.' },
  2: { titulo: 'Traga os talhões', apoio: 'Com os contornos, o relatório sabe onde cada máquina trabalhou.' },
  3: { titulo: 'Ligue o WhatsApp da fazenda', apoio: 'O relatório e a escala chegam direto no grupo da equipe.' },
  4: { titulo: 'Informe a largura dos implementos', apoio: 'É a largura que transforma os metros andados em hectares.' },
};

/**
 * Primeiros passos de quem acabou de criar a conta, em quatro etapas: John Deere (obrigatória), talhões, WhatsApp e
 * largura dos implementos (opcionais). Cada etapa opcional mostra, antes dos botões, o que a pessoa fica sem se pular.
 */
export function OnboardingScreen() {
  const router = useRouter();
  const { bottom } = useSafeAreaInsets();
  const sessao = useSessao();
  const { conexao } = useConexaoDeere();
  const { talhoes } = useTalhoes();
  const { whatsapp } = useWhatsapp();
  const { maquinas } = useMaquinas();
  const nome = sessao.status === 'logado' ? sessao.usuario.nome.split(' ')[0] : '';

  // Servidor de demonstração não tem John Deere para ligar: o primeiro passo já conta como feito.
  const deerePronta = conexao?.estado === 'pronto' || conexao?.modo === 'demonstracao';
  const temTalhoes = talhoes.length > 0;
  const whatsappPronto = whatsapp?.estado === 'conectado' && !!whatsapp.grupo;
  const comLargura = maquinas.filter((m) => m.larguraImplementoM !== null).length;
  const feitos: Record<Passo, boolean> = { 1: !!deerePronta, 2: temTalhoes, 3: !!whatsappPronto, 4: maquinas.length > 0 && comLargura === maquinas.length };

  // Quem abre com a John Deere já ligada começa no segundo passo.
  const [escolhido, setEscolhido] = useState<Passo | null>(null);
  const passo: Passo = escolhido ?? (deerePronta ? 2 : 1);
  const ir = (para: Passo) => setEscolhido(para);

  const entrar = () => {
    // Sem a John Deere, o convite voltaria na hora: fica para a próxima abertura do app.
    if (!deerePronta) adiarOnboarding();
    router.replace('/');
  };

  const { titulo, apoio } = TITULOS[passo];
  // O que ficou para trás sem fazer, para lembrar no último passo.
  const pendentes = [!feitos[2] && 'os talhões', !feitos[3] && 'o WhatsApp'].filter((p): p is string => !!p);

  return (
    <KeyboardAvoidingView style={styles.tela} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={[styles.conteudo, { paddingBottom: Math.max(bottom, 16) + 24 }]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <CabecalhoTela
          titulo={passo === 1 && nome ? `Bem-vindo, ${nome}` : titulo}
          subtitulo={`Passo ${passo} de 4 · ${passo === 1 ? 'obrigatório' : 'opcional'}`}
          progresso={[1, 2, 3, 4].map((n) => n <= passo)}
        />
        <View style={styles.corpo}>
          <View style={styles.abertura}>
            <Text style={styles.titulo}>{titulo}</Text>
            <Text style={styles.apoio}>{apoio}</Text>
          </View>

          {passo === 1 ? (
            <>
              <Cartao>
                <PassoConexao />
              </Cartao>
              {deerePronta ? (
                <Principal rotulo="Continuar" aoTocar={() => ir(2)} />
              ) : (
                <>
                  <Text style={styles.obrigatorio}>Este passo é o único obrigatório. Sem a John Deere, o Talhio não tem máquinas, relatório nem mapa para mostrar.</Text>
                  <Secundario rotulo="Fazer depois" aoTocar={entrar} />
                </>
              )}
            </>
          ) : null}

          {passo === 2 ? (
            <>
              <Cartao>
                {temTalhoes ? <Text style={styles.jaTem}>Esta fazenda já tem {talhoes.length} {talhoes.length === 1 ? 'talhão' : 'talhões'}. Se quiser, importe o arquivo do monitor para trazer os outros.</Text> : null}
                <PassoImportar />
              </Cartao>
              <SePular
                feito={temTalhoes}
                textoFeito="Talhões no lugar: o relatório já separa o trabalho por talhão."
                itens={[
                  'A área trabalhada aparece só no total. Não dá para saber quantos hectares e quantas horas foram em cada talhão.',
                  'No relatório, quase tudo cai em "fora dos talhões".',
                  'O mapa fica sem os contornos, sem o andamento de cada talhão e sem os planos.',
                ]}
              />
              <Avancar feito={temTalhoes} aoAvancar={() => ir(3)} aoVoltar={() => ir(1)} />
            </>
          ) : null}

          {passo === 3 ? (
            <>
              <Cartao>
                <PassoWhatsapp />
              </Cartao>
              <SePular
                feito={!!whatsappPronto}
                textoFeito="WhatsApp ligado: o relatório e a escala vão direto ao grupo."
                itens={[
                  'O relatório não chega sozinho no grupo da fazenda.',
                  'Para enviar, você abre o WhatsApp do seu celular e manda na mão, toda vez.',
                  'A escala do dia também não vai direto para a equipe.',
                ]}
              />
              <Avancar feito={!!whatsappPronto} aoAvancar={() => ir(4)} aoVoltar={() => ir(2)} />
            </>
          ) : null}

          {passo === 4 ? (
            <>
              <Cartao>
                <PassoLarguras />
              </Cartao>
              <SePular
                feito={feitos[4]}
                textoFeito="Larguras informadas: os hectares usam o implemento de cada máquina."
                itens={[
                  'O Talhio calcula os hectares com a largura das linhas do talhão ou, sem elas, com 12 m para toda máquina.',
                  'Se o implemento for mais estreito ou mais largo que isso, a área trabalhada e o consumo por hectare saem errados.',
                  comLargura > 0 ? `Faltam ${maquinas.length - comLargura} de ${maquinas.length} máquinas.` : 'Vale informar pelo menos as máquinas que estão trabalhando agora.',
                ]}
              />
              {pendentes.length > 0 ? <Text style={styles.pendentes}>Ficou para depois: {pendentes.join(' e ')}. Dá para fazer em Configurações, em "Rever os primeiros passos".</Text> : null}
              <Principal rotulo={feitos[4] ? 'Entrar no app' : comLargura > 0 ? 'Entrar no app' : 'Entrar sem informar as larguras'} aoTocar={entrar} />
              <Secundario rotulo="Voltar" aoTocar={() => ir(3)} />
            </>
          ) : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Cartao({ children }: { children: ReactNode }) {
  return <View style={styles.cartao}>{children}</View>;
}

function Principal({ rotulo, aoTocar }: { rotulo: string; aoTocar: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={aoTocar} style={styles.botao}>
      <Text style={styles.botaoTexto}>{rotulo}</Text>
    </Pressable>
  );
}

function Secundario({ rotulo, aoTocar }: { rotulo: string; aoTocar: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={aoTocar} style={styles.depois}>
      <Text style={styles.depoisTexto}>{rotulo}</Text>
    </Pressable>
  );
}

/** Passo opcional: feito, o botão principal é "Continuar"; sem fazer, é "Pular por enquanto", em contorno. */
function Avancar({ feito, aoAvancar, aoVoltar }: { feito: boolean; aoAvancar: () => void; aoVoltar: () => void }) {
  return (
    <>
      {feito ? (
        <Principal rotulo="Continuar" aoTocar={aoAvancar} />
      ) : (
        <Pressable accessibilityRole="button" onPress={aoAvancar} style={styles.pular}>
          <Text style={styles.pularTexto}>Pular por enquanto</Text>
        </Pressable>
      )}
      <Secundario rotulo="Voltar" aoTocar={aoVoltar} />
    </>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  conteudo: { flexGrow: 1, gap: 20 },
  corpo: { paddingHorizontal: MARGEM_TELA, gap: 16 },
  abertura: { gap: 6 },
  titulo: { fontFamily: fontes.titulo, fontSize: 26, lineHeight: 30, color: cores.texto },
  apoio: { fontFamily: fontes.regular, fontSize: 16, lineHeight: 22, color: cores.textoMedio },
  cartao: { backgroundColor: cores.cartao, borderWidth: 1, borderColor: cores.borda, borderRadius: 26, padding: 18, gap: 14 },
  jaTem: { fontFamily: fontes.regular, fontSize: 15, lineHeight: 21, color: cores.textoMedio },
  obrigatorio: { fontFamily: fontes.regular, fontSize: 14, lineHeight: 20, color: cores.textoMedio },
  pendentes: { fontFamily: fontes.regular, fontSize: 14, lineHeight: 20, color: cores.textoMedio },
  botao: { minHeight: 54, borderRadius: 27, backgroundColor: cores.milho, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  botaoTexto: { fontFamily: fontes.rotulo, fontSize: 17, color: cores.sobreMilho },
  pular: { minHeight: 54, borderRadius: 27, borderWidth: 2, borderColor: cores.mata, alignItems: 'center', justifyContent: 'center' },
  pularTexto: { fontFamily: fontes.rotulo, fontSize: 17, color: cores.mata },
  depois: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  depoisTexto: { fontFamily: fontes.rotuloLeve, fontSize: 16, color: cores.textoMedio },
});
