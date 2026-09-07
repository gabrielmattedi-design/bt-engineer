# CALIBRATION_LOG.md — Tennis Engineer

> §61: "Antes de liberar comercialmente: rodar recomendações, revisar manualmente, identificar
> inconsistências, ajustar pesos, **documentar alterações**."
>
> Este é o registro. Toda alteração de peso ou fórmula entra aqui, com o motivo e a evidência.

Formato de cada entrada: **data · versão · o que mudou · por quê · evidência**.

---

## 2026-09-08 · `engine 2.32.0` — potência e controle deixam de ser o mesmo eixo

### C-33 — `r(potência, controle) = −0,92` era álgebra nossa, não física ✅ corrigido

**Encontrado por:** o dono, com o relatório na tela. Declarou potência em 1º, controle em 2º e
manobrabilidade em 3º, não citou spin, e recebeu a HEAD Boom MP: potência p59, **controle p37**,
spin p72. Abaixo da média justamente no que pôs em segundo lugar, e destaque no que não pediu.

Medida a correlação no catálogo: **r(potência, controle) = −0,92**. Fomos às fórmulas e QUATRO dos
cinco termos de `control_score` eram os de `power_score` com o sinal invertido — cabeça, viga,
padrão e balanço. Controle era `1 − potência` por construção; quem declarasse os dois pedia os dois
extremos de um eixo só, e o motor resolvia pelo mais forte.

**Correção:** o RA medido entra na potência no lugar da viga, que pesava 0,28 fingindo ser rigidez
(r(viga, RA) = 0,098 — o mesmo defeito da C-31, aqui ainda de pé). O RA é ortogonal ao que já
usávamos — r com `power_score` antigo = +0,226, com `control_score` = −0,047 —, então é informação
nova. Entra só na POTÊNCIA: adicioná-lo aos dois com sinais opostos recriaria o espelho.

`weight_inverse` (0,15) sai da potência. Ele dizia "mais leve = mais potência", raciocínio do
JOGADOR e não do QUADRO, já coberto por `physical_fit` e `swing_fit` (0,36 somados). E produzia a
contradição que o dono sentiu: o relatório chama o eixo de "em busca de PESO NA BOLA" e ia buscar o
quadro mais LEVE — peso na bola é `stability_score`, a −0,83 da potência.

`control_score` cede metade do peso da viga para `swing_index`, que desde 07/09 é swingweight medido.

| | antes | depois |
|---|---|---|
| r(potência, controle) | −0,92 | **−0,73** |
| Babolat Pure Drive 98 (RA 69, a mais rígida) | potência p36 | **p56**, controle p64 |
| HEAD Radical Pro (RA 65) | p18 | p35 |

A ordenação de potência passou a ser a que qualquer jogador nomearia: Pure Drive 107, EZONE 105,
Pure Drive Team e Pure Drive no topo; Gravity Pro, Blade 98 18×20 e Clash no fundo.

**Efeito colateral aceito:** r(potência, conforto) foi de −0,35 para −0,73, porque os dois agora
compartilham o RA com sinais opostos. Diferente do caso anterior, aqui o espelho é FÍSICO: a mesma
rigidez que devolve energia é a que transmite choque. É o trade-off clássico, não álgebra.

### C-34 — o limiar de "destaque" pegava 81% do catálogo em spin ✅ corrigido

`EXPECTATION_HIGH/LOW` eram 60/40 fixos sobre faixas que não são simétricas nem parecidas:

    eixo         média   >=60 (destaque)   <=40 (limitação)
    spin          65,7        38 de 47            4
    conforto      36,5         7                 29
    controle      44,6         8                 23

Em spin, "entre as que mais ajudam a rotação" saía para 81% do catálogo — a frase descrevia o eixo,
não a raquete. Foi por aí que o spin virou o único destaque do relatório de quem não pediu spin.

**Correção:** o limiar ancora na média do próprio eixo (`attribute_means`, que já viajava no
resultado), com margem de 12. Distribuição depois: spin 12/9, conforto 12/16, controle 9/13,
potência 17/14, estabilidade 17/16, manobrabilidade 15/19. `explainRacketFit` acompanhou no mesmo
commit — as duas seções precisam da mesma régua, ou volta a contradição da v2.28.

### C-35 — elogio não pedido calava, e `precision` não existia na seção ✅ corrigido

