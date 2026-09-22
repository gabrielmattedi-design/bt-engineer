# OPERACAO_DA_CAMPANHA.md — o que se aprende depois que ela já está rodando

`COMO_SUBIR_A_CAMPANHA.md` ensina a montar. `TRAFEGO_PAGO.md` decide o que anunciar e por quê.
**Este arquivo é o terceiro tempo:** a campanha está no ar, o dinheiro está saindo, e as decisões
passam a ser sobre orçamento, leitura de número e quando NÃO mexer.

Escrito entre 09 e 14/09/2026, durante a primeira campanha. Quase tudo aqui nasceu de erro — meu,
na maioria das vezes — e a seção mais importante do arquivo é a dos erros de método, no fim.

---

## 1. A mecânica do Meta que a gente precisou descobrir

Tudo nesta seção é da documentação do próprio Meta, lida na interface durante a operação. O que é
observação nossa está marcado como tal.

### 1.1 A fase de aprendizado

> *"Os conjuntos saem da fase de aprendizado assim que o desempenho se estabiliza. Isso normalmente
> ocorre após cerca de **50 resultados na semana após a última edição significativa** do conjunto."*

Três coisas que essa frase carrega e que mudam a operação:

- O relógio é **por conjunto de anúncios**, não por campanha nem por conta.
- Ele conta a partir da **última edição significativa**, não do início da campanha.
- São **~50 em 7 dias** — uma janela móvel, não um acumulado.

E o que acontece durante:

> *"Durante a fase de aprendizado, os conjuntos são **menos estáveis e geralmente apresentam um CPA
> mais alto**."*

**Dia ruim durante aprendizado é o esperado, não é sinal.** Ver §5.1 para o laço que isso cria.

### 1.2 O que conta como "edição significativa"

A definição do Meta, literal:

> *"Uma edição importante é quando você **pausa** seu conjunto de anúncios ou faz uma alteração no
> **evento de otimização**, no **público** ou no **criativo**. Alterações na **estratégia de lances**
> ou no **orçamento** também podem ser significativas, **dependendo da magnitude da alteração**."*

| Reinicia | Não está na lista |
|---|---|
| Pausar o conjunto | Data de início/término |
| Evento de otimização | |
| Público | |
| Criativo (inclusive ADICIONAR um anúncio) | |
| Estratégia de lances | |
| Orçamento — **por magnitude** | |

**A regra dos "20%" não é documentada.** É folclore de mercado. O que o Meta escreve é "dependendo
da magnitude", sem número. Eu apresentei os 20% como regra oficial várias vezes nesta operação e
estava errado — o princípio é real, o número é inventado.

Observação medida: **R$70 → R$84 (+20%) não apareceu** como edição significativa.
**R$84 → R$125 (+48,8%) apareceu.** Duas amostras não fazem uma regra, mas balizam.

### 1.3 O instrumento: a coluna "Última edição significativa"

**Esta é a resposta definitiva para "isso reinicia o aprendizado?", e ela é por conta.**

No Gerenciador de Anúncios, adicione a coluna **Última edição significativa** (botão *Colunas*).

Procedimento, e ele dispensa qualquer regra que alguém te passe:

1. Antes de editar, anote a data que está lá.
2. Salve a edição.
3. Atualize e olhe de novo.
4. **Mudou para agora → foi significativa. Continua igual → não foi.**

### 1.4 A coluna "Veiculação" NÃO serve para ler aprendizado

Dois documentos do Meta se contradizem:

| Onde | O que diz |
|---|---|
| Ajuda sobre fase de aprendizado | *"A coluna Veiculação exibe **'Aprendizado'**"* e *"exibirá **'Aprendizado limitado'**"* |
| Tooltip da própria coluna | *"**Agora** você pode ver os status Ativo, Pendente ou Inativo."* |

O "agora" sugere que a coluna foi simplificada e que o primeiro texto é antigo. Na prática, durante
toda a campanha de setembro ela mostrou **"Ativo"** — inclusive no dia 1, quando o conjunto
obrigatoriamente estava em aprendizado.

**Conclusão: não use essa coluna para isso.** Use §1.3 + a coluna Resultados com o período recortado
a partir da última edição significativa.

### 1.5 Orçamento diário é MÉDIA, não teto — e o teto NÃO é 125%

Esta seção afirmava: *"o Meta pode gastar até 125% do orçamento diário num único dia"*, com duas
medições que davam exatamente 1,25×.

**Está errado.** Em 16/09 o dono mandou o print do gerenciador: **orçamento diário R$ 125,00, valor
gasto R$ 164,89** — e confirmou que não mexeu em nada. Isso é **131,9%**, e o suposto teto teria
dado R$ 156,25.

Duas medições que batem não provam a regra; provam que as duas caíram perto do mesmo lugar. É a
§5.5 de novo, com um agravante: eu tinha escrito "1,25×" numa coluna, e 105,84/84 = 1,26 e
156,82/125 = 1,2546 já não eram 1,25. Arredondei a favor da minha própria regra.

#### ✅ RESOLVIDO em 17/09 — pelo próprio Meta, escrito na tela

Depois de eu errar duas vezes tentando deduzir a regra, o dono mandou o print da caixa de orçamento
do conjunto. A resposta estava escrita ali o tempo todo, abaixo do campo:

> *"Gastaremos cerca de R$ 125,00 por dia. Seu gasto diário máximo é de **R$ 218,75**, e seu gasto
> semanal máximo é de **R$ 875,00**."*

```
218,75 = 125 × 1,75      teto de UM DIA  = 175% do orçamento diário
875,00 = 125 × 7         teto da SEMANA  = 7 × o orçamento diário
```

**As duas regras que eu tinha escrito estavam erradas, e da pior forma: eu deduzi das medições em
vez de ler o que o produto informa.** O teto nunca foi 125%, e o rateio diário nunca foi
"sobra ÷ dias restantes" — o Meta gasta livremente dentro dos dois limites.

Toda a série agora fecha sem exceção:

| Dia | Orçamento | Gasto | % do dia | Teto do dia (175%) |
|---|---|---|---|---|
| 12 | 84 | 105,84 | 126% | 147,00 ✓ |
| 13 | 125 | 156,82 | 125% | 218,75 ✓ |
| 14 | 125 | **164,89** | **132%** | 218,75 ✓ |
| 15 | 125 | 110,63 | 89% | 218,75 ✓ |
| 16 | 125 | 126,17 | 101% | 218,75 ✓ |

E a semana de 13 a 16: R$ 558,51 de R$ 875. Dentro.

> **A semana fechada de 13 a 19 gastou R$ 980,17 — acima dos R$ 875 que o teto de 7 × 125 daria.**
> O orçamento mudou no meio dela (125 → 149 em 17/09), e 980,17 cabe folgado em 7 × 149 = R$ 1.043.
>
> A leitura óbvia é que o teto semanal acompanha o orçamento vigente. **Não vou registrar isso como
> regra**, porque é exatamente o erro desta seção: deduzir comportamento de plataforma de uma
> medição em vez de ler o que a plataforma escreve. A linha cinza embaixo do campo de orçamento diz
> o teto atual por extenso — **o jeito de confirmar é o dono abrir a caixa e ler, não eu calcular.**
>
> #### ✅ CONFIRMADO em 21/09 — o dono abriu a caixa e leu
>
> > *"Gastaremos cerca de R$ 149,00 por dia. Seu gasto diário máximo é de **R$ 260,75**, e seu gasto
> > semanal máximo é de **R$ 1.043,00**."*
> >
> > *"Os gastos podem ser maiores em alguns dias e menores em outros."*
>
> ```
> 260,75 = 149 × 1,75   ✓ a regra de 175% se mantém no orçamento novo
> 1.043  = 149 × 7      ✓ e o teto semanal ACOMPANHA o orçamento vigente
> ```
>
> Os R$ 980,17 da semana de 13 a 19 estavam dentro o tempo todo. **A pergunta se fechou com uma
> leitura de tela, não com uma dedução** — que é a única coisa que esta seção pede.

> **A lição de método, e é a mais barata de todas:** eu gastei dois dias construindo e derrubando
> hipóteses sobre uma regra que o Meta escreve por extenso, em português, embaixo do campo que o
> dono edita toda semana. **Antes de deduzir comportamento de plataforma a partir de dados, ler o
> que a plataforma diz na tela.** Era uma linha de texto cinza.

**Consequência operacional, agora com número confiável:** com orçamento X, um dia pode chegar a
**1,75X**, e a semana nunca passa de **7X**. Um dia forte não precisa de edição nenhuma para
aproveitar — a folga já está lá, e é muito maior do que eu vinha dizendo.

---

#### ❌ A hipótese do rateio semanal — proposta em 15/09, MORTA em 16/09 *(mantida como registro do erro)*

Eu propus que a semana do Meta (domingo a sábado) tem teto de 7 × orçamento e que o gasto do dia é
**sobra ÷ dias restantes**. O ajuste no dia 15 foi de três centavos:

| Dia | Gasto | Acumulado | Sobra | Dias rest. | Sobra ÷ dias | Real do dia seguinte |
|---|---|---|---|---|---|---|
| 13 dom | 156,82 | 156,82 | 718,18 | 6 | 119,70 | 164,89 ✗ |
| 14 seg | 164,89 | 321,71 | 553,29 | 5 | 110,66 | **110,63 ✓** |
| 15 ter | 110,63 | 432,34 | 442,66 | 4 | **110,67** | **126,17 ✗** |

