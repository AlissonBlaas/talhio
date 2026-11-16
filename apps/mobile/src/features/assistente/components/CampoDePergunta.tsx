import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, PanResponder, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { AnelPulsante } from '@/shared/components/animacoes';
import { Icone } from '@/shared/components/Icone';
import { cores, fontes } from '@/shared/theme/tokens';

import type { GravacaoDeVoz } from '../hooks/useGravacaoDeVoz';

type Props = {
  texto: string;
  aoMudar: (texto: string) => void;
  aoEnviar: () => void;
  /** A gravação por voz (segurar, soltar, cancelar). O campo só desenha. */
  voz: GravacaoDeVoz;
  ocupado: boolean;
};

/** Quanto arrastar o dedo para a esquerda para cancelar o áudio. */
const DESLIZE_PARA_CANCELAR = 90;

const relogio = (segundos: number) => `${Math.floor(segundos / 60)}:${String(segundos % 60).padStart(2, '0')}`;

/**
 * Campo de pergunta do assistente, com o áudio igual ao do WhatsApp: sem texto, o botão é o microfone; segura para
 * falar, solta para enviar, arrasta para a esquerda para cancelar. Com texto digitado, o botão vira "enviar".
 */
export function CampoDePergunta({ texto, aoMudar, aoEnviar, voz, ocupado }: Props) {
  const temTexto = texto.trim().length > 0;
  const [deslize, setDeslize] = useState(0);
  const vaiCancelar = deslize <= -DESLIZE_PARA_CANCELAR;

  // O gesto é criado uma vez; estas referências deixam ele chamar sempre a versão atual das funções.
  const acoes = useRef(voz);
  const livre = useRef(!ocupado);
  useEffect(() => {
    acoes.current = voz;
    livre.current = !ocupado;
  });
  const gesto = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => livre.current,
      onMoveShouldSetPanResponder: () => false,
      // Nenhuma lista ou tela por baixo toma o gesto no meio da gravação.
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        setDeslize(0);
        acoes.current.comecar();
      },
      onPanResponderMove: (_evento, toque) => setDeslize(Math.min(0, toque.dx)),
      onPanResponderRelease: (_evento, toque) => {
        if (toque.dx <= -DESLIZE_PARA_CANCELAR) acoes.current.cancelar();
        else acoes.current.soltar();
        setDeslize(0);
      },
      onPanResponderTerminate: () => {
        acoes.current.cancelar();
        setDeslize(0);
      },
    }),
  ).current;

  return (
    <View style={styles.bloco}>
      {/* O que o aparelho está entendendo, para a pessoa conferir nome de talhão e número antes de soltar. */}
      {voz.gravando && voz.parcial ? (
        <Text numberOfLines={3} style={styles.parcial}>
          {voz.parcial}
        </Text>
      ) : null}
      <View style={[styles.caixa, voz.gravando && styles.caixaGravando]}>
        {voz.gravando ? (
          <View accessible accessibilityRole="timer" accessibilityLabel={`Gravando, ${voz.segundos} segundos`} style={styles.gravacao}>
            <View style={[styles.ponto, vaiCancelar && styles.pontoCancelar]} />
            <Text style={styles.tempo}>{relogio(voz.segundos)}</Text>
            <View style={[styles.dica, { transform: [{ translateX: Math.max(deslize, -DESLIZE_PARA_CANCELAR) / 2 }] }]}>
              {vaiCancelar ? null : (
                <View style={styles.seta}>
                  <Icone nome="voltar" cor={cores.textoSuave} tamanho={16} espessura={2} />
                </View>
              )}
              <Text style={[styles.dicaTexto, vaiCancelar && styles.dicaCancelar]}>{vaiCancelar ? 'Solte para cancelar' : 'Deslize para cancelar'}</Text>
            </View>
          </View>
        ) : (
          <TextInput
            value={texto}
            onChangeText={aoMudar}
            accessibilityLabel="Pergunte sobre a fazenda"
            placeholder="Pergunte sobre a fazenda…"
            placeholderTextColor={cores.textoSuave}
            multiline
            maxLength={4000}
            returnKeyType="send"
            submitBehavior="submit"
            onSubmitEditing={() => temTexto && !ocupado && aoEnviar()}
            style={styles.entrada}
          />
        )}

        {temTexto && !voz.gravando ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Enviar pergunta" accessibilityState={{ disabled: ocupado }} disabled={ocupado} onPress={aoEnviar} style={[styles.botao, ocupado ? styles.desligado : styles.enviar]}>
            {ocupado ? <ActivityIndicator color={cores.sobreMilho} size="small" /> : <Icone nome="enviar" cor={cores.sobreMilho} tamanho={18} espessura={2} />}
          </Pressable>
        ) : (
          <View
            {...gesto.panHandlers}
            accessible
            accessibilityRole="button"
            accessibilityLabel="Falar por áudio"
            accessibilityHint="Segure para falar e solte para enviar. Deslize para a esquerda para cancelar."
            accessibilityState={{ disabled: ocupado, selected: voz.gravando }}
            style={[styles.botao, voz.gravando ? (vaiCancelar ? styles.microfoneCancelar : styles.microfoneGravando) : ocupado ? styles.desligado : styles.enviar, voz.gravando && styles.microfoneGrande]}>
            {voz.gravando && !vaiCancelar ? <AnelPulsante cor={cores.perigo} tamanho={52} /> : null}
            {ocupado && !voz.gravando ? (
              <ActivityIndicator color={cores.sobreMilho} size="small" />
            ) : (
              <Icone nome={vaiCancelar ? 'fechar' : 'microfone'} cor={voz.gravando ? cores.textoSobreEscuro : cores.sobreMilho} tamanho={voz.gravando ? 22 : 20} espessura={2} />
            )}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bloco: { gap: 6 },
  parcial: { fontFamily: fontes.italico, fontSize: 14, lineHeight: 19, color: cores.textoMedio, paddingHorizontal: 16 },
  caixa: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, backgroundColor: cores.cartao, borderWidth: 1, borderColor: cores.bordaForte, borderRadius: 26, paddingVertical: 4, paddingRight: 4, paddingLeft: 16 },
  caixaGravando: { alignItems: 'center', borderColor: cores.perigo },
  entrada: { flex: 1, minHeight: 44, maxHeight: 120, paddingTop: 12, paddingBottom: 12, fontFamily: fontes.regular, fontSize: 16, lineHeight: 21, color: cores.texto },
  gravacao: { flex: 1, minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 10 },
  ponto: { width: 10, height: 10, borderRadius: 5, backgroundColor: cores.perigo },
  pontoCancelar: { backgroundColor: cores.textoSuave },
  tempo: { fontFamily: fontes.rotuloLeve, fontSize: 16, color: cores.texto, fontVariant: ['tabular-nums'], minWidth: 40 },
  dica: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 2, paddingRight: 6 },
  seta: { opacity: 0.8 },
  dicaTexto: { fontFamily: fontes.regular, fontSize: 14, color: cores.textoSuave },
  dicaCancelar: { fontFamily: fontes.semi, color: cores.perigo },
  botao: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  enviar: { backgroundColor: cores.milho },
  desligado: { backgroundColor: cores.desabilitado },
  microfoneGravando: { backgroundColor: cores.perigo },
  microfoneCancelar: { backgroundColor: cores.textoSuave },
  microfoneGrande: { transform: [{ scale: 1.2 }] },
});