Regra nova: quando uma prioridade DECLARADA sai abaixo da média, um destaque em eixo não pedido não
ganha linha. A limitação não pedida continua saindo — calar defeito é pior que distrair.

Medindo o invariante em 1000 perfis, o número devia ser zero e deu **94**. Todos os 94 tinham
`precision` como prioridade — e `precision`, uma das SETE opções do questionário, não tinha entrada
em `EXPECTATION_AXES`. Quem a declarava nunca lia uma palavra sobre ela, apesar de o cabeçalho da
função prometer que "todo eixo declarado aparece". Acrescentada, o número foi a zero.

### Fica reportado, sem correção

Duas personas (`p01` e outra) declaram `forgiveness`, que o questionário **não oferece** e que
`DISPLAYED_ATTRIBUTES` não carrega. Cheguei a incluir o eixo na seção antes de medir e reverti:
cobri-lo exigiria ampliar a superfície exibida do produto por causa de um valor que nenhum usuário
consegue escolher. O defeito está no fixture — mesma classe que `conferirContraOQuestionario` pega
no sorteador e que ninguém aplica às personas. Há um teste `it.skip` em
`tests/ethics/pedido-e-destaque.test.ts` esperando a decisão.

---

## 2026-09-07 (2) · `engine 2.31.0` — a raquete atual acima do teto sai do pódio

### C-32 — isentar do filtro não podia significar promover ✅ corrigido

**Encontrado por:** o dono, lendo a varredura de 1000 perfis gerada logo após a C-30/C-31.

A atual é isenta do teto de peso em `applyWeightCeiling`, e a isenção continua certa: ela é
referência do relatório, e removê-la esconderia a comparação que explica o teto. O que ninguém
tinha separado é que a isenção a mantinha CANDIDATA, e do ranking ela saía em 1º.

O caso que decidiu:

    #0085 — mulher, 26 anos, iniciante, sedentária, DOR NO COTOVELO, teto 280 g
            1º HEAD Extreme Pro · 305 g · 76,3% de compatibilidade

O aviso existia logo abaixo, e não desfazia a hierarquia da página: primeiro lugar, número alto,
alternativa em 2º. **Esta é a segunda decisão do dono sobre o mesmo ponto** — em 2026-08 ele havia
escolhido deixar a atual vencer com aviso, e reverteu ao ver o resultado na tela. As duas ficam
registradas em `tests/ethics/atual-acima-do-teto.test.ts`.

**Correção:** `selectPodium` deixa de promover a atual quando ela excede o teto, e a alternativa
dentro do teto passa a ocupar o 1º lugar em vez do 2º. A atual permanece no `full_ranking` com a
nota real, e ganha um ramo próprio em `standingCore` (`verdict: 'above_ceiling'`) que diz a nota, a
posição, os gramas de excesso e — quando os dois são medidos — o swingweight dos dois quadros.

**Duas armadilhas que a mudança abriu, as duas fechadas:**

1. `standingCore` calcula `gap = podium[0] − atual`, e com a atual fora do pódio o gap pode ficar
   NEGATIVO. Cairia em `gap <= 0` e o texto diria "a raquete que você já tem é a melhor opção"
   para quem acabou de ler que o quadro é pesado demais. O ramo novo roda ANTES dos ramos de gap.
2. Uma raquete pode estar fora do pódio por DOIS motivos ao mesmo tempo — teto e irmã de linha.
   O modo família rodava por cima e calava sobre os gramas. O teto passa a ganhar: fala do corpo da
   pessoa, traz um número conferível, e o texto do ramo já resolve a contradição de posição que o
   modo família existe para evitar. Exposto por `p09 + HEAD Speed Tour`.

### Impacto medido (1000 perfis, antes × depois)

| | antes | depois |
|---|---|---|
| 1ª colocada acima do teto do próprio jogador | 119 | **52** |
| destas, sendo a raquete atual | 67 | **0** |
| juvenis (≤14) com 1ª acima do teto | 50 | 47 |
| match médio | 83,35 | 82,62 |

A queda no match médio é esperada e honesta: deixamos de contar a nota alta da própria raquete do
jogador como topo do pódio.

### O que sobrou, e não é defeito de motor

As 52 restantes são TODAS a mesma coisa: **o catálogo não tem quadro mais leve que 280 g** (a 6ª
mais leve, que é o piso do afrouxamento). Para uma criança de 11 anos com teto de 263 g, não existe
o que recomendar. Destas 52, **50 já recebem o aviso de migração juvenil**; as 2 que não recebem são
jovens de 16 anos, cujo teto vem do porte mas que a nota — restrita a menores de 16 — não alcança.

