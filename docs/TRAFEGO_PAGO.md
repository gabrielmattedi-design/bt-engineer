# TRAFEGO_PAGO.md — a primeira campanha

> Plano da primeira compra de mídia do Tennis Engineer. Orçamento aprovado: **R$ 500**.
> Escrito em 08/09/2026, contra os preços e o rastreamento que estão no ar hoje.

---

## 1. A conta que decide tudo, antes de qualquer criativo

O ticket é **R$ 29,99** (`racket_report`) e **R$ 49,99** (`full_setup`). Depois da taxa do Mercado
Pago (~5%), o relatório simples deixa cerca de **R$ 28,50 líquidos**.

Isso é um ticket BAIXO para tráfego frio de rede social. A conta de guardanapo:

```
CPC de R$ 0,80  ÷  conversão de 3%  =  CPA de R$ 26,67
```

Contra R$ 28,50 líquidos, isso é **empate**. E 3% de visitante-para-pagante em tráfego frio, num
funil que exige responder um questionário inteiro antes de pagar, é uma hipótese otimista.

**A conclusão não é "não anuncie".** É que a primeira campanha não tem como ter lucro por objetivo,
e fingir o contrário leva a desligá-la na primeira semana por um motivo errado. O que ela tem de
entregar é outra coisa:

> **O trabalho da primeira campanha é descobrir três números que hoje não existem:**
> o CPC real deste público, a taxa de quem clica e termina o questionário, e a taxa de quem termina
> e paga. Com os três, dá para calcular se tráfego pago pode funcionar aqui — e nenhum deles pode
> ser estimado de fora.

---

## 2. Por que R$ 500 não compra um teste de 4 criativos

Existem 2 reels e 2 estáticos prontos. A vontade natural é testar os quatro. O orçamento não deixa,
e vale entender por quê antes de dividir a verba em quatro.

O Meta precisa de aproximadamente **50 conversões por semana por conjunto de anúncios** para sair
da fase de aprendizado e otimizar de verdade. A R$ 29,99 de ticket, 50 compras semanais são
R$ 1.500 de receita — muito além do que R$ 500 de verba total produz. **Nenhum conjunto vai sair da
fase de aprendizado**, e um teste de quatro braços com R$ 125 em cada mede sobretudo ruído.

Duas saídas honestas, e a segunda é a recomendada:

| | Como | O que se aprende | O que NÃO se aprende |
|---|---|---|---|
| A | 4 anúncios, R$ 125 cada, conjuntos separados | nada com confiança | — |
| **B** | **1 conjunto, os 4 anúncios dentro, entrega livre** | **qual gancho o público responde, barato** | se os perdedores eram ruins ou só tiveram azar |

Na opção B o próprio Meta concentra a verba em um ou dois nos primeiros dias. Isso identifica um
vencedor por muito menos dinheiro do que um teste controlado — e é preciso ser explícito sobre o
que ele **não** prova: um criativo que recebeu R$ 30 e parou não foi reprovado, foi preterido.
Guarde os três perdedores para a próxima campanha em vez de descartá-los.

---

## 3. Por qual evento otimizar — e por que não é a compra

Otimizar por compra exige volume de compra, que R$ 500 não geram. Otimizar por clique compra
cliques baratos de quem não faz nada depois.

**Otimize pelo meio do funil: "iniciou o questionário".** Ele acontece dezenas de vezes mais que a
compra, o que dá ao algoritmo sinal suficiente para aprender, e ainda assim exige uma intenção real
— ninguém começa um questionário técnico de raquete por acidente.

O funil interno já marca as seis etapas (`start`, `analysis`, `plans`, `checkout`, `paid`,
`report`), então a leitura de verdade continua sendo nossa; o evento no Meta existe para o
algoritmo, não para o relatório.

### O número que define sucesso

Não é o CPA, é o **custo por início de questionário**. E o limiar sai do seu próprio funil:

```
custo máximo por início  =  R$ 28,50  ×  (taxa de quem inicia o questionário e paga)
```

Com 5% de início-para-pagante, o teto é **R$ 1,42 por início**. Com 10%, é R$ 2,85. Você não sabe
qual é a taxa hoje — **e é exatamente isso que a campanha vai medir**. Rode duas semanas, abra o
`/admin/funil`, e a divisão dá o limiar real. A partir daí a decisão de escalar deixa de ser
palpite.

---

## 4. A estrutura, concreta

| | |
|---|---|
| Plataforma | Meta (Instagram + Facebook), campanha única |
| Objetivo | Vendas, otimizando pelo evento de início de questionário |
| Conjuntos | **1** |
| Anúncios | **4** (2 reels + 2 estáticos) |
| Verba | **R$ 35/dia × 14 dias = R$ 490** |
| Público | Brasil, 25–55, interesse em tênis. **Sem** segmentação fina |
| Posicionamento | Automático (Advantage+) |

**Público amplo, e não detalhado.** Com R$ 490 o algoritmo precisa de espaço para achar quem
responde; um público de 30 mil pessoas gasta a verba inteira aprendendo a alcançá-lo. Interesse em
tênis já é filtro suficiente num país onde tênis é nicho.

**Uma landing só: a home.** Ela já leva ao questionário, e mandar tráfego pago para uma página nova
significaria testar criativo e página ao mesmo tempo, sem saber qual dos dois explicou o resultado.