**Previsto para 16/09: R$ 110,67. Real: R$ 126,17.** Erro de **+R$ 15,50 (+14%)**.

> A hipótese foi registrada com a condição de morte explícita — *"um dia fora disso derruba"* — e o
> dia veio. **Ela está morta, e não vai ser remendada.** Ajustar a fórmula agora para caber nos dois
> pontos que sobraram é o que transforma coincidência em folclore (§5.5).
>
> **O encaixe de três centavos era coincidência.** Repare que a própria tabela já mostrava isso: a
> previsão feita no dia 13 para o dia 14 errou por R$ 45. Eu olhei só o acerto e ignorei o erro que
> estava na linha de cima — que é o mesmo vício de ler dois pontos como regra.

**O que sobra de verdade, e é pouco:**

1. **O teto de 125% num único dia é falso** (dia 14: 131,9%). Isso está provado por print.
2. **O gasto diário varia mais do que qualquer modelo que eu propus.** De R$ 110,63 a R$ 164,89 com
   o mesmo orçamento de R$ 125 — de 88% a 132%.
3. **A amplitude, não a fórmula, é o que serve para operar:** com orçamento X, esperar qualquer coisa
   entre ~0,85X e ~1,35X num dia. Planejar com a média, nunca com o teto.

**Ainda aberto, e testável em 19/09:** se o TOTAL da semana respeita 7 × orçamento. Depois de quatro
dias são R$ 558,51 de R$ 875, com R$ 316,49 para três dias. Se a semana fechar perto de 875, o teto
semanal existe mesmo que o rateio diário não siga fórmula nenhuma. Se estourar, também isso morre.

**E o subgasto continua sem leitura única:** no dia 11 (R$ 57,91 de R$ 84) era falta de leilão que
valesse o preço; no dia 15 (R$ 110,63 de R$ 125) veio logo depois de dois dias fortes e o dia
seguinte voltou a subir. Sem modelo de pacing, **um dia de subgasto isolado não significa nada** —
só a série significa.

### 1.6 Atribuição: os números passados do Meta NÃO são finais

Configuração em uso: **clique em 7 dias, visualização em 1 dia.**

> *"Com uma configuração de clique de 7 dias, nosso sistema **aprenderá** com as conversões que
> acontecerem dentro de 7 dias e exibirá anúncios para pessoas com maior probabilidade de conversão
> dentro de 7 dias."*

Duas consequências que custaram dias de confusão:

**1. O Meta credita a venda ao dia do CLIQUE, não ao dia do pagamento.** Quem clicou dia 10 e pagou
dia 13 aparece no dia 10 para ele e no dia 13 para nós.

**2. Um dia do Meta continua crescendo por até 7 dias.** Ler "o dia 12 fechou com X" no Gerenciador
é ler um número que ainda vai subir. **O nosso funil é final; o dele não.**

E a "visualização em 1 dia" credita compra de quem **só viu** o anúncio, sem clicar. Isso
superestima o impacto causal.

> **A regra que saiu disso:** o nosso funil é o **piso** (só quem chegou com `utm_source`), o do Meta
> é o **teto** (inclui quem só viu). A verdade está entre os dois. Para decisão de dinheiro, use o
> nosso — ele é final e conservador.

---

## 2. O leilão, e por que a API de Conversões era a peça certa

A cada impressão disponível, o Meta ordena os anunciantes por:

```
valor  =  lance  ×  probabilidade estimada de conversão  +  qualidade do anúncio
```

**A probabilidade é MULTIPLICADA.** Um anunciante cuja conversão o Meta consegue prever **ganha o
leilão pagando menos** que um concorrente que oferece mais dinheiro.

> **Previsão melhor não é bônus de relatório. É desconto no preço.**

É isso que fazia a cegueira custar caro: com o Meta enxergando ~1/3 das vendas, ele perdia leilões
que deveria ganhar e ganhava leilões que não valiam. A API de Conversões não melhorou a medição —
**melhorou o preço**.

### A aritmética do CAC, e ela fecha

Com os números reais de 13/09:

```
R$ 118,90 ÷ 3.405 impressões  =  3,49 centavos por impressão
12 compras ÷ 3.405 impressões =  0,35% de conversão por impressão

3,49 centavos ÷ 0,35%  =  R$ 9,91   ← exatamente o custo por compra
```

**Só existem dois jeitos de baixar o CAC:** pagar menos por aparecer (previsão melhor, menos
concorrência) ou converter mais quem aparece (criativo, site). Todo o resto é consequência.

---

## 3. As métricas, e o que cada uma isola

### 3.1 Custo por chegada × conversão — a decomposição que diagnostica

| Métrica | Sensível a | Isola |
|---|---|---|
| **Custo por chegada** (gasto ÷ chegaram) | leilão, previsão, concorrência | o lado da ENTREGA |
| **Conversão** (pagaram ÷ chegaram) | intenção de quem chegou, site, oferta | o lado do PÚBLICO e do PRODUTO |

**É a ferramenta mais útil deste arquivo.** Quando as duas se movem juntas, mudou **quem** está
chegando — gente mal-casada custa mais para alcançar *e* compra menos. Quando só o custo se move, é
preço de leilão. Quando só a conversão se move, é o site ou o dia.

### 3.2 CAC é por CLIENTE. Custo por venda é por PEDIDO.

Não é preciosismo — muda a decisão.

| Pergunta | Divisor |
|---|---|
| **CAC** — quanto custou trazer um cliente | **pessoas** |
| Custo por venda | pedidos |

Quando um cliente compra mais de uma vez (relatório + upgrade, ou segunda análise), a **receita por
cliente adquirido fica acima do ticket médio** — e o teto do que se pode pagar para trazer o próximo
sobe junto. Dividir tudo por pedidos esconde exatamente isso.

### 3.3 O funil conta PESSOAS. A lista de vendas conta PEDIDOS.

`funnel_markers` tem restrição única em (visitante, marco): **um visitante só tem um marco `paid` na
vida.** Isso é proposital — é o que faz a taxa de conversão significar algo.

Em 12/09 o funil mostrou **5** e a lista **7**. Os dois estavam certos: uma pessoa comprou 3 vezes
no mesmo dia. O `/admin/funil` hoje mostra os três números — pedidos, pessoas por trás deles, e
pessoas no funil — e dá o veredito.

**Como ler os três, com o dia 14 de exemplo — 10 no funil · 12 pedidos · 12 clientes:**

| Número | O que conta exatamente | Vem de |
|---|---|---|
| **Pedidos** (12) | Linhas em `orders` pagas, recortadas por `paid_at` | `contarVendas` |
| **Clientes** (12) | `count(distinct coalesce(recommendationSessions.sessionId, orders.sessionId))` | `contarCompradoresDistintos` |
| **Pagaram** (10) | Visitantes distintos com marco `paid` criado na janela | `funnelReport` |

**Pedidos = clientes** significa que ninguém comprou duas vezes em cima da MESMA análise — nenhum
upgrade, nenhuma segunda compra do mesmo laudo.

> ⚠️ **"Clientes" não é "pessoas".** A chave é a sessão dona da análise, não o e-mail. A mesma
> pessoa fazendo duas análises separadas conta como dois clientes — foi literalmente o caso de
> 13/09, um e-mail com 3 compras. Então 12 clientes são 12 análises distintas, e *provavelmente*
> 12 pessoas, mas o número não prova isso. Quem prova é a lista de vendas, que tem o e-mail.

**Mas "Clientes ≠ Pagaram" quase nunca é defeito** — e a causa principal é a §3.3-ter abaixo, que
eu esqueci de considerar quando o dono perguntou pela primeira vez. As outras duas, que existem e
são mais raras:

| Causa | Mecanismo | É defeito? |
|---|---|---|
| **(a) Comprador repetido de outro dia** | O marco `paid` é único por visitante **na vida**. Quem já comprou com o mesmo cookie não gera marco novo — o `onConflictDoNothing` engole. O pedido e o cliente contam hoje; o marco está datado lá atrás. | **Não.** É o desenho. |
| **(b) Marco descartado** | `markFunnelBySessionId` desiste quando a sessão anônima não é encontrada. Era o `return` mudo que fez o funil parecer engolir venda em 12/09. | **Sim.** |

Para (b) existe rastro desde `795b789`: a linha `[funil] marco "paid" descartado: sessão anônima
<id> não encontrada` nos logs da Vercel. **Só vale a pena ir atrás dela quando a diferença não se
explicar pela §3.3-ter** — e, no dia 14, ela se explicava.

### 3.3-ter Os dois relógios: a linha de origem mede DOIS dias diferentes

Isto está escrito no próprio `/admin/funil` e eu ainda assim li errado. Na tabela "De onde vieram":

| Colunas | Recortam por | Consulta |
|---|---|---|
| Chegaram · Terminaram · **Pagaram** | quando a pessoa **CLICOU no anúncio** | `recorte(visitorCampaigns.createdAt, janela)` |
| **Clientes** · Pedidos · Receita | quando o **PAGAMENTO entrou** | `recorte(orders.paidAt, janela)` |

