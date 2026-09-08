# TRAFEGO_PAGO.md — a primeira campanha

> Plano da primeira compra de mídia do Tennis Engineer. Orçamento aprovado: **R$ 500**.
> Escrito em 08/09/2026, contra os preços e o rastreamento que estão no ar hoje.

---

## 1. A conta que decide tudo, antes de qualquer criativo

> **Corrigido em 08/09/2026.** A primeira versão desta seção usou o preço de tabela do
> `racket_report` (R$ 29,99) e concluiu que a campanha empatava na melhor das hipóteses. **O ticket
> médio REAL das vendas é R$ 48** — o dono conferiu. A diferença não é de arredondamento: ela muda
> a conclusão de "não dá para ter lucro" para "dá, com folga apertada".
>
> A lição para as próximas contas deste arquivo: preço de tabela não é ticket médio. Com dois
> produtos (R$ 29,99 e R$ 49,99) mais três upsells, o que decide a conta é o MIX, e o mix só se
> conhece medindo. Os R$ 48 dizem que quase todo mundo leva o setup completo.

Ticket médio **R$ 48**. Depois da taxa do Mercado Pago (~5%), sobram cerca de **R$ 45,60 líquidos
por venda**.

```
CPC de R$ 0,80  ÷  conversão de 3%  =  CPA de R$ 26,67
R$ 45,60 líquidos  −  R$ 26,67  =  R$ 18,93 de margem
```

Isso é **41% de margem sobre a receita líquida**, numa hipótese de conversão (3%) que ainda é
otimista para tráfego frio. Se a conversão real vier em 1,5%, o CPA dobra para R$ 53 e a campanha
passa a dar prejuízo. **A conta fecha ou não fecha dependendo de um número que ninguém tem.**

É por isso que o objetivo da primeira campanha continua não sendo lucro — mudou só o motivo. Antes
era "não há margem nem no melhor caso"; agora é "há margem, e ela depende inteiramente de uma taxa
que precisa ser medida antes de escalar":

> **O trabalho da primeira campanha é descobrir três números que hoje não existem:**
> o CPC real deste público, a taxa de quem clica e termina o questionário, e a taxa de quem termina
> e paga. Com os três, dá para calcular se tráfego pago pode funcionar aqui — e nenhum deles pode
> ser estimado de fora.

---

## 2. Por que R$ 500 não compra um teste de 4 criativos

Existem 2 reels e 2 estáticos prontos. A vontade natural é testar os quatro. O orçamento não deixa,
e vale entender por quê antes de dividir a verba em quatro.

O Meta precisa de aproximadamente **50 conversões por semana por conjunto de anúncios** para sair
da fase de aprendizado e otimizar de verdade. A R$ 48 de ticket médio, 50 compras semanais são
R$ 2.400 de receita — muito além do que R$ 500 de verba total produz. **Nenhum conjunto vai sair da
fase de aprendizado**, e um teste de quatro braços com R$ 125 em cada mede sobretudo ruído.

| | Como | Cliques por criativo (a R$ 0,80) | O que se aprende |
|---|---|---|---|
| A | 4 anúncios | ~150 | quase nada: 150 cliques não distinguem 2% de 4% |
| **B** | **2 anúncios** | **~300** | **qual dos dois traz gente que termina o questionário** |

**Rode 2, não 4.** O dono já concordou em não testar todos, e isso é o que torna o teste legível:
dobrar a verba por criativo é a única forma de sair do ruído com R$ 490.

**Quais 2: o melhor reel e o melhor estático.** Assim o teste responde formato e gancho ao mesmo
tempo. É verdade que isso confunde as duas variáveis — se o reel ganhar, não dá para saber se foi
o vídeo ou a mensagem. Com R$ 490 não existe desenho que separe as duas, e saber *"o vídeo com
aquela mensagem funciona"* já decide a próxima campanha. Os outros dois entram na rodada seguinte,
contra o vencedor desta.