Isso não se resolve no motor. Resolve-se no catálogo, com quadros juvenis de 25–26 polegadas, ou com
um aviso explícito de que a faixa calculada está abaixo do que existe.

---

## 2026-09-07 · `engine 2.30.0` — swingweight e RA MEDIDOS substituem dois proxies

### C-30 — o `swing_index` explicava 12% do que dizia medir ✅ corrigido

**Encontrado por:** um cliente, com o relatório aberto. Ele recebeu a Wilson Clash 100 Pro v3 (305 g)
no lugar da Babolat Pure Drive (300 g) e a nota dizia que a mais pesada "gira com MENOS esforço".
Foi conferir o swingweight publicado das duas e viu o contrário. **Ele estava certo.**

`computeSwingIndex` era `massa × (balanço − 100 mm)²` — um modelo de **massa pontual**. A
decomposição exata do momento de inércia é

    I = M·(balanço − 100)²  +  M·σ²

e o segundo termo, o espalhamento da massa, nunca era calculado. Ele não é um resíduo: numa raquete
real é MAIOR que o primeiro. O índice devolvia o equivalente a 152 kg·cm² onde a medição dá 327.

**Evidência (47 swingweights encordoados medidos, fonte única):**

| | r | R² |
|---|---|---|
| `swing_index` antigo × swingweight real | 0,344 | **0,119** |
| peso estático × swingweight real | 0,844 | **0,713** |

O proxy era **pior que não ter proxy**: o peso puro previa melhor. Ele ordenava **32,7% dos pares
ao contrário** da realidade (353 de 1081), 173 deles com 8+ pontos de diferença. No caso do
cliente: Clash Pro **327** contra Pure Drive **317** — dez pontos mais pesada de girar, e o
relatório afirmava o oposto.

**Correção:** `resolveSwingweight()` devolve a medição quando existe e, quando não, uma regressão
calibrada `SW ≈ −127,2 + 0,816·peso + 0,636·balanço` (R² = 0,816, erro médio 2,9 pontos). A origem
(`'lab'` / `'modelo'`) viaja junto com o valor, e o texto do relatório só cita número quando os dois
quadros são medidos.

Detalhe que vale registrar: a correlação **bruta** entre balanço e swingweight neste catálogo é
NEGATIVA (−0,376), porque quadros pesados são fabricados mais cabeça-leves. Controlando o peso, o
coeficiente vira **+0,636** — a física certa. O modelo de massa pontual engolia a correlação espúria
elevada ao quadrado, e era exatamente por isso que invertia um terço dos pares.

### C-31 — o `stiffness_index` era ruído ✅ corrigido

Mesma medição, segundo proxy. `stiffness_index` era o perfil da viga, usado com peso 0,45 em
`feel_score` e `arm_friendliness_score` e 0,38 em `comfort_score`.

**r(perfil da viga, RA medido) = 0,098 → R² = 0,010.** Um por cento.

O par mais ilustrativo é o mesmo do C-30: viga média de 24,0 mm na Pure Drive contra 24,5 mm na
Clash Pro, ou seja o proxy dizia que a **Pure Drive era mais amiga do braço**. RA medido: **69**
contra **57**. O proxy estava invertido no par mais relevante do catálogo para dor no braço.

**Correção:** conforto, toque e afinidade com o braço passam a usar o RA medido. A viga PERMANECE em
`precision_score` e `launch_angle_score`, onde ela representa geometria (seção do quadro), não
rigidez. Onde o RA falta, o termo sai da conta e `data_completeness` registra — não há reserva,
porque a única candidata era a viga e ela é ruído.

**Armadilha encontrada durante a correção:** trocar só `feel` e `arm_friendliness` e deixar
`comfort_score` na viga **quebrou a monotonicidade do motor na hora** — subir a sensibilidade no
braço passou a devolver um Top 5 com MENOS afinidade de braço (50,3 contra 51,4). O ranking
empurrava por `comfort_score` (viga) enquanto a propriedade media `arm_friendliness_score` (RA), e
as duas grandezas são descorrelacionadas. Os eixos que descrevem como o quadro trata o corpo têm de
sair todos da mesma medida.