O `paid` da primeira metade só exige `gte(funnelMarkers.createdAt, visitorCampaigns.createdAt)` —
**qualquer data depois do clique**. Então, lendo o dia 14:

- **86 chegaram** = 86 pessoas clicaram no anúncio em 14/09;
- **10 pagaram** = dessas 86, 10 já pagaram — em qualquer data;
- **12 pedidos · R$ 579,88** = pagamentos que entraram em 14/09, de quem clicou em **qualquer** dia.

**São duas populações.** Quem clicou dia 13 e pagou dia 14 entra nos 12 e não nos 10.

> ⚠️ **Eu afirmei que "Pagaram ≤ Clientes sempre". É FALSO.** Medido em 13/09: **Pagaram 22,
> Clientes 20.** Das 87 pessoas que clicaram naquele domingo, 22 acabaram pagando; mas só 20
> pagamentos caíram no próprio domingo. Entre coortes diferentes, qualquer um dos dois pode ser
> maior — a desigualdade só vale dentro da MESMA coorte.

**A consequência que assusta, e a medição que a desarma.** Se "Pagaram" do dia D aceita pagamento
de qualquer data posterior, ele deveria crescer depois que D fecha, e nenhum dia estaria fechado de
verdade antes de ~7 dias.

Testado em 15/09, relendo 13/09 no calendário: **continuou 22**, o mesmo valor lido em 14/09. Entre
D+1 e D+2 não se moveu.

> **O que isso libera:** ler um dia em D+1 é legítimo, desde que a série inteira seja lida sempre no
> MESMO atraso. 13/09 (22) e 14/09 (10) foram ambos lidos em D+1 — a comparação entre eles é
> honesta, e a queda de conversão do dia 14 é real, não artefato de maturação.
>
> **O que NÃO está provado:** que não há crescimento entre D+0 e D+1. Ninguém mediu. Por isso a
> regra continua sendo nunca ler o dia corrente (§3.4).

### Qual divisor para qual pergunta

| Pergunta | Fórmula | Por quê |
|---|---|---|
| Quão boa foi a audiência que comprei hoje? | **Pagaram ÷ Chegaram** | Mesma coorte, pessoa dividida por pessoa. É a conversão de verdade. |
| Quanto custou trazer um cliente? | **Gasto ÷ Clientes** | CAC é por cliente. Estável no fechamento e casa com o extrato. |
| Quanto custou gerar uma transação? | Gasto ÷ Pedidos | Só isto. Não é CAC. |

**Pedidos nunca entra em conversão** — conta transação, não gente. Uma pessoa com 3 compras vira 3,
e a razão pode passar de 100%.

### 3.3-bis O Meta sempre vê MAIS que o nosso funil — e nenhum dos dois está errado

Medido em 14/09: o Meta contou **16 compras**; o nosso funil, **12 pedidos**. A diferença não é
defeito, é definição, e ela nunca vai fechar:

| O que o Meta conta a mais | Por que nós não vemos |
|---|---|
| **Visualização de 1 dia** | Quem viu o anúncio e não clicou não deixa rastro nenhum aqui — não existe clique, não existe `visitorCampaigns`. |
| **Clique de até 7 dias** | Nós pegamos isso quando o cookie sobrevive; quando não sobrevive, some. |
| **Entre aparelhos** | Clicou no celular, comprou no computador. O Meta casa pela conta; nós casamos por cookie, e são dois cookies. |
| **Quem recusou cookies** | Decisão nossa de LGPD: sem consentimento não há registro de campanha. O Meta não tem essa limitação do lado dele. |

**A regra de uso, e ela tem duas metades opostas:**

> **Para decidir DINHEIRO — usar o nosso.** É o piso conservador, é o que reconcilia com o extrato,
> e se o negócio fecha nele, fecha de verdade. Foi o que o dono já vinha fazendo.
>
> **Para julgar o ESTADO DO ALGORITMO — usar o do Meta.** O limiar de ~50 conversões da fase de
> aprendizado (§1) é contado pelo Meta, com a régua do Meta. Medir isso com o nosso número faz
> parecer que falta mais sinal do que falta de verdade, e empurra para uma decisão errada de
> orçamento.

**O que nunca fazer: misturar as duas fontes dentro da mesma série.** Um dia dividido pelo número do
Meta e o seguinte pelo nosso produz uma variação que é só de fonte, e que vai ser lida como
resultado. A série da §4 usa o nosso nos seis dias, do primeiro ao último.

### 3.4 Dia parcial não é leitura. Nunca.

Medido em 13/09:

| Hora | Compras |
|---|---|
| 15:31 | 9 |
| Fechamento | **22** |

**59% das vendas do dia aconteceram depois das 15h30.** A chegada conta na hora; a compra demora.
Ler conversão de um dia às 16h subestima sistematicamente.

Isso me fez errar o diagnóstico do dia 12 duas vezes. Ver §5.2.

---

## 4. A série da primeira campanha — medida, não estimada

Fluxo Meta apenas. Fonte: `/admin/funil`, recorte por dia de calendário de Brasília.

Cada dia lido em **D+1**, sempre no mesmo atraso — ver §3.3-ter.

| Dia | | Gasto | Chegaram | Pagaram | Conversão | Clientes | Receita | Custo/chegada | CAC | ROAS |
|---|---|---|---|---|---|---|---|---|---|---|
| 09 | qua | 23,41 | 17 | 6 | 35,3% | — | 279,94 | 1,38 | — | 11,96× |
| 10 | qui | 88,16 | 46 | 14 | 30,4% | — | 699,86 | 1,92 | — | 7,94× |
| 11 | sex | 57,91 | 27 | 4 | 14,8% | — | 199,96 | 2,14 | — | 3,45× |
| 12 | sáb | 105,84 | 40 | 6 | 15,0% | — | 299,94 | **2,65** | — | 2,83× |
| 13 | dom | 156,82 | 87 | 22 | 25,3% | 20 | 919,80 | **1,80** | **7,84** | 5,87× |
| 14 | seg | 164,89 | 86 | 10 | **11,6%** | 12 | 579,88 | 1,92 | **13,74** | 3,52× |
| 15 | ter | 110,63 | 54 | 9 | 16,7% | 9 | 429,91 | **2,05** | 12,29 | 3,89× |
| 16 | qua | 126,17 | 75 | 13 | 17,3% | 13 | 649,87 | **1,68** | **9,71** | 5,15× |
| 17 | qui | 171,43 | **102** | 18 | 17,6% | — | 869,81 | **1,68** | — | 5,07× |
| 18 | sex | 122,26 | 93 | 11 | **11,8%** | 11 | 549,89 | **1,31** | 11,11 | 4,50× |
| 19 | sáb | 127,97 | **58** | 11 | **19,0%** | 10 | 479,90 | **2,21** | 12,80 | **3,75×** |
| 20 | dom | 182,59 | 96 | 17 | 17,7% | 18 | 889,81 | 1,90 | **10,14** | 4,87× |
| 21 | seg | 125,00 | **52** | 11 | **21,2%** | — | 909,81 ⚠️ | **2,40** | — | 7,28× ⚠️ |
| **Σ** *(09–20)* | | **1.438,08** | **781** | **141** | **18,1%** | — | **6.848,57** | **1,84** | — | **4,76×** |

> ⚠️ **O ROAS do dia 21 está PENDENTE DE CONFIRMAÇÃO, e o Σ não o absorveu.**
>
> R$ 909,81 tem decomposição única: **17 setups + 2 laudos = 19 pedidos**. O problema é a razão
> entre 19 pedidos e 11 pagantes no funil. Nos outros dias a distância é de 0 a 2 (dia 18: 11 e 11;
> dia 19: 11 e 10; dia 20: 17 e 19). Oito de diferença é fora do padrão.
>
> As duas leituras possíveis, e elas mudam o número:
>
> - **É a receita do fluxo Meta.** Então ROAS 7,28×, o segundo melhor da campanha inteira, num dia
>   em que a chegada foi a mais cara desde o dia 12. Possível, e extraordinário.
> - **É a receita TOTAL do painel**, somando bio e contatos pessoais. Então parte dela não é do
>   anúncio e o ROAS do fluxo Meta é menor.
>
> O precedente existe e é do dia 15: o painel mostrava R$ 529,89 e o fluxo Meta era R$ 429,91 — a
> diferença veio do link da bio. Misturar origem infla o ROAS de um canal com a venda de outro, e
> foi por isso que esta série virou "fluxo Meta apenas".
>
> **Como fechar:** abrir `/admin/funil` no dia 21 e ler a coluna **Receita** na LINHA da origem
> `meta`, na tabela "De onde vieram" — não o total do fechamento.
>
> **O que o dia já diz, e é a divergência da §3.1 outra vez:** metade da gente (96 → 52, −46%) a um
> custo 26% maior (1,90 → 2,40), convertendo muito melhor (17,7% → **21,2%, a melhor desde o dia
> 13**). Entrega pior, público melhor — e é o segundo dia seguido assim, depois do sábado 19
> (R$ 2,21 · 19,0%).