### Os links, com UTM por criativo

Isto não é burocracia: **é o que faz a coluna "Criativo" do `/admin/funil` existir.** Sem
`utm_content` diferente por anúncio, os quatro somam numa linha só e o teste não responde nada.

```
https://tennisengineer.com.br/?utm_source=meta&utm_medium=cpc&utm_campaign=teste-set-01&utm_content=reel-3-erros
https://tennisengineer.com.br/?utm_source=meta&utm_medium=cpc&utm_campaign=teste-set-01&utm_content=reel-47-colocada
https://tennisengineer.com.br/?utm_source=meta&utm_medium=cpc&utm_campaign=teste-set-01&utm_content=estatico-55-porcento
https://tennisengineer.com.br/?utm_source=meta&utm_medium=cpc&utm_campaign=teste-set-01&utm_content=estatico-4-7
```

Troque os nomes de `utm_content` pelos seus, mas **mantenha um por criativo e não repita**. O
primeiro toque vence (ver `schema/campaigns.ts`), então quem clicar em dois anúncios fica creditado
ao primeiro — o que é o comportamento certo e mais um motivo para os nomes serem distintos.

---

## 5. O que precisa estar pronto ANTES de gastar o primeiro real

Nesta ordem. O item 1 é bloqueante.

### 1. Pixel do Meta + API de Conversões + banner de consentimento — ⛔ não existe

Hoje o projeto não tem `fbq`, não tem `gtag`, não tem nada. Sem pixel, a campanha não consegue nem
otimizar pelo evento do meio do funil — ela vira compra de cliques.

**O dono aprovou instalar, com banner de consentimento.** É uma reversão deliberada da postura de
privacidade que o produto assumiu por escrito (`funnel_markers` e `visitor_campaigns` não guardam
IP, referrer nem impressão digital), e por isso não entra escondido:

- pixel carregado **só depois** do aceite, nunca antes;
- banner com recusa tão fácil quanto o aceite;
- `/privacidade` atualizada dizendo o que o pixel coleta e para quê;
- API de Conversões no servidor, para o evento de compra sobreviver a bloqueador.

**Uma expectativa a ajustar:** neste orçamento o pixel muda pouco o resultado da campanha, porque
não haverá volume para otimizar por compra de qualquer jeito. O que ele faz é **começar a acumular
histórico** — é a próxima campanha, e não esta, que colhe o benefício. Instalar agora é o certo;
esperar que ele salve o CPA desta aqui, não.

### 2. Evento de início de questionário disparando para o Meta

Depois do pixel, o evento que a campanha otimiza. O marco interno `start` já existe; falta espelhá-lo.

### 3. Conferir a home no celular, com olho de tráfego frio

Quem vem de anúncio não conhece a marca e decide em três segundos. Vale abrir a home no celular e
perguntar: em três segundos dá para saber o que isto faz e quanto custa? Se o preço só aparece
depois do questionário inteiro, parte do abandono vai ser por isso e não pelo anúncio.

---

## 6. Como ler o resultado, e quando desligar

**Não mexa em nada nos primeiros 4 dias.** Toda alteração reinicia a fase de aprendizado, e com
R$ 35/dia não há verba para reaprender. A vontade de otimizar no dia 2 é o erro mais caro que
existe em campanha pequena.

Da primeira semana em diante, no `/admin/funil`, janela de 7 dias:

| Sintoma | Leitura | O que fazer |
|---|---|---|
| CPC alto, muitos chegam, poucos terminam | anúncio promete outra coisa | trocar o gancho, não o público |
| Terminam e não pagam | público certo, oferta ou preço errados | mexer na página de planos, não no anúncio |
| Um `utm_content` come toda a verba | o Meta já escolheu | deixar, e guardar os outros três |
| Ninguém inicia o questionário | a home não converte tráfego frio | pausar e consertar a home antes de gastar mais |

**O critério de parada, escrito antes de começar** — porque depois de gastar é tarde para ser
imparcial: se ao fim dos R$ 490 o custo por início de questionário estiver **acima do dobro** do
limiar calculado na §3, tráfego pago frio não fecha a conta com este ticket. A saída então não é
mais verba: é ticket maior (empurrar `full_setup`), funil mais curto, ou outro canal.

---

## 7. O que este plano deliberadamente não faz

- **Não faz retargeting.** Com R$ 490 não há público acumulado para retargetear. Fica para a
  segunda campanha, quando o pixel tiver histórico.
- **Não testa a landing.** Uma variável por vez; o criativo é a desta.
- **Não usa Google.** Busca por "qual raquete de tênis comprar" tem intenção muito maior e
  provavelmente CPA menor — mas volume pequeno no Brasil, e outro plano. Vale como segundo passo.
- **Não promete lucro.** Ver §1.

---

## 8. Registro do que existe hoje, para comparar depois

Estado em 08/09/2026, antes de qualquer real gasto:

| | |
|---|---|
| Preço | R$ 29,99 · R$ 49,99 |
| Pixel | nenhum |
| Rastreamento próprio | primeiro toque por `utm_*`, 6 marcos de funil, cruzável por visitante |
| Relatório por criativo | **passou a existir em 08/09** — o `utm_content` era gravado e nunca lido |
| Campanhas anteriores | nenhuma |
