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

### 1.5 Orçamento diário é MÉDIA, não teto

O Meta pode gastar até **125% do orçamento diário num único dia**, compensando nos outros para
manter a média da janela de 7 dias.

Medido duas vezes nesta conta:

| Orçamento | Gasto no dia | Razão |
|---|---|---|
| R$ 84,00 | R$ 105,00 | **1,25×** |
| R$ 125,00 | R$ 156,82 | **1,25×** |

**Consequência operacional:** quando o dia está indo bem e o orçamento parece estar acabando, **o
espaço já existe** — 25% a mais, sem precisar editar nada. Editar para "aproveitar o dia" compra
algo que você já tem e ainda arrisca um reinício.

E o inverso: **subgasto é informação.** No dia 11 o Meta gastou R$57,91 de R$84. Ele não achou
leilões que valessem o preço — não é falha de configuração.

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

**Clientes > pagaram** significa marcos faltando — 2, no dia 14. Duas causas possíveis, e elas
pedem ações opostas:

| Causa | Mecanismo | É defeito? |
|---|---|---|
| **(a) Comprador repetido de outro dia** | O marco `paid` é único por visitante **na vida**. Quem já comprou em 13/09 com o mesmo cookie não gera marco novo em 14/09 — o `onConflictDoNothing` engole. O pedido e o cliente contam hoje; o marco está datado lá atrás. | **Não.** É o desenho. |
| **(b) Marco descartado** | `markFunnelBySessionId` desiste quando a sessão anônima não é encontrada. Era o `return` mudo que fez o funil parecer engolir venda em 12/09. | **Sim.** |

**Como separar as duas, sem deduzir:** procurar nos logs da Vercel, no dia em questão, a linha

```
[funil] marco "paid" descartado: sessão anônima <id> não encontrada
```

Duas linhas → causa (b), e o log traz o id para achar o pedido exato. Zero linhas → causa (a), o
funil está certo e o rótulo é que engana: "Pagaram" quer dizer *pessoas que pagaram pela primeira
vez*.

O log entrou em `795b789` (12/09) justamente porque, da primeira vez, **eu deduzi a causa em vez de
medir, e errei** — ver §5.3. Não deduzir de novo.

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

| Dia | | Gasto | Chegaram | Pagaram | Receita | Custo/chegada | Conversão | CAC | ROAS |
|---|---|---|---|---|---|---|---|---|---|
| 09 | qua | 23,41 | 17 | 6 | 279,94 | 1,38 | 35,3% | 3,90 | 11,96× |
| 10 | qui | 88,16 | 46 | 14 | 699,86 | 1,92 | 30,4% | 6,30 | 7,94× |
| 11 | sex | 57,91 | 27 | 4 | 199,96 | 2,14 | 14,8% | 14,48 | 3,45× |
| 12 | sáb | 105,84 | 40 | 6 | 299,94 | **2,65** | 15,0% | 17,64 | 2,83× |
| 13 | dom | 156,82 | 87 | 22 | 919,80 | **1,80** | 25,3% | 7,13 | 5,87× |
| 14 | seg | 164,89 | 86 | 10 | 579,88 | 1,92 | **11,6%** | 16,49 | 3,52× |
| **Σ** | | **597,03** | **303** | **62** | **2.979,38** | **1,97** | **20,5%** | **9,63** | **4,99×** |

**Lucro líquido dos 6 dias: ~R$ 2.218** (receita × 0,9447 de líquido, menos o gasto). O dia 14
sozinho deu ~R$ 383.

> **O dia 14 é o primeiro com os três números separados**, porque foi quando o painel passou a
> mostrá-los: **10 pessoas no funil · 12 pedidos · 12 clientes**. A coluna "Pagaram" da tabela usa
> o número do FUNIL nos seis dias, porque é o único que existe para os cinco primeiros — trocar de
> métrica no meio da série inventaria uma variação que é só de definição. Pelo divisor de clientes,
> o CAC do dia 14 é **R$ 13,74**, não 16,49.

### O V, e o que ele diz

```
Custo/chegada:  1,38 → 1,92 → 2,14 → 2,65 → 1,80 → 1,92
Conversão:     35,3% → 30,4% → 14,8% → 15,0% → 25,3% → 11,6%
```

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

1. **Nada de editar durante a fase de aprendizado**, salvo CAC acima do teto por dois dias.
2. **Uma variável por vez.**
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

---

## 7. O que ficou em aberto

- **A causa do V dos dias 11–12.** Provavelmente a transição do sinal. Não será resolvido.
- **O segundo criativo.** O teste de 4 peças nunca aconteceu: no mesmo conjunto, o Meta deu R$0,49 a
  um dos anúncios e 95% a outro. Testar criativo exige conjunto separado — e conjunto separado exige
  orçamento que sustente os dois. **Escalar primeiro, testar depois.**
- **Hash de e-mail na API de Conversões.** Subiria a qualidade da correspondência (hoje 4,4/10, só
  `fbc`/`fbp`). Custa uma atualização da política de privacidade e é decisão do dono. Ver
  `lib/meta-capi.ts`.