> ⚠️ **18 e 19 foram lidos fora do atraso padrão — D+3 e D+2, contra D+1 do resto da série.**
> Só o dia 20 seguiu a regra. Pela §3.3-ter isso importa: "Chegaram" é fixo (conta pela data de
> chegada), mas "Pagaram" acumula quem chegou naquele dia e pagou depois — ler mais tarde captura
> mais retardatários. **A conversão de 18 e 19 está, se acaso, superestimada** em relação ao 20 e
> aos dias de 13 a 16.
>
> O que torna o dia 18 pior, não melhor: 11,8% é o segundo pior número da série **mesmo com dois
> dias a mais para maturar**.

**Lucro bruto dos 12 dias (receita − gasto): ~R$ 5.410.** O dono pediu para largar a taxa do gateway
da conta — *"para mim é irrelevante, isso eu consigo ver de forma simples"* —, então a série passa a
mostrar receita menos gasto, sem estimar taxa. Os melhores dias: **13 (R$ 763)**, **20 (R$ 707)** e
**17 (R$ 698)**.

> ⚠️ **Uma venda de 19/09 está contada em 21/09, e nenhuma das duas linhas mente por isso.**
>
> O pagamento 179878109696 foi aprovado em 19/09 às 14:35 e nunca chegou a existir como venda —
> três defeitos empilhados, ver `src/payments/provider.ts` e `commerce-repo.ts`. Foi recuperado em
> 21/09, e `processPaymentEvent` grava `paidAt: new Date()`: **a data da recuperação, não a do
> pagamento.** Os R$ 49,99 caíram no dia do clique.
>
> Está escrito aqui para a linha do 19 não ser "corrigida" depois por quem a reler. E a correção
> não é automática nem óbvia: **esta série é fluxo Meta apenas**, e não está verificado que esta
> venda veio do anúncio — ela pode ser bio ou contato pessoal, como os R$ 99,98 do dia 15. Quem
> quiser fechar o dia 19 precisa abrir a venda em `/admin/vendas` e ler a origem primeiro.
>
> **A correção estrutural, se alguém quiser fazê-la:** `eventoDePagamento` já traz a data do
> gateway, então dá para gravar `paidAt` com a data real do pagamento em vez de `new Date()`. Não
> foi feito porque muda a atribuição de receita de toda recuperação, e a decisão é do dono.

### Dia 17: o aumento de orçamento comprou volume SEM encarecer o leilão

| | 16/09 | 17/09 | |
|---|---|---|---|
| Gasto | 126,17 | 171,43 | **+36%** |
| Chegaram | 75 | **102** | **+36%** |
| Custo por chegada | 1,68 | **1,68** | **igual** |

**Trinta e seis por cento a mais de dinheiro comprou trinta e seis por cento a mais de gente pelo
mesmo preço.** É o melhor desfecho possível de um aumento de orçamento — o normal é o custo por
chegada subir, porque o algoritmo precisa alcançar público progressivamente pior para gastar mais.

Não subiu, e isso bate com o que o painel de público já dizia: 15,5 a 18,2 milhões de pessoas,
frequência 1,14–1,20, alcance abaixo de 0,1%. **Não há escassez de inventário nesta faixa** — o
orçamento é o limite, não o público.

E as 102 chegadas são o **maior volume de um dia da campanha**, acima das 87 do dia 13.

> ⚠️ **O dia 17 NÃO é um dia limpo em R$ 149.** O orçamento mudou no meio dele (R$ 125 até a
> edição, R$ 149 depois) e ainda houve pausa de entrega durante a revisão do Meta. O número é
> encorajador e **não serve como linha de base** — os primeiros dias limpos são 18, 19 e 20.
>
> Vale registrar que o erro de ler dia borrado como dia limpo é irmão do de ler dia parcial (§5.2,
> §5.2-bis). A diferença é que este eu vi antes de cair nele.

> **O dia 16 vendeu SÓ o produto caro.** R$ 649,87 em 13 pedidos admite uma única decomposição
> inteira: **13 × R$ 49,99, zero laudos de raquete**. É o primeiro dia da série sem nenhum pedido do
> produto de R$ 29,99 — no 13 foram 16+4 e no 14, 11+1. Um dia não é tendência, mas o mix vem
> subindo e vale acompanhar: ele muda o líquido por cliente, que é o divisor de toda decisão de
> orçamento.

> **O dia 15 teve receita maior no painel — R$ 529,89 — e ela NÃO entrou aqui.** A diferença de
> R$ 99,98 veio do link da bio e de contatos pessoais, não do anúncio. Esta série é fluxo Meta
> apenas, do primeiro dia ao último; misturar a origem inflaria o ROAS de um canal com a venda de
> outro. O dono separou por conta própria, e é a leitura certa.
>
> No dia 15 os três números coincidiram pela primeira vez: **9 no funil · 9 pedidos · 9 clientes**.

> **`CAC = gasto ÷ Clientes`, e por isso ele só existe de 13/09 em diante** — o painel só passou a
> mostrar Clientes depois. A versão anterior desta tabela dividia por "Pagaram" e publicava
> R$ 9,63 de CAC acumulado; era o divisor errado, e o número saía **inflado**. O CAC real dos
> quatro primeiros dias fica em branco até alguém reler 09–12 no calendário. Em branco, e não
> estimado.

**A composição confere com o catálogo de preços**, o que é uma verificação independente de que a
receita não é número solto:

| Dia | Pedidos | Decomposição única em R$ 49,99 / R$ 29,99 |
|---|---|---|
| 13 | 20 | **16** setups completos + **4** laudos de raquete = R$ 919,80 |
| 14 | 12 | **11** setups completos + **1** laudo de raquete = R$ 579,88 |
| 16 | 13 | **13** setups completos + **0** laudos = R$ 649,87 |
| 18 | 11 | **11** setups completos + **0** laudos = R$ 549,89 |
| 19 | 10 | **9** setups completos + **1** laudo de raquete = R$ 479,90 |
| 20 | 19 | **16** setups completos + **3** laudos de raquete = R$ 889,81 |

Cada receita admite **uma só** combinação inteira dos dois preços. Se o valor estivesse errado por
digitação, quase certamente não fecharia em inteiros.

**O ticket médio está caindo devagar, e o motivo é o mix**: R$ 49,99 no dia 18, R$ 47,99 no 19,
R$ 46,83 no 20. O produto caro domina (84% a 100% dos pedidos em todos os dias medidos), mas o
laudo de raquete voltou a aparecer depois do zero do dia 16 e do 18. É o divisor de toda decisão de
orçamento — dois dias de queda não são tendência, e é o número a reler no fim da semana.

### Os três primeiros dias limpos em R$ 149 — o aumento saiu de graça, e não saiu lucrativo

O dia 17 foi declarado borrado de propósito (orçamento trocado no meio, pausa de revisão). **18, 19
e 20 são os primeiros dias inteiros em R$ 149**, e é contra eles que a decisão de subir o orçamento
se defende ou cai.

| | 13–16 (R$ 125, 4 dias) | 18–20 (R$ 149, 3 dias) | |
|---|---|---|---|
| Gasto/dia | 139,63 | 144,27 | **+3,3%** |
| Chegaram/dia | 75,5 | 82,3 | **+9,0%** |
| Custo por chegada | 1,85 | **1,75** | **−5,4%** |
| Conversão | 17,9% | **15,8%** | **−2,1 p.p.** |
| CAC | 10,34 | 11,10 | **+7,3%** |
| ROAS | 4,62× | 4,43× | **−4,1%** |

**As duas metades se moveram em direções opostas e quase se anularam.** A chegada ficou mais
barata — o medo do §"dia 17" (leilão encarecendo ao gastar mais) **não se confirmou em três dias
inteiros**, e essa é a boa notícia. Mas quem chegou converteu pior, e o líquido por cliente piorou
7%. Em dinheiro: ROAS caiu de 4,62× para 4,43×, o que é ruído numa comparação de 4 dias contra 3.

**A leitura honesta é "empatou com mais volume"**, não "melhorou". E, pela §3.1, custo de chegada
caindo junto com conversão caindo é a assinatura de mudança em **quem chega**: mais dinheiro alcança
público progressivamente mais barato e menos qualificado. O leilão não cobrou pelo volume extra —
cobrou na qualidade.

#### O aumento de orçamento entregou 3% de gasto, não 19%

É o achado mais acionável dos três dias, e ele não aparece em nenhuma métrica de eficiência:

| | Orçamento | Gasto/dia | % do orçamento |
|---|---|---|---|
| 13–16 | 125 | 139,63 | **112%** |
| 18–20 | 149 | 144,27 | **97%** |

O orçamento subiu 19,2% e o gasto real subiu 3,3%. **Sob R$ 125 o Meta gastava acima do orçamento
todo dia; sob R$ 149 ele passou a gastar abaixo.** Nenhum dia bateu no teto de R$ 260,75 (149 ×
1,75), então não é limite — é o Meta não encontrando onde pôr o dinheiro ao preço que aceita pagar.

##### ✅ O dia 21 fecha o argumento — e o número ficou IDÊNTICO

Com o quarto dia inteiro (21/09, R$ 125,00 de gasto), o bloco em R$ 149 passa a ser:

| | 13–16 (R$ 125) | 18–21 (R$ 149) | |
|---|---|---|---|
| Gasto/dia | 139,63 | **139,46** | **−0,1%** |
| Custo por chegada | 1,85 | **1,87** | **+1,1%** |
| Conversão | 17,9% | 16,7% | −1,2 p.p. |

