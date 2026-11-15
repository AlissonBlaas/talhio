# Contexto do produto

Resumo do que foi decidido antes de começar o código. Leia antes de propor mudanças de escopo.

## O problema

Fazendas com frota de várias marcas não têm relatório padronizado das máquinas. Hoje o operador
configura o monitor na mão, muitas vezes sem treinamento (há operadores que não leem), e os
relatórios são montados no papel ou por serviço terceirizado caro.

## A proposta

> Você planeja, o trator recebe, o operador confirma e todos os dados chegam prontos no relatório final.

1. Talhões e linhas AB já desenhados na John Deere aparecem no app. Se faltar algum, cria no app.
2. O admin manda o plano para o trator (cultura, semente, adubo, linha).
3. O operador só confirma no monitor e recebe um áudio no WhatsApp com máquina e talhão do dia.
4. O admin acompanha em tempo real no celular.
5. No fim do expediente, todos os dados chegam no relatório, sem ninguém montar nada.

Princípio central: **o operador não se envolve**. Talhão vem do GPS, operação vem do implemento e
do plano, operador vem da escala. Nada depende do que ele seleciona no monitor.

## Usuários

- **Admin / agrônomo:** usa o app. É para quem as telas são desenhadas.
- **Encarregado:** recebe a escala e o resumo.
- **Operador:** não usa o app. Recebe áudio e confirma no monitor da máquina.

## Escopo do MVP

- Só John Deere, só máquinas com internet (modem JDLink), via Operations Center.
- Outras marcas (CNH, AGCO) e máquinas sem internet ficam para depois, como novos provedores.
- Primeiro teste real: 1 trator por 2 dias, comparando o relatório do sistema com o manual.
- Depois: piloto pago com a fazenda do agrônomo.

## John Deere: o que sabemos

- O app conecta como aplicação autorizada pela fazenda (OAuth). A conta é da fazenda.
- APIs que cobrem o fluxo: Equipment, Machine Locations, Machine Device State Reports,
  Fields, Boundaries, Guidance Lines, Work Plans, Field Operations, Operators, Webhook.
- Os talhões já foram desenhados pelo pessoal da John Deere e podem ser exportados em arquivo.
- As linhas AB hoje são criadas pelo operador. O agrônomo quer criá-las pelo admin, e quer
  linhas pré-definidas por fazenda, reaproveitáveis entre talhões.
- O app começa em Sandbox. Produção exige análise da John Deere e só é necessária para vender
  a outras fazendas.
- A confirmar com o suporte: se Work Plans e Guidance Lines funcionam no Sandbox com uma
  organização real, e o limite de organizações no Sandbox.
- Nunca usar login e senha da fazenda: o acesso é como membro da organização e via OAuth.

## Como o sistema sabe das coisas

- **Em qual talhão a máquina está:** posição GPS dentro do polígono do talhão.
- **Se está conectada:** horário do último dado recebido (online, sem sinal, sem internet).
- **Se terminou:** cobertura do talhão perto de 100% e a máquina saiu ou parou.
  Só "parou" não é "terminou".
- **Área trabalhada:** trajeto vezes largura do implemento.

## IA

- Diferencial do produto: aba própria no app, com chat sobre os dados da fazenda.
- Regra: o backend calcula os números, a IA só interpreta e escreve. No chat, a IA escolhe
  entre funções fixas do backend; não consulta o banco livremente.
- Relatório do dia e da semana com resumo escrito e comparação com o período anterior.

## Negócio

- Cobrança pensada por máquina por mês (o principal concorrente cobra por área).
- Concorrentes: Cropwise Operations (Syngenta), PTx FarmENGAGE (AGCO), Solinftec, Vivo.
  Nenhum publica preço. A queixa ouvida: complexos e sem todos os dados necessários.
- Referência de valor: há fazenda gastando cerca de R$ 500 mil por ano com serviço
  terceirizado para montar relatório.

## Referências

- Protótipo navegável das 13 telas: https://claude.ai/artifact/7QHUAKkZynNw8p6x9GjDAj
- Guia de arquitetura completo: https://claude.ai/artifact/UviBkLA9dM7FAsjr614Lmh

## Próximos passos de código

1. Banco: Postgres + PostGIS (Docker), talhões e posições persistidos.
2. Login do app e conexão OAuth com a John Deere.
3. `DeereProvedor` real, assim que o Sandbox for liberado.
4. Tela de mapa com talhões e máquinas.
5. Planejamento e envio ao trator, depois escala, ao vivo, relatórios e assistente.
