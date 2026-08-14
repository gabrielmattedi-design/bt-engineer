# STRING_AND_TENSION_ENGINE.md — Tennis Engineer

Status: `v1` · `STRING_ENGINE_VERSION = 1.0.0`

---

## 0. Ordem obrigatória de execução (§37 + Regra de Integridade)

```
1. O frame já está escolhido.                       ← a corda nunca é escolhida antes da raquete
2. Derivar o VETOR-ALVO de características da corda a partir de (frame × perfil).
3. Carregar as VARIANTES RECOMENDÁVEIS do banco (marca+modelo+gauge reais e verificadas).
4. Pontuar cada VARIANTE contra o vetor-alvo.
5. Escolher a melhor VARIANTE existente.
6. Calcular a tensão PARA AQUELA VARIANTE específica.
```

> **É proibido** materializar um gauge "ideal" e depois procurá-lo. O motor nunca produz um número de
> espessura — ele apenas **ordena variantes que existem**. Um setup tecnicamente perfeito, mas
> inexistente no mercado, é uma recomendação errada.

Implementação: `selectStringVariant()` recebe `StringVariant[]` já filtrado e retorna um elemento
**daquele array**. Não existe caminho de código capaz de retornar um identificador sintético.

### Filtro de recomendabilidade (aplicado antes de qualquer pontuação)

```sql
verification_state = 'verified'
AND status <> 'discontinued'
AND brazil_availability_status IN ('widely_available','available')   -- 'limited' só via regra 3.3
```

`not_found` e `unknown` **nunca** são recomendáveis (§ Disponibilidade no Brasil).

---

## 1. Vetor-alvo da corda

Derivado do frame escolhido e do perfil. Cada alvo é 0–100.

```
target.control  = clamp(0.45·control_need + 0.35·power_score(frame) + 0.20·player_level_score)
target.power    = clamp(0.50·power_need   + 0.30·(100 − natural_power_score) + 0.20·(100 − power_score(frame)))
target.spin     = clamp(0.55·spin_need    + 0.25·spin_score(frame) + 0.20·swing_speed_score)
target.comfort  = clamp(0.50·comfort_need + 0.30·arm_sensitivity_score + 0.20·(100 − comfort_score(frame)))
target.durability = clamp(0.60·quebra_de_cordas + 0.25·swing_speed_score + 0.15·player_level_score)
target.arm      = clamp(0.60·arm_sensitivity_score + 0.40·(100 − arm_friendliness_score(frame)))
```

Note a compensação cruzada: um frame **rígido** eleva `target.comfort` e `target.arm`; um frame de
**muita potência** eleva `target.control`. A corda corrige o frame, não o duplica.

`quebra_de_cordas`: `{nunca:10, raramente:30, a_cada_2_3_meses:55, mensalmente:80, semanalmente:95}`.

---

## 2. Regras duras de tipo de corda (§37)

> "Não recomendar poliéster automaticamente para todo jogador intermediário. Conforto deve possuir peso real."

Aplicadas como filtro, antes da pontuação:

| Condição | Efeito |
|---|---|
| `arm_sensitivity_score ≥ 70` | **Exclui** `polyester` e `co_polyester` puros. Permitido: multifilamento, gut natural, sintética, ou híbrido com poly nas mains **apenas** se `arm_sensitivity < 80` |
| `arm_sensitivity_score ∈ [50, 70)` | Exclui poly com `stiffness_score > 65`; permite co-poly macia |
| `player_level_score < 40` | **Exclui** poliéster (todos). Um swing que não gera velocidade não ativa a corda e só recebe o choque |
| `player_level_score < 40` e `swing_speed < 35` | Prioriza `multifilament` e `synthetic_gut` |
| `quebra_de_cordas ≥ mensalmente` e `level ≥ 55` | Poliéster favorecido (+12 no score final) |
| `natural_gut` | Só entra se `comfort/arm` alto **e** o usuário não indicou restrição de custo; sempre com nota sobre durabilidade e preço |

Estas regras existem porque a falha mais comum e mais lesiva do mercado brasileiro é vender poliéster
para jogador iniciante/intermediário com swing curto.