**O orçamento subiu 19,2% e a entrega diária ficou a dezessete centavos da anterior.** A versão de
três dias sugeria +3,3%; com quatro, nem isso sobrou.

Isso deixa de ser "o aumento rendeu pouco" e vira outra coisa, mais dura e mais útil: **esta
campanha tem um teto de gasto próprio, por volta de R$ 138–140/dia, e ele não é o orçamento.** Os
sete dias de 15 a 21 dão média de R$ 138,01, atravessando os dois orçamentos sem acusar a troca.

É coerente com o que o gerenciador mostrou em 21/09 — alcance de 23.042 sobre um público de 15 a 18
milhões, veiculação "Ativo", lance "Volume mais alto" sem limite de custo. Nada trava o gasto, e
mesmo assim ele não sobe: o modelo achou um bolso e não paga mais caro para sair dele.

> **Consequência prática, agora com quatro dias:** mexer no campo de orçamento é uma alavanca
> **desligada**. Não é "rende pouco" — é que não mexe no número. Qualquer plano que dependa de
> gastar mais para vender mais precisa primeiro mudar o bolso: criativo ou público.

Consequência: **subir o orçamento de novo provavelmente não compra volume.** O caminho para mais
gente deixou de ser o campo do orçamento e passou a ser criativo ou público — que é a decisão que a
§5.4 manda tomar uma de cada vez.

##### E em 21/09 apareceu a explicação: o Meta não está explorando o público

Os três números que o gerenciador devolveu, lidos juntos:

| O que o Meta diz | Valor | O que isso elimina |
|---|---|---|
| Veiculação | **Ativo** | Não é "limitado pelo orçamento", nem "público limitado", nem aprendizado |
| Estratégia de lance | **Volume mais alto** | Sem limite de custo — nada impede o Meta de pagar mais caro |
| Alcance | **23.042** | De um público de 15,5 a 18,2 milhões: **0,14%** |
| Frequência | **2,41** | ~55.500 impressões para 23 mil pessoas |

**Nada está travando o gasto, e mesmo assim ele não sobe.** Sem limite de lance, sem limite de
orçamento, com 18 milhões de pessoas disponíveis, o Meta alcançou 23 mil e preferiu mostrar de novo
para elas em vez de procurar as outras.

Isso é o retrato de um modelo de otimização que **encontrou um bolso e parou de explorar**. E as
três coisas que a série mostrava sem explicação passam a ter a mesma causa:

- **gasto parado** — ele não paga mais caro para sair do bolso;
- **chegada mais barata** (1,85 → 1,75) — dentro do bolso é barato, essa gente responde;
- **conversão caindo** (17,9% → 15,8%) — é o mesmo bolso sendo reapresentado, e ele satura.

> **Por que isto importa mais que o diagnóstico de fadiga:** se a limitação é o tamanho do bolso, e
> não o desgaste da peça, então **dividir orçamento entre dois conjuntos não resolve** — os dois
> caem no mesmo bolso. O que muda o bolso é sinal novo: criativo diferente o bastante para atrair
> outro perfil, ou público explicitamente diferente (semelhante a compradores, por exemplo).

#### O dia da semana aparece pela primeira vez, e é para VIGIAR, não para usar

| Dia | Orçamento | Gasto | % |
|---|---|---|---|
| 13 dom | 125 | 156,82 | **125%** |
| 20 dom | 149 | 182,59 | **123%** |
| 18 sex | 149 | 122,26 | 82% |
| 19 sáb | 149 | 127,97 | 86% |

Dois domingos, orçamentos diferentes, 125% e 123%. Sexta e sábado abaixo de 90%.

> ⚠️ **Duas medições que batem não provam regra — a §1.5 foi escrita exatamente por eu ter feito
> isso e errado duas vezes seguidas.** Esta tabela está aqui como pergunta, não como achado.
>
> **Condição de morte, declarada antes do teste:** se 27/09 (domingo) vier abaixo de 110% do
> orçamento, a ideia morre e não vai ser remendada. E há um confundidor óbvio de graça: o 13 foi o
> dia do pico de conversão da campanha inteira (25,3%), então "domingo é forte" e "aquele domingo
> foi bom" ainda são indistinguíveis.

> #### ⚠️ A METADE "DIA FRACO" JÁ MORREU — em 21/09, antes do teste do domingo
>
> A tabela sugeria que sexta e sábado eram dias fracos. **A segunda-feira desmente a leitura por
> dia da semana**, porque as duas segundas da série discordam entre si:
>
> | Segunda | Orçamento | Gasto | % |
> |---|---|---|---|
> | 14/09 | 125 | 164,89 | **132%** |
> | 21/09 | 149 | **125,00** | **84%** |
>
> Mesmo dia da semana, 132% e 84%. Não há regra de calendário que produza isso.
>
> **E os dois gastos absolutos quase coincidem: R$ 164,89 e R$ 125,00 são R$ 145 de média, na mesma
> faixa de todos os outros dias.** O que parecia "% do orçamento variando por dia da semana" é o
> mesmo fato de sempre visto por outro ângulo: **o gasto diário é praticamente constante em reais,
> então a porcentagem sobe e desce conforme o orçamento muda, não conforme o dia.**
>
> Sobra de pé só a parte dos domingos (125% e 123%), e ela fica com a condição de morte original —
> mas agora com uma hipótese concorrente mais simples e já apoiada: talvez não exista efeito de dia
> nenhum, e os dois domingos sejam só dois dias acima da média de um número que oscila.

E o dia 19 é o contraste que mais informa dos três: **58 chegadas, a R$ 2,21 cada — a chegada mais
cara desde o dia 12** — e ainda assim a **melhor conversão desde o dia 13 (19,0%)**. Sábado traz
pouca gente, cara, e certa. O ROAS de 3,75× é o pior dos três dias mesmo assim, porque volume baixo
não tem como ser compensado por conversão boa.

### O V, e o que ele diz

```
Custo/chegada:  1,38 → 1,92 → 2,14 → 2,65 → 1,80 → 1,92 → 2,05 → 1,68 → 1,68 → 1,31 → 2,21 → 1,90
Conversão:     35,3% → 30,4% → 14,8% → 15,0% → 25,3% → 11,6% → 16,7% → 17,3% → 17,6% → 11,8% → 19,0% → 17,7%
```

> **O platô de ~17,5% sobreviveu, e o dia 18 quase o derrubou.** A seção abaixo foi escrita no dia
> 17 com três pontos (16,7 / 17,3 / 17,6). Vieram 11,8 / 19,0 / 17,7 — dispersão muito maior, mas a
> média dos três (15,8%) e a dos seis (16,0%) continuam na mesma faixa. O que mudou não foi o nível,
> foi o **ruído**: o R$ 1,31 do dia 18 comprou gente que converteu à metade.

**A conversão estacionou em ~17,5% e é hora de aceitar isso como o normal desta campanha.** Três
dias em 16,7 / 17,3 / 17,6 não são uma curva subindo — são um platô com ruído. Os 25,3% do dia 13
não voltaram, e provavelmente não voltam sem mudar criativo ou público.

Isso **não é um problema enquanto a chegada estiver a R$ 1,68**: conversão de 17,5% sobre chegada
barata dá CAC melhor que conversão de 25% sobre chegada cara. Mas é o número a vigiar, porque é a
metade frágil (§ "O dia 16 separa as duas metades").

As duas pioram juntas até o dia 12 e se recuperam juntas no 13. Pela §3.1, isso significa que mudou
**quem chegava** — e coincide com a transição do pixel para a API (11 e 12), quando o sinal ficou
instável.

### O dia 14 separa as duas metades pela primeira vez

Até aqui as duas métricas sempre andaram juntas, o que é conveniente e pouco informativo. No dia 14
elas divergem, e é o caso que a §3.1 foi escrita para ler:

| | 13/09 | 14/09 | |
|---|---|---|---|
| Chegaram | 87 | 86 | praticamente idêntico |
| Custo por chegada | 1,80 | 1,92 | **entrega intacta** |
| Conversão | 25,3% | 11,6% | **caiu pela metade** |

**A entrega não piorou — a qualidade de quem chegou piorou.** Mesmo volume, mesmo preço, metade da
conversão.

> **Esta leitura chegou a ficar sob suspeita e sobreviveu.** Ao descobrir a §3.3-ter, levantei a
> hipótese de que a queda fosse só maturação — o 13 teria tido mais tempo de acumular pagamento que
> o 14. O teste de 15/09 derrubou a hipótese: 13/09 relido continuou em 22, e os dois dias foram
> lidos no mesmo atraso de D+1. A queda é real.
>
> Pelo outro divisor a conclusão é a mesma, o que é o melhor sinal de que não é artefato de
> definição: **CAC de R$ 7,84 para R$ 13,74** e **ROAS de 5,87× para 3,52×**.

#### Dia 15: as duas metades andam em direções OPOSTAS

```
Conversão:      25,3% → 11,6% → 16,7%    recuperando
Custo/chegada:   1,80 →  1,92 →  2,05    piorando
```

A conversão subiu 5 pontos — é o aprendizado reconstruindo o modelo de quem compra, no ritmo
previsto. O custo por chegada subiu de novo e já é o **segundo pior da série**.