Os dois vão no **mesmo conjunto**, não em conjuntos separados: com verba pequena, dois conjuntos
disputam o mesmo público e encarecem os dois leilões.

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
custo máximo por início  =  R$ 45,60  ×  (taxa de quem inicia o questionário e paga)
```

### A taxa foi medida — 08/09/2026, antes da campanha

O dono trouxe o funil real: **111 abriram o questionário, 27 pagaram = 24,3%.**

```
teto de custo por início  =  R$ 45,60  ×  0,243  =  R$ 11,08
```

**R$ 11 por início de questionário é folgadíssimo.** No Meta brasileiro, com CPC entre R$ 0,50 e
R$ 1,50 e uma fração razoável dos cliques começando o questionário, o custo por início deve cair
entre R$ 1 e R$ 5. Sobre esse teto, a campanha tem espaço de sobra.

#### ⚠️ Mas esses 111 NÃO são tráfego frio

É a ressalva que decide se este número serve para planejar. Essas 111 pessoas chegaram por
orgânico, indicação e rede do dono — gente que já tinha algum motivo para confiar. **Tráfego frio de
anúncio converte tipicamente uma fração disso**, porque não tem nenhum.

Não dá para saber a fração sem rodar. O que dá para fazer é decidir antes o que cada cenário
significa, e é isso que o critério de parada da §6 passa a usar:

| Se o frio converter... | taxa | teto por início | veredicto |
|---|---|---|---|
| igual ao atual | 24,3% | R$ 11,08 | improvável, e ótimo |
| metade | 12% | R$ 5,47 | confortável |
| um terço | 8% | R$ 3,65 | funciona |
| um quinto | 5% | R$ 2,28 | apertado, mas de pé |
| um décimo | 2,4% | R$ 1,09 | não fecha |

**A campanha só não fecha se o tráfego frio converter dez vezes pior que o atual.** Isso é possível,
e é o risco real — mas quatro dos cinco cenários fecham a conta. Era o oposto disso quando a §1
usava o ticket errado.

---

## 4. A estrutura, concreta

| | |
|---|---|
| Plataforma | Meta (Instagram + Facebook), campanha única |
| Objetivo | Vendas, otimizando pelo evento de início de questionário |
| Conjuntos | **1** |
| Anúncios | **2** — o melhor reel e o melhor estático (ver §2) |
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
`utm_content` diferente por anúncio, os dois somam numa linha só e o teste não responde nada.

```
https://tennisengineer.com.br/?utm_source=meta&utm_medium=cpc&utm_campaign=teste-set-01&utm_content=reel-3-erros
https://tennisengineer.com.br/?utm_source=meta&utm_medium=cpc&utm_campaign=teste-set-01&utm_content=estatico-4-7
```

Os dois criativos que ficam de fora já têm nome reservado, para a rodada 2 não reaproveitar um
`utm_content` antigo e misturar duas campanhas na mesma linha do painel:
`reel-47-colocada` e `estatico-55-porcento`.

Troque os nomes de `utm_content` pelos seus, mas **mantenha um por criativo e não repita**. O
primeiro toque vence (ver `schema/campaigns.ts`), então quem clicar em dois anúncios fica creditado
ao primeiro — o que é o comportamento certo e mais um motivo para os nomes serem distintos.

---

## 5. O que precisa estar pronto ANTES de gastar o primeiro real

Nesta ordem. O item 1 era bloqueante e já está feito; falta configurar o id do pixel.

### 1. Pixel do Meta + banner de consentimento — ✅ construído em 08/09/2026

O produto não tinha `fbq`, `gtag`, nada. Sem pixel a campanha não otimiza nem pelo evento do meio
do funil — vira compra de cliques.

**O dono aprovou instalar, com banner de consentimento.** É uma reversão deliberada da postura de
privacidade que o produto assumiu por escrito, e por isso não entrou escondido:

| | |
|---|---|
| `src/lib/consent.ts` | o estado do consentimento. **Cookie ausente = não decidido = nada carrega** |
| `src/components/marketing/consent-banner.tsx` | banner + injeção do pixel, no mesmo arquivo, com a injeção **dentro** da condição de aceite |
| `src/lib/meta-pixel.ts` | os eventos. No-op silencioso quando não há `fbq` |
| `/privacidade` | reescrita: o que o Meta recebe, quando, e o que ele nunca recebe |
| `tests/ethics/consentimento.test.ts` | trava a decisão **e** a estrutura — nenhum outro arquivo pode carregar o script |

Decisões que valem registro:

- **Banner e pixel no mesmo componente.** Separados, existiria um caminho em que o pixel carrega
  sem o banner; juntos, não existe.
- **Recusar tem o mesmo tamanho, peso e área de clique que aceitar.** Um "recusar" menor é o padrão
  escuro que invalida o consentimento — se recusar dá mais trabalho, o "sim" não foi livre.
- **A recusa é gravada**, e não apenas "não aceita": sem isso quem recusa vê o banner toda visita.
- **O funil interno não depende do pixel.** Quem recusa continua contado em `/admin/funil`. Se o
  pixel sair um dia, a medição que decide continua inteira.

**Falta configurar:** a variável `NEXT_PUBLIC_META_PIXEL_ID` na Vercel, com o id do Gerenciador de
Eventos. Vazia, o pixel fica desligado mesmo para quem aceitou — que é o padrão seguro. O id não é
segredo (fica visível no HTML de qualquer site que anuncia), então pode ir por `NEXT_PUBLIC`.

**Uma expectativa a ajustar:** neste orçamento o pixel muda pouco o resultado da campanha, porque
não haverá volume para otimizar por compra de qualquer jeito. O que ele faz é **começar a acumular
histórico** — é a próxima campanha, e não esta, que colhe o benefício.

### 1-bis. API de Conversões — deliberadamente NÃO construída

Ela estava no escopo aprovado e ficou de fora. O motivo, para a decisão poder ser revista:

A API de Conversões serve para recuperar eventos que o bloqueador de anúncio e o iOS derrubam. Isso
importa **em escala**. Com R$ 490 e algo entre dez e vinte compras, o que ela recupera é da ordem de
poucos eventos — enquanto o custo é um token secreto novo, envio de dado pessoal com hash a partir
do servidor, e uma segunda superfície de privacidade para descrever e manter.

Trocar isso por poucos eventos, num momento em que o evento de otimização nem é a compra, não se
paga. **Vale construir quando a campanha escalar** — e aí o consentimento já mora num cookie que o
servidor lê, que é justamente o que `consent.ts` deixou pronto para esse dia.

### 2. A home no celular, com olho de tráfego frio — ✅ vistoriada em 08/09/2026

Medida com o site rodando, viewport de iPhone 13 (390 × 844), que é o aparelho mais comum do
tráfego de Instagram no Brasil.

| | |
|---|---|
| Altura total da home | 6.033 px = **7,1 dobras** |
| Primeiro CTA | dobra 0,5 — ✅ dentro da primeira tela |
| Primeiro preço visível | 4.618 px = **dobra 5,5** |
| Banner de consentimento | **490 px = 30% da dobra** → corrigido para **104 px = 12%** |

**Corrigido agora:** o banner que eu mesmo tinha acabado de escrever ocupava 30% da primeira tela.
Para quem chega de anúncio e decide em três segundos, a primeira impressão seria 70% produto e 30%
aviso de cookie. Encolheu para 12% sem perder nada do que é obrigatório — recusar continua com o
mesmo peso visual e a mesma área de clique que aceitar.

**A primeira dobra está boa.** Título, promessa, os dois botões e a linha que remove as três
objeções mais caras — *"Questionário gratuito · 3 a 5 minutos · sem cadastro"* — cabem todos antes
do primeiro scroll. Para tráfego frio isso é o essencial, e já está lá.

#### ⚠️ O achado que é decisão do dono: o preço aparece na dobra 5,5

Ninguém que vem de anúncio rola cinco telas e meia. Na prática, **quem clica no anúncio começa o
questionário sem saber que existe um preço no fim** — descobre depois de investir 3 a 5 minutos
respondendo.

Isso não é necessariamente errado: é o modelo de dar valor antes de pedir dinheiro, e ele funciona
em muito lugar. Mas tem um custo específico que o funil desta campanha vai medir, e vale prever
onde ele aparece: **na queda entre `quiz:done` e `plans`.** Se essa etapa for a maior perda do
funil, a causa provável é surpresa com o preço, e não a página de planos.

Três saídas, em ordem de esforço:

1. **Não mexer**, e deixar o funil responder. É defensável — a decisão de campanha da §6 já separa
   "abandona no meio" de "termina e não paga", que é exatamente essa distinção.
2. **Uma linha de expectativa na primeira dobra**, do tipo *"análise completa a partir de R$ 29,99"*
   junto do "questionário gratuito". Custa uma linha e elimina a surpresa.
3. **Levar a seção de preço para antes da dobra 3.** Mudança maior, e testa duas coisas ao mesmo
   tempo se feita junto com a campanha — o que a §7 diz para não fazer.

**Recomendação: a 2.** Ela remove a surpresa sem reordenar a página, e mantém uma variável só no ar
durante o teste de criativo. Mas é decisão de produto, não minha — e por isso não fiz.

### 3. Configurar o id do pixel na Vercel

Quem vem de anúncio não conhece a marca e decide em três segundos. Vale abrir a home no celular e
perguntar: em três segundos dá para saber o que isto faz e quanto custa? Se o preço só aparece
depois do questionário inteiro, parte do abandono vai ser por isso e não pelo anúncio.

---

## 5-bis. O funil de 08/09, e o vazamento que vale mais que a campanha

| Etapa | Pessoas | Da anterior |
|---|---|---|
| Abriu o questionário | 111 | — |
| Terminou o questionário | 93 | 84% |
| Viu a prévia da análise | 95 | *102%* ⚠️ |
| **Abriu os planos** | **38** | **40%** ← |
| Iniciou o pagamento | 29 | 76% |
| Pagou | 27 | 93% |
| Abriu o relatório | 27 | 100% |

**O funil inteiro está saudável, menos um degrau.** Pagamento converte 93%, plano→checkout 76%, e
todo mundo que pagou abriu o relatório — o produto entrega. O questionário segura 84%, o que é bom
para um formulário de 3 a 5 minutos.

### O degrau: 95 → 38

**Seis em cada dez pessoas que viram a prévia não chegam nem a olhar os planos.** É de longe a maior
perda, e é o momento exato em que o pagamento aparece.

É o mesmo achado da §5.2 chegando pelo outro lado: o preço só aparece na dobra 5,5 da home, então
quem responde o questionário inteiro descobre que é pago **depois** de investir 3 a 5 minutos. A
prévia é onde essa descoberta acontece, e 60% saem ali.

**Quanto vale consertar.** Se esse degrau fosse de 40% para 55% — nada de extraordinário —, seriam
52 pessoas nos planos, ~37 pagantes, **33% de conversão total contra 24,3%**. Isso é 37% a mais de
receita sem um centavo de mídia e sem um visitante a mais.

> **Este conserto vale mais que a campanha inteira**, e é mais barato. Uma campanha de R$ 490 com
> 24,3% de conversão traz na casa de dez a vinte vendas; melhorar esse degrau melhora TODAS as
> vendas, para sempre, inclusive as orgânicas.

A recomendação da §5.2 (uma linha de expectativa de preço na primeira dobra) continua sendo o passo
mais barato, e agora tem número atrás: ela move a descoberta do preço para antes do investimento de
tempo, que é onde a frustração não existe.

### ⚠️ Um defeito de medição, não de produto: os 102%

95 pessoas viram a prévia e apenas 93 terminaram o questionário. **É impossível** — ninguém vê a
prévia sem terminar.

A explicação está no cabeçalho de `funnel-repo.ts`: visitantes anteriores à criação do marco
`quiz:done` chegaram às etapas seguintes sem ele. São dados de antes da instrumentação estar
completa, e o efeito tende a zero conforme entram visitantes novos.

**O que fazer com isso:** nada no código, mas tratar as duas primeiras linhas como aproximadas por
enquanto. As de baixo (planos, pagamento) são confiáveis, e são justamente as que sustentam as
conclusões acima. Se em duas semanas os 102% não tiverem sumido, aí é defeito de verdade e vale
investigar.

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
| Um `utm_content` come toda a verba | o Meta já escolheu | deixar, e guardar o outro para a rodada 2 |
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
| Preço de tabela | R$ 29,99 · R$ 49,99 (+ upsells de R$ 9,99 e R$ 29,99) |
| **Ticket médio real** | **R$ 48** — quase todo mundo leva o setup completo |
| Pixel | instalado em 08/09, atrás de consentimento. **Falta o id na Vercel** |
| Rastreamento próprio | primeiro toque por `utm_*`, 6 marcos de funil, cruzável por visitante |
| Relatório por criativo | **passou a existir em 08/09** — o `utm_content` era gravado e nunca lido |
| Campanhas anteriores | nenhuma |