---

## 3. Pontuação da variante

```
string_fit = 100 − Σ w_a · |variant[a] − target[a]| / 100 · 100      (distância ponderada)

pesos w_a:  control 0.22 · power 0.16 · spin 0.18 · comfort 0.20 · arm 0.14 · durability 0.10
```

Ajuste dinâmico: se `arm_sensitivity ≥ 60`, `comfort → 0.28` e `arm → 0.22`, renormalizando o restante.

Bônus/penalidades:
- `+12` poly quando o jogador quebra cordas com frequência e tem nível ≥ 55.
- `+6` `tension_maintenance_score ≥ 75` (a corda entrega o setup por mais tempo — valor real para o usuário).
- **`−10`** quando `brazil_availability_status = 'limited'` — e nesse caso a UI exibe obrigatoriamente:
  *"disponibilidade menor no Brasil; confirme antes de encomendar"* (§ Disponibilidade no Brasil).

### 3.1 Efeito do gauge sobre os scores da variante

Os scores base pertencem ao **modelo**; a variante os ajusta pela espessura, com referência em 1.25 mm:

```
δ = (1.25 − gauge_mm) / 0.05          // +1 por 0.05 mm mais fina

power       += 1.5·δ      spin        += 2.0·δ      comfort     += 1.5·δ
control     -= 0.8·δ      durability  -= 4.0·δ      arm_friendly+= 1.2·δ
```

Ex.: a mesma corda em 1.20 (`δ=+1`) ganha 2 pontos de spin e perde 4 de durabilidade em relação a 1.25.
Coeficientes deliberadamente modestos: a espessura é um ajuste fino, não uma mudança de categoria — e
`durability` é o mais sensível porque é o efeito mais consistentemente observado.

### 3.2 Escolha do gauge — **entre os que existem**

O gauge não é calculado: as variantes reais do modelo vencedor já foram pontuadas individualmente no
passo 3, então a melhor variante **já carrega seu gauge**. Se o modelo campeão existir apenas em 1.25 e
o perfil favorecesse 1.30, o motor simplesmente registra:

```
gauge_note: "Este modelo é comercializado em 1.20 e 1.25 mm. Selecionamos 1.25 mm,
             a mais próxima do perfil indicado."
```

E, se a diferença for materialmente relevante, o **modelo alternativo** que existe em 1.30 pode vencer o
ranking por mérito próprio — sem nenhuma regra especial.

### 3.3 Híbridos

Propostos quando há conflito irreconciliável entre `target.durability ≥ 70` e `target.comfort ≥ 70`:
mains de poliéster (durabilidade/spin) + crosses de multifilamento ou gut (conforto). Ambas as pernas
precisam ser **variantes reais e disponíveis** — a regra de integridade vale para cada perna
independentemente.

---

## 4. Motor de tensão (§9)

> A tensão **nunca** é copiada de uma tabela fixa. É calculada, e depois ancorada na experiência real do
> jogador quando essa informação existe.

### 4.1 Base

```
base = (recommended_tension_min + recommended_tension_max) / 2     ← do BANCO, por variante de raquete
```

Se a faixa do fabricante for `null`: `base = 52 lbs`, `confidence -= 10`, e a nota
*"faixa do fabricante não confirmada para este modelo"* entra no relatório. Nunca fingir que sabemos.

### 4.2 Ajustes (lbs) — todos documentados

