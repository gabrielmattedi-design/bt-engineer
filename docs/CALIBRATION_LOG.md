# CALIBRATION_LOG.md — Tennis Engineer

> §61: "Antes de liberar comercialmente: rodar recomendações, revisar manualmente, identificar
> inconsistências, ajustar pesos, **documentar alterações**."
>
> Este é o registro. Toda alteração de peso ou fórmula entra aqui, com o motivo e a evidência.

Formato de cada entrada: **data · versão · o que mudou · por quê · evidência**.

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

### A-01 — 🔴 O filtro de segurança para o braço está inerte

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

### A-02 — 🟠 Nenhuma persona atinge confiança "Alta"

Todas as 22 personas terminam em `Média` ou `Baixa`. A causa é única e conhecida:
`data_completeness` médio de 0.61 custa ~23,5 pontos de confiança em **todo** relatório
(`(1 − 0.61) × 60`).

Isso é o comportamento correto e honesto — o sistema está dizendo que não conhece o catálogo tão
bem quanto precisaria. Não deve ser "corrigido" reduzindo o peso da completude; resolve-se
verificando `swingweight`, `stiffness_ra` e `twistweight`.

**Projeção:** com esses três campos verificados, `data_completeness` sobe para ~1.0 e a dedução
desaparece, levando a maioria das personas para `Alta`.

### A-03 — 🟠 Concentração: Wilson Pro Staff 97 em 27% dos Top 1

Acima do limiar de 25% definido em `ADMIN_SPEC.md` §7. Auditado:

- **Não é bug de peso.** Com `swingweight` e `stiffness_ra` ausentes, os scores derivados dependem
  mais fortemente de cabeça, peso, balanço e padrão. O Pro Staff 97 (97 sq in, 315 g, viga estreita
  de 21,5 mm) ocupa uma posição extrema e pouco disputada nesse espaço reduzido: alto controle e
  precisão, exigência moderada. Ele vence por falta de vizinhos, não por peso mal calibrado.
- **Diversidade geral é saudável:** 14 modelos distintos em 22 personas.

**Ação:** reavaliar após A-01/A-02. Se a concentração persistir com o catálogo verificado, aí sim é
questão de peso — e a entrada de correção vem para este log.

### A-04 — 🟡 Ausência de frames de cabeça grande e leves

O segmento `beginner_oversize_light` (≥ 103 sq in **e** ≤ 285 g) tem 0 itens. Consequência medida na
persona 1: o motor é forçado a escolher entre tolerância (que cresce com a massa) e manobrabilidade
(que cai com ela), e resolve corretamente a favor do `physical_fit` — mas nenhuma das opções é boa.

Fit do Top 1 para iniciantes fracos: 64–66, contra 75–82 para intermediários e avançados. O produto
serve mal esse público hoje, e o número diz isso.

**Ação:** priorizar o cadastro de frames 105–110 sq in com ≤ 285 g na fila de curadoria.

### A-05 — 🟢 Penalização P8 uniforme

Todas as variantes recebem `−3.7` de `P8_low_data_completeness`, porque todas têm a mesma completude
(0.61). Uma penalização uniforme não altera a ordenação — apenas desloca a escala inteira para baixo.

Comportamento correto: ela **deve** desaparecer conforme os dados forem verificados, e o fit médio
subirá junto. Registrado para que a subida futura dos scores não seja interpretada como mudança de
algoritmo.

---

## Protocolo de revisão manual (pré-lançamento, §61)

1. `npm run simulate` — matriz das 22 personas; verificar concentração e diversidade.
2. `npm run simulate -- <persona> --breakdown 3` — auditar componentes e penalizações do Top 3.
3. Revisão do Top 10 de cada persona por um profissional de tênis.
4. Inconsistências viram entradas neste log **antes** de virar alteração de peso.
5. Toda alteração de peso incrementa `RECOMMENDATION_ENGINE_VERSION` e cria uma nova
   `weights.vN` — versões publicadas nunca são editadas.