### Impacto medido nas recomendações

Varredura de 400 perfis sintéticos semeados, antes × depois:

| | mudou |
|---|---|
| 1ª colocada | **71,5%** (286 de 400) |
| ordem do pódio | 97,5% |
| corda recomendada | 29,8% |

Mudança dessa magnitude é o esperado quando o eixo de maior peso da manobrabilidade passa de um
proxy de R² = 0,119 para a medição.

### Efeito colateral: três pares de "gêmeas idênticas" deixaram de existir

Antes havia **3 grupos** de vetor de atributos idêntico (as duas Babolat de 300 g, as duas Team, e
HEAD Speed MP com Yonex Percept 100). Depois: **zero**. O último par estava a 11 pontos de
swingweight de distância — nunca foram gêmeas, o catálogo é que não enxergava.

O card de "empate técnico" e o desempate por posicionamento de linha continuam corretos e continuam
no código, para qualquer raquete futura que entre sem medição. Os testes que dependiam de o catálogo
produzir gêmeas por acaso passaram a **construir** o empate.

### Consequência fora do produto

O primeiro post da conta (04/09) foi construído sobre este proxy e está errado no sentido oposto —
publicou "r = 0,029, praticamente zero" onde o real é 0,844, e "26 das 47" onde o real é 8. Errata
registrada em `.claude/skills/te-content/pautas/2026-09-04-peso-nao-e-inercia.md`; `fatos.ts` já lê
o campo medido e não reproduz mais o número.

---

## 2026-08-14 · `engine 1.0.0` / `weights.v1` — calibração inicial

### C-01 — `objective_fit` tinha unidades incompatíveis ✅ corrigido

**Encontrado por:** `tests/property/determinism.test.ts` (teste de monotonicidade).

A formulação inicial era `aligned = delta / |desired|`, dividindo **pontos de atributo** por
**pontos de necessidade**. O efeito era perverso: quanto mais forte o pedido do jogador, maior o
denominador e mais fraco o sinal. Medido sobre o catálogo inteiro, o componente ficava comprimido
numa faixa de ~7 pontos (61–68) e praticamente não discriminava — apesar de pesar 0.16 do score.

**Correção:** separar "quanto o frame entregou" (`delivered`, normalizado por `MATERIAL_DELTA = 20`)
de "quão forte foi o pedido" (`askStrength`, usado como peso na média).

**Evidência:** spread do componente passou de ~7 para ~30 pontos no mesmo cenário. Teste de
regressão adicionado (`o objective_fit discrimina de fato`).

---

## Achados abertos — pendentes de dados, não de código

Estes **não** são bugs. São limitações do catálogo que o sistema detecta e reporta sozinho. Todos
se resolvem com verificação de dados, não com alteração de peso — e alterar pesos para "compensar"
seria mascarar a lacuna.

### A-01 — ✅ RESOLVIDO em metodologia 2.0.0 (ver C-02) · O filtro de segurança para o braço está inerte

**Severidade: alta.** É a única regra do motor que existe por razão física, não de desempenho (R-11).

O filtro duro `arm_sensitivity ≥ 70 ∧ stiffness_ra ≥ 68` **nunca dispara**, porque `stiffness_ra` é
`null` em 100% do catálogo semente — RA é medição de laboratório e não é publicada pelo fabricante.

Observado na persona 19 (sensibilidade 85, swing muito rápido): o Top 1 recebe `comfort_fit = 64`
e nenhum frame é excluído por rigidez.

**Mitigação parcial que JÁ funciona:** a camada de cordas protege o jogador de forma independente —
poliéster é excluído por `excludedStringTypes()`, e a persona 19 recebe sintética a 50 lbs em vez de
poliéster a 55. A proteção existe, mas só na metade do setup.

**Resolução:** anexar medições de RA (fonte tier 3) às variantes. Reportado por `npm run dataset:gate`
como lacuna de cobertura `comfort_flexible` (0/3). **Bloqueia lançamento comercial para o público
com histórico de desconforto.**

### A-02 — ✅ RESOLVIDO em metodologia 2.0.0 (ver C-03) · Nenhuma persona atinge confiança "Alta"

Todas as 22 personas terminam em `Média` ou `Baixa`. A causa é única e conhecida:
`data_completeness` médio de 0.61 custa ~23,5 pontos de confiança em **todo** relatório
(`(1 − 0.61) × 60`).