| # | Fator | Ajuste | Racional |
|---|---|---|---|
| 1 | Tipo de corda | poly/co-poly `−3.0`; multi `+0.5`; sintética `+0.5`; gut `+1.0` | Poliéster tem rigidez dinâmica muito maior; a mesma tensão produz um leito muito mais duro |
| 2 | Gauge | `(1.25 − gauge_mm)·8` → ±0.4 por 0.05 mm | Corda mais fina alonga mais; tensão levemente maior mantém o controle |
| 3 | Abertura do padrão | `(openness − 0.5)·3.0` | Padrão aberto lança mais alto; sobe-se a tensão para conter |
| 4 | Tamanho de cabeça | `(norm(head,93,115) − 0.5)·4.0` | Cabeça maior = leito mais elástico e mais potência |
| 5 | Rigidez do frame | `−norm(RA,55,75)·1.5` | Frame rígido já é duro; alivia-se na corda para preservar o braço |
| 6 | Velocidade de swing | `−(swing_speed − 50)/50·3.0` | Quem gera potência própria pode baixar; quem não gera precisa da corda |
| 7 | Necessidade de potência | `−(power_need − 50)/50·3.0` | — |
| 8 | Necessidade de controle | `+(control_need − 50)/50·3.0` | — |
| 9 | Necessidade de spin | `−(spin_need − 50)/50·1.5` | Tensão menor aumenta o encaixe e o snap-back |
| 10 | Sensibilidade no braço | `−arm_sensitivity/100·4.0` | Fator de conforto com peso real |
| 11 | Idade | `≥ 50: −1.0` · `≤ 16: −1.0` | — |
| 12 | Frequência ≥ 4×/semana | `+0.5` | Perda de tensão acelerada; começar levemente acima prolonga a janela útil |

```
computed = base + Σ ajustes
```

### 4.3 Ancoragem na experiência real (§16)

Se o jogador informou tensão atual **e** sua percepção sobre ela, essa é a evidência mais forte
disponível — mais forte que qualquer fórmula:

```
feedbackΔ = { muito_solta: +3.0, um_pouco_solta: +1.5, ideal: 0, um_pouco_dura: −1.5, muito_dura: −3.0 }
anchored  = tensao_atual + feedbackΔ

α = 0.55   se o tipo de corda permanecer o mesmo
α = 0.35   se o tipo de corda mudar (a referência anterior perde validade)
α = 0      se "não sei" ou tensão atual desconhecida

final = α·anchored + (1 − α)·computed
```

Quando `feedback = ideal` e o tipo de corda não muda, o sistema **respeita a tensão atual** e diz isso
explicitamente. Recomendar mudança sem motivo é ruído, não valor.

### 4.4 Limites

```
1. clamp à faixa do fabricante do frame (se conhecida)
2. clamp aos limites absolutos por tipo de corda:
     poly/co-poly  [40, 58]     multifilamento [45, 64]
     sintética     [45, 62]     gut natural    [48, 66]
3. arredondar para o inteiro mais próximo
4. faixa exibida = [final − 2, final + 2], reclampada
```

Nunca ultrapassar limites tecnicamente aceitáveis para o frame (§9), mesmo que a fórmula peça.
Quando um clamp atua, isso é registrado e explicado no relatório.

### 4.5 Híbridos

```
mains_tension   = final
crosses_tension = final + 2      (quando a cross é mais elástica que a main)
```
Convenção adotada para equalizar a deflexão do leito quando os materiais têm elasticidades diferentes.
É um parâmetro de configuração (`HYBRID_CROSS_OFFSET_LBS`), documentado como convenção — existe
divergência legítima de prática entre encordoadores, e o valor é ajustável sem alterar código.

### 4.6 Saída

```ts
type TensionRecommendation = {
  lbs: number; kg: number;                      // kg = lbs · 0.45359237, 1 casa
  range_lbs: [number, number];
  mains_lbs?: number; crosses_lbs?: number;     // híbridos
  adjustments: Array<{ factor: string; delta_lbs: number; rationale: string }>;
  clamped_by: 'frame_range' | 'string_type_bounds' | null;
  anchored_to_current: boolean; anchor_weight: number;
  guidance: string;
};
```

Orientação padrão gerada (§9):

> "Comece em **50 lbs (22,7 kg)**. Se sentir excesso de potência ou dificuldade para segurar a bola dentro
> da quadra, considere **+2 lbs** no próximo encordoamento. Se sentir pouca profundidade ou conforto
> insuficiente, considere **−2 lbs**. Ajuste um fator por vez — mudanças de 2 lbs são perceptíveis;
> mudanças de 1 lb raramente são."

Nada aqui transmite falsa precisão: entregamos um ponto de partida, uma faixa e um método de ajuste.
