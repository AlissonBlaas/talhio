import type { Periodo } from '@talhio/shared';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Surgir } from '@/shared/components/animacoes';
import { useAlturaDaBarra } from '@/shared/components/BarraDeAbas';
import { CabecalhoTela } from '@/shared/components/CabecalhoTela';
import { ErroComTentarDeNovo } from '@/shared/components/estado-tela';
import { Icone } from '@/shared/components/Icone';
import { useEnviarAoGrupo } from '@/features/whatsapp';
import { cores, fontes, MARGEM_TELA } from '@/shared/theme/tokens';

import { BarrasPorMaquina } from '../components/BarrasPorMaquina';
import { CartaoResumo } from '../components/CartaoResumo';
import { GradeIndicadores } from '../components/GradeIndicadores';
import { RelatorioEsqueleto } from '../components/RelatorioEsqueleto';
import { SeletorData } from '../components/SeletorData';
import { SeletorMaquinas } from '../components/SeletorMaquinas';
import { SeletorPeriodo } from '../components/SeletorPeriodo';
import { useBaixarPdf } from '../hooks/useBaixarPdf';
import { useRelatorio } from '../hooks/useRelatorio';
import { mover } from '../datas';
import { indicadoresDe, rotuloDoPeriodo, textoParaCompartilhar } from '../textos';

export function RelatoriosScreen() {
  const alturaBarra = useAlturaDaBarra();
  const [periodo, setPeriodo] = useState<Periodo>('dia');
  // null = o período corrente (hoje, últimos 7 dias, mês atual); senão AAAA-MM-DD.
  const [data, setData] = useState<string | null>(null);
  // Vazio = todas as máquinas da fazenda. Vale para a tela, o PDF e o envio ao grupo.
  const [maquinaIds, setMaquinaIds] = useState<string[]>([]);
  const { relatorio, carregando, trocando, erro, atualizando, atualizar, refazerPara } = useRelatorio(periodo, data, maquinaIds);
  // Toda escolha de máquinas refaz o relatório do zero: esqueleto, busca nova e a tela remontada.
  const escolherMaquinas = (ids: string[]) => {
    refazerPara(ids);
    setMaquinaIds(ids);
  };
  const { baixar, baixando, erro: erroPdf } = useBaixarPdf();
  const envio = useEnviarAoGrupo();
  const trocarPeriodo = (novo: Periodo) => {
    setPeriodo(novo);
    setData(null);
  };

  return (
    <View style={styles.tela}>
      <ScrollView
        contentContainerStyle={[styles.conteudo, { paddingBottom: alturaBarra + 16 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={atualizando} onRefresh={atualizar} tintColor={cores.milho} />}>
        <CabecalhoTela titulo="Relatório">
          <SeletorPeriodo valor={periodo} aoMudar={trocarPeriodo} />
          <SeletorData
            rotulo={relatorio && !trocando ? rotuloDoPeriodo(relatorio) : ' '}
            noAtual={data === null}
            aoVoltar={() => setData(mover(data, periodo, -1))}
            aoAvancar={() => setData(mover(data, periodo, 1))}
            aoIrParaHoje={() => setData(null)}
          />
        </CabecalhoTela>

        <SeletorMaquinas escolhidas={maquinaIds} aoMudar={escolherMaquinas} />

        {carregando ? (
          <RelatorioEsqueleto />
        ) : erro || !relatorio ? (
          <View style={styles.espera}>
            <ErroComTentarDeNovo mensagem={erro?.message ?? 'Sem dados para o relatório.'} aoTentar={atualizar} />
          </View>
        ) : (
          // Enquanto o período novo carrega, o anterior fica visível, esmaecido.
          <View style={[styles.corpo, trocando && styles.esmaecido]}>
            {/* A chave troca com o período: o conteúdo novo entra animado, em sequência. */}
            <Surgir key={`resumo-${relatorio.periodo}-${maquinaIds.join(',')}`}>
              <CartaoResumo titulo={relatorio.periodo === 'dia' ? 'Resumo do dia' : relatorio.periodo === 'mes' ? 'Resumo do mês' : 'Resumo da semana'} texto={relatorio.resumo} />
            </Surgir>
            <GradeIndicadores key={`indicadores-${relatorio.periodo}-${maquinaIds.join(',')}`} indicadores={indicadoresDe(relatorio)} />
            <Surgir key={`barras-${relatorio.periodo}-${maquinaIds.join(',')}`} ordem={5}>
              <BarrasPorMaquina maquinas={relatorio.porMaquina} />
            </Surgir>
            <Pressable accessibilityRole="button" disabled={trocando || envio.enviando} onPress={() => void envio.enviar({ texto: textoParaCompartilhar(relatorio), relatorio: { periodo, data, maquinaIds } })} style={styles.botao}>
              <Icone nome="enviar" cor={cores.sobreMilho} tamanho={20} espessura={2.2} />
              <Text style={styles.botaoTexto}>{envio.rotulo('Enviar no WhatsApp')}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={trocando || baixando}
              onPress={() => baixar({ periodo, data, relatorio, maquinaIds })}
              style={[styles.botao, styles.botaoContorno, baixando && styles.esmaecido]}>
              <Icone nome="baixar" cor={cores.escuro} tamanho={20} espessura={2.2} />
              <Text style={styles.botaoContornoTexto}>{baixando ? 'Gerando PDF…' : 'Baixar PDF com gráficos'}</Text>
            </Pressable>
            {erroPdf ? <Text style={styles.erro}>{erroPdf.message}</Text> : null}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  conteudo: { gap: 16, flexGrow: 1 },
  espera: { flex: 1, minHeight: 320 },
  corpo: { gap: 14, paddingHorizontal: MARGEM_TELA },
  esmaecido: { opacity: 0.5 },
  botao: { height: 54, borderRadius: 27, backgroundColor: cores.milho, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  botaoContorno: { backgroundColor: 'transparent', borderWidth: 2, borderColor: cores.escuro },
  botaoContornoTexto: { fontFamily: fontes.rotulo, fontSize: 17, color: cores.escuro },
  erro: { fontFamily: fontes.medio, fontSize: 14, color: cores.perigoTexto, textAlign: 'center' },
  botaoTexto: { fontFamily: fontes.rotulo, fontSize: 17, color: cores.sobreMilho },
});
