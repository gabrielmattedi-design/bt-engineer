# RECOMMENDATION_ENGINE.md — Tennis Engineer

Status: `v1` · `RECOMMENDATION_ENGINE_VERSION = 1.0.0` · `WEIGHTS_VERSION = weights.v1`

> Este documento é a especificação executável do motor. Toda fórmula aqui tem contraparte 1:1 em
> `src/recommendation/`. Se divergirem, o teste `tests/unit/methodology-parity.test.ts` falha.

---

## 0. Propriedades exigidas

1. **Determinístico.** Nenhuma fonte de aleatoriedade, hora ou I/O. Mesma entrada ⇒ mesma saída.
2. **Auditável.** Toda pontuação produz um `ScoreBreakdown` com cada termo, peso e contribuição (§48).
3. **Honesto sob dados faltantes.** Campo `null` reduz confiança, nunca pontuação (R-02).
4. **Configurável com justificativa.** Todo peso carrega `rationale` obrigatório por tipagem (§21).

---

## 1. Funções base

```
clamp01(x)        = min(1, max(0, x))
norm(x, lo, hi)   = clamp01((x - lo) / (hi - lo))
inv(t)            = 1 - t
score(t)          = t * 100                      // t ∈ [0,1] → 0–100
```

### Faixas de referência (frames adultos de performance)

| Grandeza | lo | hi | Origem da faixa |
|---|---|---|---|
| `head_size_sq_in` | 93 | 115 | menor e maior cabeça entre frames adultos das 4 marcas |
| `unstrung_weight_g` | 255 | 340 | do mais leve "team/lite" ao mais pesado "tour/pro" |
| `balance_mm` (unstrung) | 290 | 345 | 9 pts HL a 4 pts HH |
| `swingweight` | 275 | 345 | faixa prática de frames encordoados |
| `stiffness_ra` | 55 | 75 | flexível clássico a rígido de potência |
| `beam_width_avg_mm` | 19 | 28 | box beam a widebody |
| `twistweight` | 12 | 17 | faixa medida em frames adultos |

Estas faixas são **constantes do domínio** (`domain/reference-ranges.ts`). Alterá-las muda todos os
scores e exige nova `methodology_version`.

### Abertura do padrão de cordas

```
density_raw = 0.60 · norm(mains, 14, 18) + 0.40 · norm(crosses, 16, 20)
openness    = clamp01((1 − density_raw) / 0.80)
```

Mains pesam mais que crosses porque o espaçamento longitudinal domina o movimento do encordoamento (o
mecanismo do snap-back). Valores resultantes: `18×20 → 0.00`, `16×20 → 0.375`, `16×19 → 0.50`,
`16×18 → 0.625`, `14×18 → 1.00`.

---

## 2. Camada 2 — Normalização de raquetes

Todos os scores saem em 0–100. `h=norm(head)`, `w=norm(weight)`, `b=norm(balance)`, `s=norm(sw)`,
`r=norm(ra)`, `m=norm(beam)`, `t=norm(twistweight)`, `o=openness`, `d=1−o`.

```
power_score           = 100·(0.30·h + 0.25·r + 0.20·m + 0.15·o + 0.10·inv(w))
control_score         = 100·(0.28·inv(h) + 0.24·d + 0.18·inv(m) + 0.16·s + 0.14·inv(r))
spin_score            = 100·(0.45·o + 0.20·h + 0.20·s + 0.15·inv(r))
comfort_score         = 100·(0.45·inv(r) + 0.25·w + 0.15·inv(m) + 0.15·o)
stability_score       = 100·(0.35·s + 0.30·w + 0.25·t + 0.10·b)
maneuverability_score = 100·(0.45·inv(s) + 0.30·inv(w) + 0.25·inv(b))
forgiveness_score     = 100·(0.40·h + 0.30·t + 0.15·o + 0.15·w)
precision_score       = 100·(0.30·d + 0.25·inv(h) + 0.20·s + 0.15·inv(r) + 0.10·t)
feel_score            = 100·(0.50·inv(r) + 0.30·w + 0.20·d)
launch_angle_score    = 100·(0.40·o + 0.30·h + 0.20·r + 0.10·m)
arm_friendliness_score= 100·(0.50·inv(r) + 0.30·w + 0.10·inv(m) + 0.10·o)
demand_index          = 100·(0.35·s + 0.25·inv(h) + 0.20·d + 0.20·w)
```

**Justificativa das escolhas dominantes** (o que impede que estes números sejam arbitrários):