Isso é o comportamento correto e honesto — o sistema está dizendo que não conhece o catálogo tão
bem quanto precisaria. Não deve ser "corrigido" reduzindo o peso da completude; resolve-se
verificando `swingweight`, `stiffness_ra` e `twistweight`.

**Projeção:** com esses três campos verificados, `data_completeness` sobe para ~1.0 e a dedução
desaparece, levando a maioria das personas para `Alta`.

### A-03 — ✅ SUPERADO em metodologia 2.0.0 (ver A-06) · Concentração: Wilson Pro Staff 97 em 27% dos Top 1

Acima do limiar de 25% definido em `ADMIN_SPEC.md` §7. Auditado:

- **Não é bug de peso.** Com `swingweight` e `stiffness_ra` ausentes, os scores derivados dependem
  mais fortemente de cabeça, peso, balanço e padrão. O Pro Staff 97 (97 sq in, 315 g, viga estreita
  de 21,5 mm) ocupa uma posição extrema e pouco disputada nesse espaço reduzido: alto controle e
  precisão, exigência moderada. Ele vence por falta de vizinhos, não por peso mal calibrado.
- **Diversidade geral é saudável:** 14 modelos distintos em 22 personas.

**Ação:** reavaliar após A-01/A-02. Se a concentração persistir com o catálogo verificado, aí sim é
questão de peso — e a entrada de correção vem para este log.

### A-04 — ✅ RESOLVIDO em metodologia 2.0.0 (ver C-04) · Ausência de frames de cabeça grande e leves

O segmento `beginner_oversize_light` (≥ 103 sq in **e** ≤ 285 g) tem 0 itens. Consequência medida na
persona 1: o motor é forçado a escolher entre tolerância (que cresce com a massa) e manobrabilidade
(que cai com ela), e resolve corretamente a favor do `physical_fit` — mas nenhuma das opções é boa.

Fit do Top 1 para iniciantes fracos: 64–66, contra 75–82 para intermediários e avançados. O produto
serve mal esse público hoje, e o número diz isso.

**Ação:** priorizar o cadastro de frames 105–110 sq in com ≤ 285 g na fila de curadoria.

### A-05 — ✅ RESOLVIDO em metodologia 2.0.0 · Penalização P8 uniforme (completude agora é 1.00; a penalização não dispara)

Todas as variantes recebem `−3.7` de `P8_low_data_completeness`, porque todas têm a mesma completude
(0.61). Uma penalização uniforme não altera a ordenação — apenas desloca a escala inteira para baixo.

Comportamento correto: ela **deve** desaparecer conforme os dados forem verificados, e o fit médio
subirá junto. Registrado para que a subida futura dos scores não seja interpretada como mudança de
algoritmo.

---

## 2026-08-14 · `metodologia 2.0.0` — especificações consolidadas de mercado

Refatoração de fundo: o motor deixou de depender de medições de laboratório e passou a usar apenas
especificações que as quatro marcas publicam. Ver 00_RISKS_AND_DECISIONS, RESOLUÇÃO v2.

### C-02 — A-01 resolvido: filtro de braço deixou de ser inerte ✅

O filtro dependia de `stiffness_ra`, `null` no catálogo inteiro — nunca disparava. Reconstruído sobre
o perfil da viga (publicado) como parte de uma proteção multicamada: corda (exclusão dura de
poliéster) → tensão (redução proporcional) → quadro (penalização graduada + exclusão acima de
26,5 mm). Verificado: a persona 21 agora exclui a HEAD Ti.S6 por viga de 28,5 mm, com motivo legível.

**Limitação assumida e documentada:** o perfil da viga é proxy, não medição. A Wilson Clash é o
contraexemplo conhecido (viga larga, quadro flexível) e o modelo a penaliza indevidamente. A camada
forte da proteção é a corda, que não depende do proxy.

### C-03 — A-02 resolvido: confiança "Alta" passou a ser alcançável ✅

Duas mudanças, uma de dados e uma de modelo:

1. **Dados** — com os campos de laboratório fora do modelo, `data_completeness` foi de **0.61 → 1.00**
   nas 46 variantes. Os ~23,5 pontos que todo relatório perdia de saída desapareceram.
