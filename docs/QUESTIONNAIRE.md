# QUESTIONNAIRE.md — Tennis Engineer

Status: `v1` · `QUESTIONNAIRE_VERSION = 1.0.0` · Mobile-first (§10, §43)

---

## 0. Princípios

- **3–5 minutos.** ~34 perguntas, a maioria de toque único, com lógica condicional que pula o irrelevante.
- **Uma pergunta por tela** (no máximo duas quando forem trivialmente relacionadas, como altura+peso).
- **Cards grandes, seleção visual, progress bar.** Sem formulário gigante.
- **"Não sei" é sempre uma opção legítima** e nunca é penalizado como resposta errada — apenas reduz a
  confiança e ativa inferência (§24).
- **Não coletar informação inútil** (§11). Cada campo abaixo alimenta pelo menos um score do
  `PlayerProfile`; a coluna "usa em" prova isso.

Toda resposta é gravada em `questionnaire_answers` (append-only) por Server Action ao avançar de tela,
para que abandono parcial seja recuperável e mensurável (`quiz_step_completed`).

---

## Etapa 1 — Perfil físico (§11)

| Chave | Pergunta | Tipo | Usa em |
|---|---|---|---|
| `age` | Qual sua idade? | número (10–90) | `physical_capacity`, tensão (#11), filtros de segurança |
| `height_cm` | Sua altura | slider 140–210 | `physical_capacity`, alavanca de saque |
| `weight_kg` | Seu peso | slider 35–150 | `physical_capacity` |
| `dominant_hand` | Mão dominante | destro / canhoto | grip, futura análise de padrões |
| `perceived_strength` | Como você descreveria sua força física? | abaixo da média / média / acima da média / bem acima | `physical_capacity` (0.35) |
| `fitness_level` | E seu condicionamento? | sedentário / moderado / bom / atlético | `physical_capacity` (0.30) |

**Envergadura não é coletada.** Não há uso técnico defensável na v1 — coletá-la violaria §11.

---

## Etapa 2 — Experiência (§12)

| Chave | Pergunta | Opções |
|---|---|---|
| `experience_duration` | Há quanto tempo você joga? | <6 meses · 6–12 meses · 1–2 anos · 2–5 anos · +5 anos |
| `frequency_per_week` | Quantas vezes por semana? | 1 · 2 · 3 · 4 · 5+ |
| `has_lessons` | Você faz ou já fez aulas? | nunca · já fiz · faço atualmente |
| `plays_matches` | Joga partidas regularmente? | sim · às vezes · não |
| `tournament_experience` | Participa ou já participou de torneios? | nunca · amadores/internos · regionais · competitivo |
| `perceived_level` | Como você se classificaria? | iniciante · iniciante avançado · intermediário · intermediário avançado · avançado |

### Calibração objetiva — 5 perguntas, tela única de cards

> "Sem julgamento — isso só nos ajuda a calibrar a análise."

| Chave | Pergunta | Opções |
|---|---|---|
| `can_sustain_rally` | Consegue sustentar trocas de fundo de 10+ bolas? | sim · às vezes · não |
| `can_direct_ball` | Consegue direcionar a bola com intenção (cruzado/paralela)? | sim · às vezes · não |
| `can_generate_spin` | Consegue gerar spin conscientemente? | sim · às vezes · não |
| `can_vary_depth` | Consegue variar a profundidade da bola? | sim · às vezes · não |
| `reliable_second_serve` | Tem um segundo saque confiável? | sim · às vezes · não |

Estas cinco + `tournament_experience` formam o nível calibrado (peso 0.60), contra 0.15 do autoavaliado.
Ver `RECOMMENDATION_ENGINE.md` §3.1.

---

## Etapa 3 — Estilo de jogo (§13)

| Chave | Pergunta | Opções |
|---|---|---|
| `play_style` | Qual descrição mais combina com você? *(até 2)* | dominar do fundo · muito topspin · bato mais chapado · atacar cedo · contra-atacar · all court · subir à rede · ainda não tenho estilo definido |
| `forehand_type` | Seu forehand é… | topspin pesado · topspin moderado · mais chapado · não sei |
| `backhand_hands` | Backhand | uma mão · duas mãos |
| `swing_length` | Comprimento do seu swing | curto · médio · longo · não sei |
| `swing_speed` | Velocidade do seu swing | lenta · moderada · rápida · muito rápida · não sei |

Cada tela de swing traz uma micro-ilustração (arco de trajetória) — o usuário médio não sabe responder
"comprimento do swing" sem referência visual, e uma resposta ruim aqui contamina `swing_fit`.

Se `swing_speed = não sei`, o valor é inferido de `player_level_score` e `physical_capacity_score`, e a
inferência é registrada como `inferred: true` (reduz confiança).

---

## Etapa 4 — Comportamento das bolas (§14)

| Chave | Pergunta | Opções |
|---|---|---|
| `depth_control` | Consegue gerar profundidade com facilidade? | sim · às vezes · não |
| `ball_tendency` | Suas bolas costumam… *(até 2)* | cair curtas · passar da linha · ir para a rede · variar demais · geralmente têm boa profundidade |
| `missing_attributes` | Você sente falta de… *(até 3, **ordenadas**)* | potência · controle · spin · estabilidade · conforto · manobrabilidade · precisão |

A ordenação de `missing_attributes` é a entrada mais influente do vetor de necessidades (+25/+15/+8).
Implementada como seleção sequencial numerada — mais confiável em mobile que drag-and-drop.

---

## Etapa 5 — Raquete atual (§15)

| Chave | Pergunta | Tipo |
|---|---|---|
| `current_racket_id` | Qual raquete você usa hoje? | autocomplete sobre `racket_variants` (marca + modelo + geração) |
| `current_racket_free_text` | Não encontrou? Descreva | texto livre (fallback) |
| `current_racket_likes` | O que você **gosta** nela? *(múltipla)* | gosto da potência · gosto do controle · gosto do spin · gosto do peso · gosto da estabilidade · gosto do conforto |
| `current_racket_dislikes` | O que **não gosta**? *(múltipla)* | falta estabilidade · acho pesada · acho leve · dificuldade para acelerar · falta potência · falta controle · sinto vibração · parece muito exigente |
| `no_current_racket` | Ainda não tenho raquete própria | booleano — pula toda a etapa |

O autocomplete busca no **nosso próprio banco**, então a raquete atual entra no motor com specs reais e
habilita `transition_fit` e toda a comparação do §22. Se só houver texto livre, `transition_fit` recebe
peso 0 e a confiança cai 10 pontos — a diferença é comunicada ao usuário.

`current_racket_dislikes` é intencionalmente influente (+22 no need correspondente): é o sinal mais
concreto que o jogador consegue dar sobre o que o equipamento atual não entrega.

---

## Etapa 6 — Corda atual e conforto (§16, §17)

| Chave | Pergunta | Opções |
|---|---|---|
| `current_string_id` | Qual corda você usa? | autocomplete + "não sei" |
| `current_string_gauge` | Espessura, se souber | 1.15–1.35 · não sei |
| `current_tension_lbs` | Tensão atual | número (35–70) · não sei |
| `current_tension_feeling` | O que você acha da tensão atual? | muito solta · um pouco solta · ideal · um pouco dura · muito dura · não sei |
| `string_breakage` | Com que frequência arrebenta cordas? | nunca · raramente · a cada 2–3 meses · mensalmente · semanalmente |
| `discomfort_areas` | Você sente ou já sentiu desconforto recorrente em… *(múltipla)* | cotovelo · ombro · punho · nenhum |

`current_tension_feeling` combinado com `current_tension_lbs` é a **âncora** do motor de tensão (§4.3
do STRING_AND_TENSION_ENGINE) — mais informativo que qualquer fórmula.

> **Aviso exibido na tela de conforto** (§17): *"Não fazemos diagnóstico. Equipamento adequado ajuda,
> mas não substitui avaliação de um profissional de saúde."* — discreto, sem alarmismo, sem linguagem
> clínica.

---

## Etapa 7 — Objetivo e texto livre (§18, §19)

| Chave | Pergunta | Opções |
|---|---|---|
| `objective` | Você quer potencializar seu jogo atual ou mudar alguma característica? *(até 2)* | potencializar meu jogo atual · ganhar potência · ganhar controle · gerar mais spin · atacar mais · mais conforto · mais estabilidade · equipamento mais fácil · evoluir para algo mais exigente · ainda não sei |
| `free_text` | Existe mais alguma coisa sobre seu jogo que você acha importante nos contar? | textarea, opcional, máx. 1200 caracteres |

Placeholder do texto livre (§19):

> "Meu forehand é meu principal golpe e uso bastante spin. Meu backhand de duas mãos costuma ficar curto.
> Atualmente uso uma raquete de 300 g, gosto dela, mas queria um pouco mais de estabilidade sem perder
> manobrabilidade."

### Tratamento do texto livre

Enviado à camada de IA, que retorna `ProfileSignal[]` — nunca um perfil. Regras (R-05):

1. Campo objetivo ausente ou "não sei" → o sinal é aplicado.
2. Campo objetivo presente e concordante → confiança sobe.
3. Campo objetivo presente e divergente → **a resposta objetiva vence**; a divergência é registrada e a
   confiança global cai.
4. Divergência em campo crítico (nível, dor no braço) → tela de confirmação:
   *"Você marcou nível intermediário, mas mencionou que joga torneios estaduais. Qual descreve melhor?"*

Nenhum caminho permite sobrescrita silenciosa.

---

## Lógica condicional

```
no_current_racket = true            → pula Etapa 5 e as perguntas de corda atual
current_string_id = 'não sei'       → pula gauge, mantém tensão e percepção
discomfort_areas = ['nenhum']       → pula follow-ups de conforto
perceived_level = 'iniciante'       → simplifica linguagem da Etapa 3; não pergunta spin consciente
                                       de forma técnica ("você consegue fazer a bola cair rápido?")
backhand_hands = 'uma mão'          → nota interna: peso na cabeça e SW ganham relevância
tournament_experience = 'competitivo' → habilita perguntas finas (SW da raquete atual, personalização)
```

---

## Contribuição para a confiança

```
unknown_answer_ratio = nº de "não sei" / nº de perguntas respondíveis
```

Alimenta diretamente o cálculo de confiança (§24). Perguntas puladas por lógica condicional **não** contam
como desconhecidas — apenas as respondidas com "não sei".

---

## Telemetria (§50)

`quiz_started` · `quiz_step_completed{step, duration_ms}` · `quiz_completed{duration_ms, unknown_ratio}`.
Duração por etapa é o principal indicador de fricção; qualquer etapa com abandono > 15% é reescrita.