- `power_score` mede **potência gratuita** (o quanto o frame devolve sem esforço do jogador), por isso
  cabeça grande, RA alto e perfil largo dominam, e peso entra *invertido*: um frame pesado exige o
  jogador. Plow-through pertence a `stability_score`, não aqui — separar os dois é o que evita a
  confusão clássica "raquete pesada é potente".
- `comfort_score` é dominado por RA (0.45) porque a rigidez do frame é o principal determinante da
  transmissão de choque; massa entra em segundo (0.25) por absorver energia de impacto.
- `spin_score` é dominado por abertura (0.45) pelo mecanismo de snap-back do encordoamento.
- `maneuverability_score` é dominado por swingweight invertido (0.45) porque swingweight — e não peso
  estático — é o que o jogador sente ao acelerar o braço.
- `demand_index` responde "quanto de técnica este frame cobra": massa a acelerar (SW, peso), área de
  erro pequena (cabeça), e padrão denso, que exige velocidade de swing para gerar altura de bola.

### Degradação graciosa (R-02)

Cada score declara os campos exigidos. Se um campo é `null`, seu termo é removido e os pesos restantes
são **renormalizados para somar 1**. A soma dos pesos perdidos é registrada:

```
data_completeness(variant) = 1 − (Σ pesos perdidos em todos os scores) / (Σ pesos totais)
```

Regras duras:
- `data_completeness < 0.55` ⇒ variante **fora do pódio** (pode aparecer na auditoria).
- `head_size`, `unstrung_weight` e `string_pattern` são **obrigatórios**: sem eles a variante não é
  recomendável de forma alguma.
- `strung_weight` ausente usa `unstrung + 16 g` marcado `is_estimated` (derivação declarada, não invenção).
- `swingweight` ausente **não é estimado**. Os termos que dependem dele desaparecem.

### Perfis de adequação (§6)

```
demandTarget = { beginner: 25, intermediate: 45, advanced: 65, competitive: 78 }
levelFit_L   = clamp(100 − |demand_index − demandTarget[L]| · 1.6, 0, 100)

beginner_fit     = 0.45·levelFit_beginner     + 0.30·forgiveness + 0.15·power   + 0.10·maneuverability
intermediate_fit = 0.45·levelFit_intermediate + 0.20·forgiveness + 0.20·spin    + 0.15·control
advanced_fit     = 0.45·levelFit_advanced     + 0.25·control     + 0.20·stability+0.10·precision
competitive_fit  = 0.45·levelFit_competitive  + 0.25·stability   + 0.20·precision+0.10·control
```

```
baseline          = 0.40·control + 0.30·stability + 0.30·spin
aggressive_baseliner = 0.35·stability + 0.25·control + 0.25·spin + 0.15·power
counterpuncher    = 0.35·stability + 0.25·maneuverability + 0.25·control + 0.15·forgiveness
heavy_spin        = 0.55·spin + 0.25·launch_angle + 0.20·stability
flat_hitter       = 0.40·precision + 0.30·control + 0.30·stability
all_court         = 0.30·maneuverability + 0.25·control + 0.25·stability + 0.20·feel
serve_and_volley  = 0.35·maneuverability + 0.30·stability + 0.20·precision + 0.15·feel
net_player        = 0.40·maneuverability + 0.30·stability + 0.30·feel
```

---

## 3. Camada 3 — `PlayerProfile`

### 3.1 Calibração de nível (§12)

A resposta de nível percebido **não é confiada isoladamente**. Seis perguntas objetivas produzem o nível
calibrado:

| Pergunta | `sim` | `às vezes` | `não` |
|---|---|---|---|
| Sustenta trocas de fundo (10+ bolas) | 100 | 55 | 15 |
| Direciona a bola com intenção | 100 | 55 | 15 |
| Gera spin conscientemente | 100 | 55 | 15 |
| Varia profundidade | 100 | 55 | 15 |
| Segundo saque confiável | 100 | 55 | 15 |
| Joga/jogou torneios | 100 | 60 | 20 |

```
objective  = média das 6
experience = 0.5·norm(anos, 0, 5) + 0.3·norm(freq_semanal, 0, 4) + 0.2·(teve_aulas ? 1 : 0.4)
perceived  = {iniciante:15, iniciante_avancado:35, intermediario:55, intermediario_avancado:72, avancado:88}

player_level_score = 0.60·objective + 0.25·(100·experience) + 0.15·perceived
```

Se `|perceived − objective| > 25`, grava-se `contradiction: 'level_mismatch'` e a confiança cai (§24).
O peso de 0.15 no autoavaliado é deliberado: ele carrega informação real, mas viés conhecido em ambas as
direções, e não pode dominar.

