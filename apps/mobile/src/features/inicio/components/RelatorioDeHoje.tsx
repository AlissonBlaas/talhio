import type { Painel } from '@talhio/shared';
import { useRouter } from 'expo-router';
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BarrasPorMaquina, indicadoresDe, rotuloDoPeriodo, textoParaCompartilhar, useRelatorio } from '@/features/relatorios';
import { ConectarWhatsapp, useEnviarAoGrupo } from '@/features/whatsapp';
import { Icone } from '@/shared/components/Icone';
import { cores, fontes } from '@/shared/theme/tokens';

import { usePainelParte } from '../hooks/usePainelParte';

const fazendaDe = (p: Painel) => p.fazendaNome;

/** O relatório de hoje em papel: três números, barras por máquina, o resumo e dois botões em pílula. */
export const RelatorioDeHoje = memo(function RelatorioDeHoje() {
  const { relatorio } = useRelatorio('dia', null);
  const fazenda = usePainelParte(fazendaDe);
  const router = useRouter();
  const envio = useEnviarAoGrupo();
  if (!relatorio) return null;
  // O servidor manda o PDF e o resumo direto no grupo da fazenda. Sem WhatsApp conectado o botão fica desligado.
  const aoEnviar = () => void envio.enviar({ texto: textoParaCompartilhar(relatorio, fazenda), relatorio: { periodo: 'dia', data: null } });
  const aoVerSemana = () => router.navigate('/relatorios');
  const [area, horas, , parado] = indicadoresDe(relatorio);
  const numeros = [area, horas, parado];
  return (
    <View style={styles.papel}>
      <Text style={styles.data}>{rotuloDoPeriodo(relatorio)}</Text>
      <Text style={styles.titulo}>Relatório do dia</Text>

      <View style={styles.numeros}>
        {numeros.map((n) => (
          <View key={n.rotulo} style={styles.numero}>
            <Text style={styles.valor} numberOfLines={1} adjustsFontSizeToFit>
              {n.valor}
            </Text>
            <Text style={styles.rotulo}>{n.rotulo}</Text>
          </View>
        ))}
      </View>

      <BarrasPorMaquina maquinas={relatorio.porMaquina} semCartao />
      <Text style={styles.resumo}>{relatorio.resumo}</Text>

      <View style={styles.botoes}>
        <Pressable accessibilityRole="button" accessibilityState={{ disabled: !envio.paraOGrupo }} disabled={envio.enviando || !envio.paraOGrupo} onPress={aoEnviar} style={[styles.botao, styles.primario, !envio.paraOGrupo && styles.desligado]}>
          <Icone nome="enviar" cor={cores.sobreMilho} tamanho={18} espessura={2.2} />
          <Text style={[styles.botaoTexto, { color: cores.sobreMilho }]} numberOfLines={1} adjustsFontSizeToFit>
            {envio.rotulo('Enviar ao grupo')}
          </Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={aoVerSemana} style={[styles.botao, styles.contorno]}>
          <Text style={[styles.botaoTexto, { color: cores.mata }]}>Ver semana</Text>
        </Pressable>
      </View>
      <ConectarWhatsapp />
    </View>
  );
});

const styles = StyleSheet.create({
  papel: { backgroundColor: cores.cartao, borderWidth: 1, borderColor: cores.borda, borderRadius: 28, padding: 20, gap: 14 },
  data: { fontFamily: fontes.italico, fontSize: 14, color: cores.textoSuave },
  titulo: { fontFamily: fontes.titulo, fontSize: 26, lineHeight: 30, color: cores.texto, marginTop: -8 },
  numeros: { flexDirection: 'row', gap: 10 },
  numero: { flex: 1, gap: 2 },
  valor: { fontFamily: fontes.titulo, fontSize: 24, lineHeight: 28, color: cores.mata },
  rotulo: { fontFamily: fontes.regular, fontSize: 12, lineHeight: 15, color: cores.textoSuave },
  resumo: { fontFamily: fontes.regular, fontSize: 15, lineHeight: 22, color: cores.textoMedio },
  botoes: { flexDirection: 'row', gap: 10 },
  botao: { minHeight: 48, borderRadius: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 14 },
  primario: { flex: 1.6, backgroundColor: cores.milho },
  desligado: { opacity: 0.5 },
  contorno: { flex: 1, borderWidth: 2, borderColor: cores.mata },
  botaoTexto: { fontFamily: fontes.rotulo, fontSize: 15 },
});