**E o gasto menor do dia 15 não entra nessa leitura**: R$ 110,63 de R$ 125 é o pacing semanal da
§1.5, não entrega fraca. Foi por isso que essa distinção precisou ser medida antes de ler o dia —
sem ela, o subgasto viraria "o Meta desistiu", e seria falso.

O que resta para decidir é se a conversão continua subindo. Dois pontos numa reta (11,6 → 16,7) não
são tendência; **o dia 16 é o terceiro ponto, e é o que decide.**

#### O terceiro ponto veio — e a recuperação NÃO foi pela conversão

| | 13 (pré-reinício) | 14 | 15 | 16 |
|---|---|---|---|---|
| Conversão | 25,3% | 11,6% | 16,7% | **17,3%** |
| Custo/chegada | 1,80 | 1,92 | 2,05 | **1,68** |
| CAC | 7,84 | 13,74 | 12,29 | **9,71** |
| ROAS | 5,87× | 3,52× | 3,89× | **5,15×** |

**A conversão empacou em ~17%.** De 16,7 para 17,3 é meio ponto — ruído, não recuperação. Ela não
voltou aos 25,3% do dia 13 e, três dias depois do reinício, provavelmente não vai voltar por conta
própria.

**Quem consertou o CAC foi a ENTREGA.** R$ 1,68 por chegada é **o melhor da campanha entre os dias
de volume relevante** (o 1,38 do dia 09 veio de 17 chegadas). A máquina está comprando tráfego mais
barato do que nunca — só que converte menos do que convertia.

> **Isto é a §3.1 dando um veredito diferente do esperado, e é por isso que ela existe.** A leitura
> ingênua seria "o aprendizado terminou, tudo voltou ao normal". Não voltou: **duas coisas mudaram
> em direções opostas e o saldo ficou positivo.** Se eu estivesse olhando só o CAC, teria concluído
> a coisa errada pelo motivo errado.
>
> A consequência prática importa: um CAC bom sustentado por leilão barato é **mais frágil** que um
> CAC bom sustentado por conversão alta. Preço de leilão é do mercado e muda sozinho; conversão é
> nossa. Se o leilão encarecer de volta para ~R$ 2,00 com a conversão em 17%, o CAC vai para ~R$ 11,60.

Isso é o que o reinício do aprendizado faz, e é o comportamento esperado: às 07:21 do dia 14 o
conjunto voltou à fase de aprendizado (§1) e perdeu o modelo de quem compra. Ele continua comprando
impressão barata; ele só não sabe mais para quem. A recuperação depende de acumular conversão, não
de mexer em nada.

> **Um dia não é tendência**, e este é o dia 1 de 3 ou 4 previstos. O combinado continua de pé: não
> mexer em nada até 17–18/09 e só então ler a série. Mexer agora reinicia de novo o relógio que
> está justamente correndo — é a §5.1 inteira.
>
> A régua de emergência não é a conversão, é o lucro do dia: ROAS 3,52× e ~R$ 383 de lucro num dia
> de reinício é um piso confortável. Se o ROAS cair abaixo de ~1,4× (o ponto em que o líquido
> empata com o gasto), aí sim a conversa muda antes do prazo.

**Não está provado.** É a única hipótese que sobreviveu e a única com mecanismo. As duas anteriores
morreram:

- **Saturação** — público de 15–18 milhões, frequência 1,20. Alcance abaixo de 0,1%. Impossível.
- **Fim de semana** — domingo foi o melhor dia da campanha e sábado o pior. Não é o calendário.

### O aumento de orçamento não custou nada no leilão

| Dia | Orçamento | Custo/chegada |
|---|---|---|
| 13 | R$ 125 | R$ 1,80 |
| 14 | R$ 125 | R$ 1,92 (fechado) |

Dois dias com 49% mais orçamento e o preço do leilão **subiu 7 centavos**. O público não ofereceu
resistência relevante — continua sendo permissão para escalar.

> ⚠️ **Esta tabela já trouxe R$ 1,81 para o dia 14, e era um dia PELA METADE** — a leitura das
> 16:00, quando tinham entrado 52 das 86 chegadas. Fechado, o número é 1,92. É a §5.4 acontecendo
> dentro do arquivo que a documenta: dia parcial lido como fechado.
>
> Não muda a conclusão aqui (7 centavos em 49% de orçamento continua sendo barato), e é exatamente
> por isso que é perigoso: o erro que não muda a conclusão é o que ninguém vai atrás de corrigir.

---

## 5. ⚠️ Os erros de método — a parte mais importante deste arquivo

Todos meus. Estão aqui porque o padrão vai se repetir.

### 5.1 O laço do reinício

```
dia ruim → mexe → reinicia aprendizado → dia ruim → mexe → …
```

É assim que um conjunto **nunca** sai do aprendizado. E o Meta avisa:

> *"Espere para editar o conjunto depois que ele já tiver saído da fase de aprendizado."*
> *"Evite fazer alterações frequentes nos orçamentos."*

**A regra:** durante aprendizado, só aja se o CAC passar do **teto de viabilidade** por dois dias
seguidos. Qualquer coisa abaixo disso é ruído esperado.

### 5.2 Ler dia parcial como se fosse fechado

Diagnostiquei o dia 12 com CAC de **R$23,84** usando dados das 17h30. O dia fechou em **R$17,64**.
Construí uma tese de deterioração sobre metade de um dia.

**Regra: nenhum diagnóstico sobre dia aberto.** Ver §3.4 para o porquê quantitativo.

### 5.2-bis Dia parcial, terceira vez — e a primeira para CONCORDAR

Em 17/09 o dono mandou o parcial do dia — **6 vendas em 23 chegadas, 26,1%** — e escreveu *"tá me
dando dó reiniciar nesse patamar"*. Eu **revertei a recomendação do dia anterior** e inventei uma
justificativa técnica: "os 26% mostram que o aprendizado terminou, os 17,3% eram a cauda". Soava
bem. Não fiz a conta.

A conta mata o argumento:

| | |
|---|---|
| Intervalo de 95% de 6/23 | **8,1% a 44,0%** |
| Esperado em 23 chegadas se a taxa ainda for 17,3% | 4,0 vendas |
| P(ver 6 ou mais mesmo assim) | **19,7% — um dia em cada cinco** |

E o golpe final no meu próprio raciocínio: **nem o dia fechado separaria as hipóteses.** Dia 16 tem
intervalo de 8,8% a 25,9%; dia 13, de 16,2% a 34,4%. Setenta e cinco chegadas não distinguem 17% de
25%. Esperar o dia fechar não compraria a leitura limpa que eu prometi — compraria a *sensação* dela.

**E a decisão nunca dependeu disso.** Sob as duas hipóteses, a R$ 150: CAC R$ 10,38 e lucro ~R$ 509,
ou CAC R$ 7,12 e lucro ~R$ 811. Os dois dizem "sobe".

> **O que é novo aqui, e por isso virou seção própria.** As duas primeiras vezes eu li dia parcial
> por **pressa** — queria concluir antes da hora. Desta vez li para **concordar**: o dono expressou
> um desconforto, e eu procurei um motivo técnico que o validasse em vez de testar o número.
>
> É o modo de falha mais perigoso dos três, porque não parece erro — parece atenção ao cliente. E o
> dono nem estava pedindo isso: ele disse explicitamente *"não quero te convencer de nada, apenas
> mandando provocações"*.
>
> **A defesa é mecânica, não de julgamento:** antes de mudar de recomendação por causa de um número,
> calcular o intervalo dele. Se o intervalo contém a hipótese antiga, o número não é motivo.

### 5.3 Afirmar hipótese como se fosse fato

Três vezes, em três dias:

1. *"A diferença de 5 para 7 é cliente recomprando"* — deduzido do código, sem olhar dado nenhum.
   Acabou certo **por sorte**.
2. *"É saturação de público"* — derrubado por um número que eu só pedi porque ia mandar aplicar o
   remédio. Teria custado um reinício de aprendizado para resolver problema inexistente.
3. *"É efeito de fim de semana"* — derrubado pelo domingo seguinte.

**A regra que faltava:** quando dois números discordam, **não se resolve por dedução sobre o código**
— se resolve instrumentando a diferença. Foi o que o terceiro número (`contarCompradoresDistintos`)
fez em dez minutos, depois de dois dias de teoria.

E o simétrico, que também é erro: diante da primeira contestação eu recuei para *"não dá para saber"*
e coloquei sob suspeita um número que estava certo. **Recuar para a dúvida é tão inútil quanto
chutar.**

### 5.4 Mudar duas coisas ao mesmo tempo

A API de Conversões entrou no dia 11, e nos dias seguintes o resultado piorou. Como havia mais de
uma variável em movimento, **não há como atribuir** — e a dúvida sobre a causa do V nunca vai ser
resolvida, só abandonada.

**Uma variável por vez, sempre.** E quando for inevitável mudar duas, registrar na hora que a
leitura daquele período está comprometida — em vez de descobrir depois, discutindo.

### 5.5 Vender folclore como documentação

Os "20% não reiniciam o aprendizado" viraram regra na minha boca por vários dias. **Não é
documentado.** O princípio (magnitude importa) é real; o número é de mercado.