### 3.2 Demais scores

```
swing_speed_score      = {lenta:20, moderada:45, rapida:72, muito_rapida:90}
                         ou, se "não sei": 0.6·player_level_score + 0.4·physical_capacity_score
swing_length           = enum {short, medium, long, unknown}
physical_capacity_score= 100·(0.35·forca_percebida + 0.30·condicao_fisica
                              + 0.20·ageFactor(idade) + 0.15·norm(freq,0,4))
   ageFactor: 1.0 até 34 anos; decai linearmente a 0.65 aos 65; 0.8 abaixo de 16
natural_power_score    = 0.45·swing_speed_score + 0.25·swingLengthScore
                         + 0.20·physical_capacity_score + 0.10·player_level_score
technical_consistency_score = 0.55·(comportamento das bolas) + 0.45·player_level_score
arm_sensitivity_score  = 0 (nenhum) | cotovelo 75 | ombro 65 | punho 60 | múltiplos: max + 10 (cap 95)
```

### 3.3 Vetor de necessidades

Base 50 para todos. Ajustes acumulativos, cap [0,100]:

| Origem | Efeito |
|---|---|
| "Sente falta de X" — 1ª prioridade | `X_need += 25` |
| 2ª prioridade | `X_need += 15` |
| 3ª prioridade | `X_need += 8` |
| Objetivo "quero ganhar X" | `X_need += 18` |
| Objetivo "quero equipamento mais fácil" | `forgiveness += 20`, `maneuverability += 12`, `precision −= 8` |
| Objetivo "evoluir para mais exigente" | `control += 15`, `stability += 15`, `precision += 10`, `forgiveness −= 15` |
| Bolas caem curtas | `power += 15` |
| Bolas passam da linha | `control += 18`, `spin += 10` |
| Bolas na rede | `launch/power += 10` |
| Bolas variam demais | `forgiveness += 15`, `stability += 10` |
| Reclamação "falta estabilidade" na raquete atual | `stability += 22` |
| Reclamação "acho pesada"/"difícil acelerar" | `maneuverability += 22` |
| Reclamação "sinto vibração" | `comfort += 20` |
| Reclamação "muito exigente" | `forgiveness += 18` |
| Elogio "gosto do controle/potência/…" | `X_need` **congelado** (não reduzir o que ele já valoriza) |
| `arm_sensitivity_score ≥ 60` | `comfort_need = max(comfort_need, 80)` |
| Objetivo "potencializar meu jogo atual" | nenhum need é elevado; `transition_fit` ganha peso |

### 3.4 `desired_change_vector`

Delta desejado por atributo, em pontos, relativo ao equipamento atual (ou a um frame neutro se não houver):

```
desired_change_vector[attr] = clamp(need[attr] − 50, −40, +40) · directionalGain
```

`directionalGain = 1.0` por padrão; `0.5` quando o jogador declarou "quero potencializar meu jogo atual"
(sinaliza mudança conservadora).

---

## 4. Camada 4 — `racket_fit_score`

```
fit = Σ (w_i · component_i)  −  Σ penalties
```

### 4.1 Componentes

**`physical_fit`** — o jogador consegue manejar a massa?
```
massIndex    = 100·(0.55·norm(strung_weight, 265, 355) + 0.45·norm(swingweight, 275, 345))
capacity     = 0.45·physical_capacity_score + 0.35·swing_speed_score + 0.20·player_level_score
Δ = massIndex − capacity
physical_fit = Δ > 0 ? 100 − Δ·1.35      // pesada demais: penalidade maior (fadiga, atraso, lesão)
                     : 100 − |Δ|·0.75    // leve demais: perde estabilidade, mas é jogável
```
A assimetria é intencional e é uma das decisões técnicas mais relevantes do motor: subir de peso além da
capacidade produz atraso de preparação e sobrecarga; descer de peso produz apenas perda de desempenho.

**`skill_fit`** — o frame cobra o que o jogador tem?
```
targetDemand = 0.85·player_level_score + 8
skill_fit    = 100 − |demand_index − targetDemand| · 1.5
```

**`swing_fit`** — o frame complementa a produção natural de potência?
```
requiredFramePower = 100 − natural_power_score        // gera muita potência ⇒ precisa de frame contido
powerTerm  = 100 − |power_score − requiredFramePower| · 1.15
lengthTerm = swing_length === 'long'   ? 100 − max(0, maneuverability_score − 70)·0.4   // swing longo tolera SW alto
           : swing_length === 'short'  ? 0.7·maneuverability_score + 0.3·power_score
           : 0.5·maneuverability_score + 0.5·powerTerm
swing_fit  = 0.65·powerTerm + 0.35·lengthTerm
```

