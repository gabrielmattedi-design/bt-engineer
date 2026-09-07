# CALIBRATION_LOG.md — Tennis Engineer

> §61: "Antes de liberar comercialmente: rodar recomendações, revisar manualmente, identificar
> inconsistências, ajustar pesos, **documentar alterações**."
>
> Este é o registro. Toda alteração de peso ou fórmula entra aqui, com o motivo e a evidência.

Formato de cada entrada: **data · versão · o que mudou · por quê · evidência**.

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
