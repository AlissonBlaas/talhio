import * as Linking from 'expo-linking';
import { memo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Carregando, ErroComTentarDeNovo } from '@/shared/components/estado-tela';
import { Icone } from '@/shared/components/Icone';
import { cores, fontes } from '@/shared/theme/tokens';

import { useConectarDeere } from '../hooks/useConectarDeere';
import { useConexaoDeere } from '../hooks/useConexaoDeere';
import { useMudarConexao } from '../hooks/useMudarConexao';
import { useOrganizacoesDeere } from '../hooks/useOrganizacoesDeere';

/**
 * O passo em que a ligação com a John Deere está, com o botão para avançar.
 * Sozinho: lê o estado no servidor e não recebe props. Serve ao onboarding e à aba Config.
 */
export const PassoConexao = memo(function PassoConexao() {
  const { conexao, carregando, erro, atualizar } = useConexaoDeere();
  if (carregando) return <Carregando />;
  if (erro || !conexao) return <ErroComTentarDeNovo mensagem={erro?.message ?? 'Não consegui ver a conexão.'} aoTentar={atualizar} />;

  switch (conexao.estado) {
    case 'desconectado':
      return <Conectar />;
    case 'escolher-organizacao':
      return <EscolherOrganizacao />;
    case 'liberar-acesso':
      return <LiberarAcesso nomeDaOrganizacao={conexao.organizacaoNome} />;
    default:
      return conexao.modo === 'demonstracao' ? (
        <Aviso icone="atencao" titulo="Modo demonstração" texto="Este servidor usa dados de exemplo. Não há conta John Deere para conectar." />
      ) : (
        <ConectadaComTroca nome={conexao.organizacaoNome} />
      );
  }
});

function Conectar() {
  const { conectar, conectando, erro } = useConectarDeere();
  return (
    <View style={styles.bloco}>
      <Text style={styles.titulo}>Conecte a conta John Deere</Text>
      <Text style={styles.texto}>
        Você entra no site da John Deere e toca em Permitir. O Talhio nunca vê a sua senha. Com a permissão, lemos as máquinas, os talhões e as operações, e enviamos os planos para o monitor.
      </Text>
      <Erro mensagem={erro?.message} />
      <Botao rotulo="Conectar com a John Deere" ocupado={conectando} aoTocar={conectar} />
    </View>
  );
}

/** Conectada: mostra a fazenda atual e deixa trocar por outra organização da mesma conta John Deere. */
function ConectadaComTroca({ nome }: { nome: string | null }) {
  const [trocando, setTrocando] = useState(false);
  return (
    <View style={styles.bloco}>
      <Aviso icone="confere" titulo="John Deere conectada" texto={`Em uso: ${nome ?? '—'}. As máquinas e os talhões já podem ser lidos.`} />
      {trocando ? (
        <>
          <EscolherOrganizacao trocando aoTerminar={() => setTrocando(false)} />
          <Botao rotulo="Cancelar" contorno aoTocar={() => setTrocando(false)} />
        </>
      ) : (
        <Botao rotulo="Escolher fazendas" contorno aoTocar={() => setTrocando(true)} />
      )}
    </View>
  );
}

function EscolherOrganizacao({ trocando, aoTerminar }: { trocando?: boolean; aoTerminar?: () => void } = {}) {
  const { conexao } = useConexaoDeere();
  const { organizacoes, carregando, erro, atualizar } = useOrganizacoesDeere(true);
  const { escolher, escolhendo, erro: erroEscolha } = useMudarConexao();
  const [marcadas, setMarcadas] = useState<string[] | null>(null);
  // Começa pelas que já estão em uso; quem ainda não escolheu parte do zero.
  const selecionadas = marcadas ?? conexao?.organizacaoIds ?? [];
  const alternar = (id: string) => setMarcadas(selecionadas.includes(id) ? selecionadas.filter((x) => x !== id) : [...selecionadas, id]);
  return (
    <View style={styles.bloco}>
      <Text style={styles.titulo}>{trocando ? 'Fazendas em uso' : 'Quais organizações da fazenda?'}</Text>
      <Text style={styles.texto}>Sua conta John Deere pode ter mais de uma, e as máquinas e os talhões podem estar em organizações diferentes. Marque todas que você quer ver juntas.</Text>
      {carregando ? (
        <Carregando />
      ) : erro ? (
        <ErroComTentarDeNovo mensagem={erro.message} aoTentar={atualizar} />
      ) : organizacoes.length === 0 ? (
        <Text style={styles.texto}>Nenhuma organização encontrada nesta conta John Deere.</Text>
      ) : (
        <>
          {organizacoes.map((o) => {
            const marcada = selecionadas.includes(o.id);
            return (
              <Pressable key={o.id} accessibilityRole="checkbox" accessibilityState={{ checked: marcada }} disabled={escolhendo} onPress={() => alternar(o.id)} style={({ pressed }) => [styles.linha, marcada && styles.linhaMarcada, pressed && styles.apertado]}>
                <Text style={styles.linhaNome} numberOfLines={1}>
                  {o.nome}
                </Text>
                {o.precisaLiberar ? <Text style={styles.linhaEtiqueta}>Falta liberar</Text> : null}
                <Text style={styles.seta}>{marcada ? '✓' : '○'}</Text>
              </Pressable>
            );
          })}
          <Botao rotulo="Salvar" ocupado={escolhendo} aoTocar={() => selecionadas.length > 0 && escolher(selecionadas, { onSuccess: aoTerminar })} />
        </>
      )}
      <Erro mensagem={erroEscolha?.message} />
    </View>
  );
}