**`playstyle_fit`** — produto interno entre o vetor de estilo do jogador e os fits de estilo do frame:
```
playstyle_fit = Σ_s (styleWeight_s · racketStyleFit_s) / Σ_s styleWeight_s
```
Estilo "ainda não tenho estilo definido" ⇒ vetor uniforme sobre `baseline`, `all_court`, `counterpuncher`.

**`objective_fit`** — o frame move o jogador na direção desejada:
```
MATERIAL_DELTA = 20   // mudança de atributo que o jogador percebe claramente em quadra
MAX_ASK        = 40   // intensidade máxima de um pedido em desired_change_vector

para cada atributo a com |desired_change_vector[a]| > 5:
    delta_a       = racket[a] − reference[a]        // reference = raquete atual, ou média do catálogo
    delivered_a   = clamp(delta_a · sign(desired[a]) / MATERIAL_DELTA, −1, 1.5)
    askStrength_a = clamp01(|desired[a]| / MAX_ASK)

objective_fit = 100 · clamp01(0.5 + médiaPonderada(delivered_a, peso = askStrength_a) / 2)
```

> **Nota de calibração (v1.0.0).** A formulação inicial era
> `aligned = delta / |desired|`, dividindo pontos de *atributo* por pontos de *necessidade* —
> unidades diferentes. O efeito era perverso: quanto **mais forte** o pedido, maior o denominador e
> **mais fraco** o sinal, comprimindo o componente numa faixa estreita em torno de 65 e tornando-o
> quase não discriminante (verificado empiricamente: spread de 61–68 sobre todo o catálogo).
> A formulação atual separa "quanto foi entregue" (`delivered`, normalizado por uma mudança
> perceptível) de "quão forte foi o pedido" (`askStrength`, usado como peso). Spread medido após a
> correção: 73–86 no mesmo cenário. Os atributos mais pedidos passam a dominar o componente.

**`comfort_fit`**
```
arm_sensitivity < 30 → comfort_fit = 0.5·arm_friendliness_score + 50   // pouco relevante, não zera o score
caso contrário       → comfort_fit = arm_friendliness_score · (0.6 + 0.4·(arm_sensitivity/100))
                                     ajustado para 100 quando arm_friendliness ≥ 80
```

**`transition_fit`** (§22) — só existe se a raquete atual foi reconhecida:
```
Δw = |peso_novo − peso_atual| (g); Δsw = |SW_novo − SW_atual|; Δh = |cabeça_nova − cabeça_atual|
transition_fit = 100 − (max(0, Δw−12)·1.2 + max(0, Δsw−12)·1.0 + max(0, Δh−4)·2.5)
```
Uma mudança pequena não é penalizada (zonas mortas de 12 g / 12 SW / 4 sq in); mudanças grandes só são
penalizadas na parte excedente. Se o objetivo declarado **for** mudar drasticamente, o peso deste
componente cai (ver 4.2).

### 4.2 Pesos (§21 — todos com justificativa)

| Componente | Peso base | Justificativa |
|---|---|---|
| `skill_fit` | **0.20** | Maior peso: entregar um frame acima ou abaixo do nível é o erro mais custoso e mais comum do mercado. |
| `physical_fit` | **0.18** | Massa manejável é pré-requisito físico; erra-se aqui e nada mais importa. |
| `swing_fit` | **0.18** | Determina se a bola entra na quadra; potência do frame deve complementar, não somar. |
| `objective_fit` | **0.16** | O jogador pagou para atingir um objetivo declarado; ignorá-lo é falha de produto. |
| `playstyle_fit` | **0.14** | Relevante, mas estilos são autodeclarados e ruidosos — peso menor que nível/físico. |
| `comfort_fit` | **0.08** | Baixo por padrão porque a maioria não tem sensibilidade; **sobe para 0.20 quando há**. |
| `transition_fit` | **0.06** | Suavizar a troca importa, mas nunca deve impedir a raquete correta. |

**Ajustes dinâmicos** (renormalizados para somar 1 após cada regra):

```
arm_sensitivity ≥ 60           → comfort_fit  = 0.20
raquete atual desconhecida     → transition_fit = 0
objetivo "não sei"             → objective_fit = 0.08
objetivo = "potencializar atual"→ transition_fit = 0.12
level_mismatch detectado       → skill_fit ×0.8 (o dado está sob suspeita)
```