**Regra: separar sempre.** "O Meta documenta X" e "o mercado usa Y" são frases diferentes e valem
coisas diferentes. E quando existir um medidor na ferramenta (§1.3), ele vence as duas.

---

## 6. As regras operacionais que sobraram

1. **Nada de editar enquanto você não consegue LER o resultado.** ⚠️ Esta regra dizia *"nada de
   editar durante a fase de aprendizado"*, e estava mal formulada — ver §6.2.
2. **Uma variável por vez**, com a exceção da §6.3.
3. **Só ler dia fechado.**
4. **Passos de orçamento pequenos**, e conferir na coluna Última edição significativa se reiniciou.
5. **A cadência entre passos é dada pela amostra, não pelo Meta.** A ~10 clientes/dia, 3 dias; a ~30,
   um dia já serve.
6. **A regra de decisão é o lucro do dia**, não o CAC: `(clientes × líquido por cliente) − gasto`.
   Subiu, sobe de novo. Caiu, volta um degrau. CAC baixo demais quase sempre significa que se está
   gastando pouco.
7. **Não aplicar recomendação automática do Meta** — as de criativo são edição significativa, e
   trocam um reinício certo por um ganho prometido de 3%.
8. **O conjunto que funciona não se toca.** Criativo novo entra em conjunto NOVO, por duplicação: o
   duplicado aprende do zero, o original continua faturando.

### 6.2 "Não editar durante o aprendizado" era a regra ERRADA

O dono perguntou em 17/09, e a pergunta desmontou a minha própria formulação:

> *"Me explique a lógica de agora que você considera que o resultado ficou confiável, fazer outro
> reinício."*

É uma contradição aparente legítima: passei três dias dizendo para não tocar em nada e, no dia em
que os números ficaram bons, propus mexer.

**A contradição some quando se troca a regra pela certa.** Eu nunca estive esperando para
*preservar* o aprendizado — estava esperando para conseguir **ler**. Nos dias 14–16 eu não sabia se
o CAC alto era o reinício ou um problema real; qualquer mudança ali entraria em cima de um número
sem interpretação, e uma piora seria inatribuível.

| | |
|---|---|
| **Reinício sem linha de base** | Você não sabe se a queda é a fase ou a mudança. Foi o dia 14, e custou três dias de dúvida |
| **Reinício COM linha de base** | CAC volta a ~9–10 → escalou, sobe de novo. CAC estaciona em ~13–14 → o público não comporta, volta um degrau |

A linha de base desta campanha, medida no dia 16: **CAC R$ 9,71 · ROAS 5,15× · conversão 17,3% ·
custo por chegada R$ 1,68.**

> **Atualizada em 21/09, e agora em bloco em vez de dia único.** Os três dias inteiros em R$ 149
> (18–20) dão **CAC R$ 11,10 · ROAS 4,43× · conversão 15,8% · custo por chegada R$ 1,75**. Um dia
> só é linha de base frágil — o 16 foi escolhido por ser o melhor disponível, não por ser típico, e
> o dia 18 mostrou quanta dispersão cabe dentro do "normal" desta campanha.

> **Reinício não é o custo a evitar — cegueira é.** "Nunca reiniciar" não é estratégia, é paralisia:
> significa orçamento congelado para sempre. O reinício é o **preço de agir** sobre uma informação
> que você já tem, e o preço está medido: os dias 14–16 deram ROAS 3,52× / 3,89× / 5,15×, todos
> lucrativos, ~R$ 550 de lucro a menos em ~2,5 dias.

### 6.3 O que se agrupa é o DIA, não a edição

A §5.4 diz para não mudar duas coisas ao mesmo tempo. A exceção, proposta pelo dono em 17/09:

> **Se a segunda mudança não tem efeito de performance para atribuir, mas dispara reinício, ela deve
> pegar carona na primeira.** Paga-se o pedágio uma vez em vez de duas.

**Eu escrevi isso como "numa edição só", e estava errado.** Na execução ficou claro que o agrupamento
possível é por DIA:

> *"Como um era a nível campanha e outro a nível criativo, não tinha jeito, precisei publicar 2
> vezes."* — o dono, 17/09

E não custou nada, porque **"Última edição significativa" é um carimbo único, não um contador.**
Duas publicações às 9h00 e às 9h05 deixam o relógio correndo a partir das 9h05 — idêntico a uma
publicação só. O que cobra dobrado são reinícios em **dias diferentes**, porque aí são duas fases de
aprendizado.

> **A regra correta:** agrupar mudanças no MESMO DIA, quantas publicações forem necessárias. O custo
> de uma edição significativa é o **relógio**, não a contagem.

**A estrutura desta conta, que eu tinha errado:**

| Objeto | Nome | O que carrega |
|---|---|---|
| Campanha | `teste-set-01` | **o orçamento** (é CBO) e uma data de término própria |
| Conjunto | `teste-criativo` | a **fase de aprendizado**, e outra data de término |
| Anúncios | `reel-30s`, `reel-3-erros`, `estatico-preco`, `estatico-4-7` | — |

Eu vinha chamando `teste-set-01` de "conjunto" — é a campanha. E as **duas** datas de término
precisavam sair: o conjunto ser contínuo não adianta se a campanha para, porque a campanha é o pai.
A coluna "Última edição significativa" **não existe no nível de campanha**, e isso é esperado —
aprendizado é conceito de conjunto.

**O que foi feito em 17/09:** orçamento R$ 125 → **R$ 149** na campanha, data de término removida no
conjunto E na campanha. Três mudanças, duas publicações, um dia.

**Resultado — CONFIRMADO em 17/09, depois da revisão concluir:** orçamento em R$ 149, campanha e
conjunto contínuos, status **Ativo**, e "Última edição significativa" **continuou em 14/09**.

> ### As três mudanças NÃO reiniciaram o aprendizado
>
> | Mudança | Onde | Reiniciou? |
> |---|---|---|
> | Orçamento R$ 125 → R$ 149 (**+19,2%**) | campanha, sob CBO | **Não** |
> | Remoção da data de término | conjunto | **Não** |
> | Remoção da data de término | campanha | **Não** |
>
> É a primeira medição direta que este projeto tem sobre o que o Meta considera "significativo" —
> a documentação dele só diz *"dependendo da magnitude"* e nunca dá número.

**O que NÃO se pode concluir daqui, e é importante não inventar:**

Seria tentador fechar um intervalo — *"+19,2% não reinicia, +48,8% reinicia (o R$ 84 → R$ 125 de
antes), logo o limiar está entre os dois"*. **Não fecha**, por um detalhe de horário: o orçamento
foi para R$ 125 por volta de 13/09 (o dia 13 já gastou R$ 156,82, que é 125% de 125), e o carimbo de
reinício é de **14/09 às 07:21**. As datas não batem.

Então o saldo honesto é:

- ✅ **Eliminada** a hipótese de que mudar data de término reinicia — medido nos dois níveis.
- ⚠️ **A causa do reinício de 14/09 07:21 continua desconhecida.** Os dois suspeitos naturais caíram
  ou não encaixam no horário.
- ❌ **Não existe limiar medido.** Só existe um ponto: **+19,2% é seguro.** Um ponto não é curva.

**Consequência operacional, que é o que interessa:** passos de até ~19% podem ser dados **sem custo
de reinício**, o que muda a estratégia de escala — em vez de poucos saltos grandes e caros,
uma escada de degraus pequenos e frequentes, na cadência de amostra da regra 5 (a ~13 clientes/dia,
um degrau a cada 3 dias):

| Degrau | Δ/dia | Clientes extras | Lucro extra/dia | Teto da semana |
|---|---|---|---|---|
| 149 → 177 | +28 | 2,88 | ~R$ 103 | R$ 1.239 |
| 177 → 211 | +34 | 3,50 | ~R$ 126 | R$ 1.477 |
| 211 → 251 | +40 | 4,12 | ~R$ 148 | R$ 1.757 |

**A escada só é válida enquanto o CAC segurar.** Ela supõe R$ 9,71, e o CAC sobe conforme o público
bom se esgota. A regra 6 continua sendo o juiz: subiu o lucro do dia, dá outro degrau; caiu, volta um.

### 6.4 A conta que decide qualquer passo de orçamento

Antes de subir, calcular o retorno do incremento contra o custo do reinício:

```
clientes extras/dia = Δorçamento ÷ CAC
lucro extra/dia     = (clientes extras × líquido por cliente) − Δorçamento
payback em dias     = custo do reinício ÷ lucro extra/dia
```

Com os números de 17/09 — Δ R$ 25, CAC R$ 9,71, líquido R$ 45,60:

```
25 ÷ 9,71        = 2,57 clientes/dia
2,57 × 45,60     = R$ 117,19
117,19 − 25      = R$ 92 de lucro extra por dia
550 ÷ 92         ≈ 6 dias de payback
```

| Horizonte | Ganho | Contra o reinício (~R$ 550) |
|---|---|---|
| 6 dias (até a data de término original) | ~R$ 553 | **empata** |
| 30 dias (sem data de término) | ~R$ 2.766 | **5× o custo** |