function LiberarAcesso({ nomeDaOrganizacao }: { nomeDaOrganizacao: string | null }) {
  const { organizacoes } = useOrganizacoesDeere(true);
  const { conferir, conferindo, erro } = useMudarConexao();
  const url = organizacoes.find((o) => o.nome === nomeDaOrganizacao)?.urlLiberar ?? null;
  return (
    <View style={styles.bloco}>
      <Text style={styles.titulo}>Libere o Talhio na John Deere</Text>
      <Text style={styles.texto}>
        {`A organização ${nomeDaOrganizacao ?? ''} ainda precisa liberar o acesso do Talhio. Abra o site da John Deere, marque a organização e confirme. Depois volte e toque em "Já liberei".`}
      </Text>
      {url ? <Botao rotulo="Abrir o site da John Deere" aoTocar={() => void Linking.openURL(url)} /> : null}
      <Botao rotulo="Já liberei" contorno ocupado={conferindo} aoTocar={conferir} />
      <Erro mensagem={erro?.message} />
    </View>
  );
}

function Aviso({ icone, titulo, texto }: { icone: 'confere' | 'atencao'; titulo: string; texto: string }) {
  return (
    <View style={styles.aviso}>
      <View style={styles.avisoIcone}>
        <Icone nome={icone} cor={cores.sobreMilho} tamanho={18} espessura={2.4} />
      </View>
      <View style={styles.avisoTextos}>
        <Text style={styles.titulo}>{titulo}</Text>
        <Text style={styles.texto}>{texto}</Text>
      </View>
    </View>
  );
}

function Erro({ mensagem }: { mensagem?: string }) {
  if (!mensagem) return null;
  return (
    <View accessibilityRole="alert" style={styles.erro}>
      <Icone nome="atencao" cor={cores.perigoTexto} tamanho={18} />
      <Text style={styles.erroTexto}>{mensagem}</Text>
    </View>
  );
}

function Botao({ rotulo, aoTocar, ocupado, contorno }: { rotulo: string; aoTocar: () => void; ocupado?: boolean; contorno?: boolean }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ busy: !!ocupado }} disabled={ocupado} onPress={aoTocar} style={[styles.botao, contorno ? styles.botaoContorno : styles.botaoCheio]}>
      {ocupado ? <ActivityIndicator color={contorno ? cores.mata : cores.sobreMilho} /> : <Text style={[styles.botaoTexto, contorno && { color: cores.mata }]}>{rotulo}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bloco: { gap: 12 },
  titulo: { fontFamily: fontes.titulo, fontSize: 22, lineHeight: 26, color: cores.texto },
  texto: { fontFamily: fontes.regular, fontSize: 15, lineHeight: 22, color: cores.textoMedio },
  botao: { minHeight: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  botaoCheio: { backgroundColor: cores.milho },
  botaoContorno: { borderWidth: 2, borderColor: cores.mata },
  botaoTexto: { fontFamily: fontes.rotulo, fontSize: 17, color: cores.sobreMilho },
  linha: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: cores.cartao, borderWidth: 1, borderColor: cores.borda, borderRadius: 24, paddingHorizontal: 18 },
  linhaMarcada: { borderColor: cores.mata, borderWidth: 2 },
  apertado: { opacity: 0.7 },
  linhaNome: { flex: 1, fontFamily: fontes.rotulo, fontSize: 17, color: cores.texto },
  linhaEtiqueta: { fontFamily: fontes.rotuloLeve, fontSize: 12, color: cores.alerta },
  seta: { fontFamily: fontes.regular, fontSize: 24, color: cores.textoSuave },
  aviso: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  avisoIcone: { width: 32, height: 32, borderRadius: 16, backgroundColor: cores.milho, alignItems: 'center', justifyContent: 'center' },
  avisoTextos: { flex: 1, gap: 4 },
  erro: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: cores.perigoFundo, borderWidth: 1, borderColor: cores.perigoBorda, borderRadius: 22, paddingVertical: 12, paddingHorizontal: 14 },
  erroTexto: { flex: 1, fontFamily: fontes.medio, fontSize: 13, lineHeight: 18, color: cores.perigoTexto },
});