### 4.3 Penalizações (§21)

Subtraídas do score final, em pontos, sempre registradas com motivo legível:

| Código | Condição | Penalidade |
|---|---|---|
| `P1_beginner_demanding_frame` | `level < 35` e `demand_index > 60` | `(demand − 60)·0.8` |
| `P2_slow_swing_low_power` | `swing_speed < 35` e `power_score < 40` | `(40 − power)·0.7` |
| `P3_arm_risk_stiff_frame` | `arm_sensitivity ≥ 60` e `RA ≥ 67` | `(RA − 66)·4.0` |
| `P4_advanced_recreational_frame` | `level ≥ 70` e `unstrung < 270 g` | `(270 − peso)·0.6` |
| `P5_abrupt_weight_change` | `Δpeso > 25 g` | `(Δ − 25)·0.8` |
| `P5b_abrupt_sw_change` | `ΔSW > 25` | `(Δ − 25)·0.7` |
| `P6_objective_conflict` | quer controle e `power_score > atual + 15` (ou simétrico) | `12` |
| `P7_limited_availability` | `brazil_availability_status = 'limited'` | `6` |
| `P8_low_data_completeness` | `data_completeness < 0.70` | `(0.70 − dc)·40` |

### 4.4 Filtros duros (exclusão, não penalização)

Aplicados **antes** da pontuação. Uma variante excluída não aparece no pódio em hipótese alguma:

1. `verification_state ≠ 'verified'` (em modo produção).
2. `brazil_availability_status = 'not_found'`.
3. `status = 'discontinued'` **e** não é a raquete atual do jogador.
4. **Segurança:** `arm_sensitivity ≥ 70` **e** `stiffness_ra ≥ 68` (R-11).
5. Frames não adultos: `length_in < 27` ou `head_size > 118`.
6. Campos obrigatórios ausentes (`head_size`, `unstrung_weight`, `string_pattern`).
7. `data_completeness < 0.55`.

Cada exclusão é registrada em `racket_rankings.excluded_by_filter` — o admin vê **por que** uma raquete
não apareceu, o que é tão importante quanto ver por que outra apareceu.

---

## 5. Pódio e empate técnico

```
ranked = candidatos ordenados por fit desc
podium = top 3, desde que fit ≥ 75 (§ regra ética do PRODUCT_SPEC §4)
tie(a,b) = |fit_a − fit_b| < 2.0  →  UI exibe "empate técnico"
```

Diversidade: se o 2º e o 3º forem variantes da **mesma família** do 1º (ex.: mesma linha em outro peso),
apenas a melhor delas ocupa o pódio e a seguinte é substituída pela próxima família distinta —
**exceto** quando a diferença de peso for exatamente o eixo do objetivo declarado (aí a comparação entre
variantes irmãs é informativa e é mantida, com nota explicativa).

---

## 6. Confiança (§24) — separada da compatibilidade

```
confidence = 100
  − unknown_answer_ratio · 40
  − nº_contradições · 8
  − (raquete atual informada mas não reconhecida ? 10 : 0)
  − (texto livre < 15 caracteres ? 5 : 0)
  − (1 − data_completeness(1º colocado)) · 60
  − (level_mismatch ? 12 : 0)
  − (empate técnico no topo ? 5 : 0)

≥ 75 → Alta   ·   50–74 → Média   ·   < 50 → Baixa
```

Cada dedução gera uma `confidence_reason` legível, exibida ao usuário junto com **o que reduziria a
incerteza** ("informe o swingweight da sua raquete atual"). Não fabricar certeza (§24).

---

## 7. Saída de auditoria (§48)

```ts
type ScoreBreakdown = {
  final_score: number;
  components: Array<{
    key: ComponentKey; raw: number; weight: number; contribution: number;
    terms: Array<{ label: string; value: number | null; weight: number; note?: string }>;
    missing_fields: string[];
  }>;
  penalties: Array<{ code: string; points: number; reason: string }>;
  data_completeness: number;
  gained: string[];   // "ganhou pontos por: swingweight compatível com swing rápido"
  lost: string[];     // "perdeu pontos por: 18×20 conflita com necessidade de spin"
};
```

Persistido em `racket_rankings.breakdown` para **todas** as variantes avaliadas, não só o pódio.
É isso que torna o simulador do admin (§47) capaz de mostrar ranking 1–20 com componentes e
penalizações, e é isso que impede o algoritmo de virar caixa-preta.