2. **Modelo** — a confiança virou **dois eixos combinados pelo menor**: `profile_knowledge` e
   `data_knowledge`. Isso era necessário, não cosmético: com o eixo de dados em 100, a persona 15
   ("todos os não sei", 92% de respostas desconhecidas) subiria para "Média" — o catálogo bem
   cadastrado mascararia o desconhecimento sobre o jogador. Com `min()`, ela permanece corretamente
   em **"Baixa"**.

Resultado na matriz de personas: **19 Alta · 2 Média · 1 Baixa** (antes: 0 Alta). A única "Baixa" é
exatamente a persona que não respondeu nada.

### C-04 — A-04 resolvido: segmento de iniciante cadastrado e desbloqueado ✅

Duas causas independentes, ambas corrigidas:

**(a) Lacuna de catálogo.** O segmento `beginner_oversize_light` tinha 0 itens. Cadastradas 5
variantes com specs conferidas em fonte de varejo especializado: HEAD Ti.S6 (115 sq in / 225 g),
Wilson Clash 108 v3, Wilson Ultra Power 103, Babolat Pure Drive 107 (2021), Yonex EZONE 105 (2025).
Cobertura: **5/3**. Faixas de referência ampliadas para acomodá-las (peso 225–340 g, balanço
290–385 mm, viga 19–29 mm).

**(b) `playstyle_fit` cobrava um estilo inventado.** Um iniciante responde "ainda não tenho um
estilo"; o construtor de perfil traduzia isso num placeholder difuso
(`baseline + all_court + counterpuncher`) e o motor então **cobrava aderência ao placeholder**. Os
frames de iniciante pontuavam ~46 nesse componente e o `fit_score` caía abaixo do piso de pódio — o
produto **se recusava a recomendar qualquer coisa a um iniciante**, com o pódio literalmente vazio.

`PlayerProfile.style_declared` separa "não declarou" de "declarou"; quando é `false`, os 0.14 são
renormalizados para fora. Efeito na persona 1: pódio de **0 → 2** entradas, Top 1 de fit **74 → 79**,
e os cinco primeiros colocados são agora exatamente as cinco variantes de iniciante.

### C-05 — Asserções de persona reescritas para a física da v2

A persona 1 exigia manobrabilidade no percentil ≥ 0.70. A asserção estava errada, não o motor:
`maneuverability_score` é dominado por `swing_index`, e frames de iniciante são leves **mas
fortemente head-heavy** — um frame de 225 g com balanço 380 mm tem inércia de swing **maior** que um
de tour de 315 g com balanço 310 mm. Cobrar manobrabilidade alta reprovaria o segmento correto e
aprovaria frames de jogador avançado.

Substituída por: segmento correto (≥ 103 sq in **e** ≤ 285 g) + tolerância no quartil superior. O
piso de `physical_fit` caiu de 80 para 75, com justificativa: um jogador sedentário de swing lento não
atinge 80 nem com o frame mais leve do catálogo, porque uma raquete adulta tem piso de massa.

### A-06 — 🟠 Nova concentração: Wilson Blade 98 18x20 em 27% dos Top 1

A concentração migrou do Pro Staff 97 (A-03, agora em 0%) para o Blade 98 18×20. Mesma natureza: uma
posição extrema e pouco disputada do espaço de specs — controle e precisão altos, viga fina de 21 mm.
Diversidade geral estável (11 modelos distintos em 22 personas). Reavaliar quando o catálogo tiver
mais frames de padrão denso; hoje há apenas 5.

### A-07 — 🔴 Lacuna aberta: nenhum frame oversize E de viga fina

Consequência direta: a persona 21 (iniciante **com** histórico de desconforto) tem `comfort_fit` = 47
com peso 0.22, teto de fit 68, e **pódio vazio** — o produto se recusa a vender a ela. O
comportamento é correto (§30: proibido criar opções artificiais para vender), mas representa demanda
real não atendida. É lacuna de catálogo, não de motor: ver DATA_SOURCING §10.3.

---

## Protocolo de revisão manual (pré-lançamento, §61)

1. `npm run simulate` — matriz das 22 personas; verificar concentração e diversidade.
2. `npm run simulate -- <persona> --breakdown 3` — auditar componentes e penalizações do Top 3.
3. Revisão do Top 10 de cada persona por um profissional de tênis.
4. Inconsistências viram entradas neste log **antes** de virar alteração de peso.
5. Toda alteração de peso incrementa `RECOMMENDATION_ENGINE_VERSION` e cria uma nova
   `weights.vN` — versões publicadas nunca são editadas.