> **É a conta que amarra as duas decisões, e foi o achado do dia.** Com data de término em 23/09,
> subir o orçamento EMPATA e não se justifica. **É remover a data que faz o aumento valer a pena.**
> Sozinha, cada uma das duas mudanças é marginal; juntas, fazem sentido — e não por economia de
> pedágio, mas porque uma cria o horizonte que paga a outra.
>
> Ressalva honesta: a conta supõe o CAC segurando com 20% mais orçamento. Ele costuma degradar um
> pouco, então o payback real é mais longo que 6 dias.

### 6.1 Quando cabe um segundo criativo — a conta, não o palpite

Perguntado em 15/09: *"faz sentido criar outra campanha com outro reel, ou vai aumentar meu custo e
fazer um trabalho que o outro já faz?"*

**A unidade certa é CONJUNTO, não campanha.** Campanha nova separa orçamento e aprendizado sem
nenhum ganho: mesmo público, mesmo objetivo, mesmo leilão. O que se quer isolar é o criativo, e o
criativo mora no conjunto.

**E não adianta pôr no conjunto que já roda.** Medido em 13/09, com 4 anúncios no mesmo conjunto:

| Criativo | Gasto | Compras |
|---|---|---|
| reel-30s | R$ 221,19 | 10 |
| reel-3-erros | — | 0 |
| estatico-preco | R$ 1,47 | 0 |
| estatico-4-7 | R$ 0,49 | 0 |

O Meta concentrou ~100% em um. **Anúncio dentro de conjunto vencedor não é testado, é sufocado** — e
ainda por cima entrar com criativo novo reinicia o aprendizado do conjunto que está faturando.

#### ⚠️ Esta conta assume orçamento POR CONJUNTO. Esta conta não tem.

Descoberto em 17/09: o orçamento está na **campanha** (`teste-set-01`), não no conjunto — é
**CBO**, orçamento de campanha Advantage. Isso muda o teste de criativo de forma material:

**Com CBO, você não divide o orçamento entre dois conjuntos. O Meta divide.** E já se sabe como ele
divide, porque ele fez isso com os quatro anúncios: **R$ 221,19 para um e R$ 0,49 para outro.** Dois
conjuntos sob CBO terminariam do mesmo jeito — um come tudo, o outro morre sem amostra, e o teste
não acontece.

Então, antes de qualquer teste de criativo, existe uma decisão anterior:

| Caminho | O que custa |
|---|---|
| **Mudar para orçamento por conjunto (ABO)** | É mudança de estrutura de orçamento — quase certamente edição significativa, logo um reinício. Mas é a única forma de garantir amostra aos dois |
| **Manter CBO e aceitar** | Sem custo, mas não é teste: é o Meta escolhendo, e ele escolhe cedo demais e com pouca evidência |

**A conta abaixo continua válida como limiar de amostra** — cada conjunto precisa de ~50 conversões
em 7 dias, e isso não muda com CBO. O que muda é que, sob CBO, você não controla se cada conjunto
vai receber orçamento suficiente para chegar lá.

#### O limiar, em reais por dia

Cada conjunto precisa de ~50 conversões em 7 dias para sair do aprendizado (§1) — **~7,1 por dia,
por conjunto.** Logo:

```
orçamento mínimo por conjunto = 7,1 × CAC
```

| CAC | Mínimo por conjunto/dia | Dois conjuntos |
|---|---|---|
| R$ 7,84 (dia 13) | R$ 56 | **R$ 112/dia** |
| R$ 13,74 (dia 14) | R$ 98 | **R$ 196/dia** |

**Com R$ 125/dia divididos em dois**, cada conjunto fica com R$ 62,50:

- a CAC de R$ 7,84 → 7,97/dia → **56 por semana**. Passa, no fio.
- a CAC de R$ 13,74 → 4,55/dia → **32 por semana**. **Não passa** — os DOIS conjuntos travam em
  aprendizado permanente, e é o pior dos mundos.

> **A decisão é derivada, não é de gosto:** ela depende de onde o CAC fechar quando o aprendizado
> atual terminar. Ler em 17–18/09. CAC em ~8 → cabe testar com orçamento atual. CAC em ~14 → só
> depois de subir o orçamento para a faixa de R$ 200/dia.

#### ✅ CONDIÇÃO LIDA em 21/09 — e a resposta é NÃO AINDA

O CAC dos três dias inteiros em R$ 149 (18–20) fechou em **R$ 11,10** — entre os dois postes, mais
perto do lado que manda esperar. A conta do limiar, com o número real:

```
mínimo por conjunto = 7,1 × 11,10 = R$ 78,81/dia
dois conjuntos      = R$ 157,62/dia ENTREGUES
```

**E o que importa é entregue, não orçado.** O gasto real dos três dias foi **R$ 144,27/dia**.
Dividido em dois: R$ 72,14 por conjunto → 6,5 conversões/dia → **45 por semana. Não passa.**

Para os dois conjuntos limparem as 50/semana seria preciso entregar ~R$ 158,57/dia, o que a 97% de
entrega pede orçamento de **~R$ 165**.

> ⚠️ **E aqui o caminho se morde:** a saída óbvia — subir o orçamento — é justamente a alavanca que
> os dias 18–20 mostraram gasta. O orçamento subiu 19,2% e a entrega subiu 3,3%. Pôr R$ 165 no campo
> não garante R$ 158 entregues; pela única medição que existe, garante ~R$ 149.
>
> Ou seja: **não dá para comprar o teste de criativo com orçamento neste momento.** A decisão volta
> para "escalar primeiro, testar depois", e escalar deixou de ser uma edição — virou um problema.

#### ⚠️ Correção: eu atribuí o platô a fadiga de criativo, e a medição desta seção diz o contrário

Em 21/09 eu disse ao dono que doze dias com o mesmo anúncio faziam de fadiga de criativo a causa
provável do platô. **Não conferi esta seção antes de dizer isso**, e ela mede o oposto: frequência
1,14–1,20, cada pessoa tendo visto o anúncio uma vez.

A ressalva verdadeira é que a frequência foi lida em 15/09 e sobe com o tempo. Então não é que eu
estivesse certo por outro caminho — é que **ninguém sabe**, e saber custa abrir o gerenciador e ler
a coluna. Enquanto não for lida, fadiga é palpite, e o palpite já foi publicado uma vez como se
fosse leitura.

#### ~~Fadiga de criativo não é o motivo aqui~~ — VERDADE EM 15/09, FALSA EM 21/09

O motivo normal para criativo novo é a peça cansar. **A medição diz que não cansou:** público de
15,5–18,2 milhões, frequência **1,14–1,20**, alcance abaixo de 0,1%. Em média cada pessoa viu o
anúncio uma vez. Não há desgaste a combater — o reel atual não está no fim da vida útil.

> ⚠️ **A condição virou. Frequência lida em 21/09: 2,41, sobre alcance de 23.042.**
>
> Não é que a seção estivesse errada — ela estava certa no dia em que foi medida, e a frequência
> **dobrou em seis dias**. Uma seção que afirma um estado do mundo tem prazo, e este venceu.
>
> ⚠️ **Falta o período da leitura.** 2,41 em 7 dias é faixa de alerta; 2,41 na vida inteira da
> campanha (13 dias) é baixo e não indica desgaste nenhum. O print não trouxe o seletor, e a
> diferença inverte a conclusão — está escrito como pendência, não como achado.

#### A regra geral que fica

| O que varia | Onde vai |
|---|---|
| **Criativo** | Conjunto novo, por duplicação, no mesmo objetivo |
| **Público, região, objetivo** | Aí sim, campanha nova — são leilões diferentes |

---

## 7. O que ficou em aberto

- **A causa do V dos dias 11–12.** Provavelmente a transição do sinal. Não será resolvido.
- **O segundo criativo.** O teste de 4 peças nunca aconteceu: no mesmo conjunto, o Meta deu R$0,49 a
  um dos anúncios e 95% a outro. Testar criativo exige conjunto separado — e conjunto separado exige
  orçamento que sustente os dois. **Escalar primeiro, testar depois.** A conta do limiar está na
  §6.1; deixou de ser opinião.
- **Hash de e-mail na API de Conversões.** Subiria a qualidade da correspondência (hoje 4,4/10, só
  `fbc`/`fbp`). Custa uma atualização da política de privacidade e é decisão do dono. Ver
  `lib/meta-capi.ts`.

  **Por que NÃO entrou no pacote de 17/09**, embora o dono tenha perguntado: não é um botão no
  Gerenciador — é código nosso mais um documento legal. Apressar uma política de privacidade para
  pegar carona numa edição de anúncio inverte a ordem das coisas. E ela **não tem pedágio para
  dividir**: não toca no conjunto, logo não reinicia aprendizado. Não há nada a economizar juntando.

  A janela limpa era "entre campanhas, depois de 23/09" — mas **a campanha virou contínua em 17/09 e
  essa janela deixou de existir**. A nova referência: fazer quando a série estabilizar depois deste
  reinício, por volta de 21/09, como variável isolada.

- **Aprimoramentos de criativo Advantage+.** Recusado duas vezes, e na segunda o motivo mudou de
  lugar. Em 15/09 era o reinício que ele dispararia; em 17/09 o reinício já estava pago e ele
  continuou recusado por outra razão: **ele modifica o criativo que está funcionando** em troca de
  3% prometidos pelo experimento do Meta, não por esta conta. Com um reel em 10 compras e três
  anúncios em R$ 0,49, o criativo vencedor é o pior lugar para apostar 3%.
