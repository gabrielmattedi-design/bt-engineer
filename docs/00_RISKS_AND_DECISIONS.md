# Tennis Engineer — Riscos e Decisões Técnicas

> Documento exigido pelo §69 da especificação: "identifique pontos de risco; proponha melhorias
> apenas quando realmente necessárias; documente escolhas técnicas."
>
> Este é o documento mais importante do projeto. Ele registra **onde a especificação colide com a
> realidade** e qual decisão foi tomada. Nada aqui foi simplificado silenciosamente.

Status: `v1` · Última atualização: 2026-08-14

---

## R-01 — 🔴 CRÍTICO: procedência do dataset técnico

### O risco

A especificação é inequívoca (§7, §62, §69):

> "Nunca inventar valor ausente." · "Se um dado não for conhecido, `null` é melhor do que um número falso."

Ao mesmo tempo, §60 pede 30–50 raquetes e 15–25 cordas cadastradas, e §21 pede um motor que compare
grandezas técnicas entre frames. Existe uma tensão real entre estes requisitos:

- `head_size`, `length`, `unstrung_weight`, `balance`, `string_pattern` e `recommended_tension` são
  **publicados pelo fabricante** e são estáveis entre fontes.
- `swingweight`, `twistweight`, `stiffness_ra` e `strung_weight` **não são publicados pelo fabricante**.
  São medições de laboratório (RDC / Babolat RDC), variam por unidade (±5 SW é normal entre exemplares
  do mesmo modelo) e só existem em fontes de terceiros.
- Um assistente de IA **não é uma fonte citável**. Reproduzir de memória um swingweight de 322 e
  carimbá-lo como dado seria exatamente o "número falso" que a especificação proíbe — e é o tipo de erro
  que destrói a credibilidade do produto, porque é indetectável para o usuário e detectável para um
  profissional.

### A decisão

O sistema implementa **procedência obrigatória por campo**, não por produto. Cada valor numérico é
armazenado como um objeto:

```ts
type Sourced<T> = {
  value: T | null;
  source: SourceTier;        // manufacturer | lab | retailer | review | unverified
  source_url: string | null;
  verified_at: string | null;
  confidence: 'high' | 'medium' | 'low';
  notes?: string;
};
```

Consequências implementadas em código (não apenas documentadas):

1. **O seed inicial carrega apenas campos de catálogo do fabricante** (head size, comprimento, peso não
   encordoado, balanço, padrão de cordas, faixa de tensão recomendada, tamanhos de cabo). Estes campos
   nascem com `source: 'manufacturer'` e `confidence: 'medium'`, e `verified_at: null` — porque a
   verificação humana contra a página oficial **ainda não ocorreu**.
2. **`swingweight`, `twistweight` e `stiffness_ra` não existem no modelo (v2).** Não nascem `null` —
   não têm coluna, não têm campo no tipo `RacketSpecs`, não têm chave no JSON semente. Ver a
   RESOLUÇÃO v2 abaixo.
3. `strung_weight`, `strung_balance` e `swing_index` nunca são inventados: são **derivações
   declaradas** por fórmulas explícitas a partir de campos publicados (`unstrung + 16 g`,
   `balance + 8 mm`, `m·(b−100)²`), documentadas em RECOMMENDATION_ENGINE §1 e nunca exibidas como
   especificação oficial do fabricante. Derivação declarada ≠ dado inventado.
4. Existe uma **trava de release**: `pnpm dataset:gate` falha se qualquer variante marcada
   `status: 'current'` for usada em produção com `verification_state !== 'verified'`. O dataset tem
   estados `draft → pending_verification → verified`. **O produto não pode ser vendido com dataset em
   `draft`.** Isso é um portão de CI, não uma boa intenção.

### RESOLUÇÃO v2 — remover a dependência em vez de administrá-la

A decisão acima era correta mas insuficiente. Ela mantinha o produto **honesto** e ao mesmo tempo
**permanentemente limitado**: com os quatro campos de laboratório em `null` no catálogo inteiro,
`data_completeness` ficava travada em ≈ 0.61, todo relatório perdia ~23,5 pontos de confiança de
saída, e **nenhuma persona conseguia atingir "Alta"** por melhor que respondesse o questionário. Pior:
o filtro de segurança do braço dependia de `stiffness_ra` e portanto **nunca disparava** (achado
A-01 do CALIBRATION_LOG).

A resposta não é preencher os campos. É reconhecer que um motor comercial não pode depender de dados
que o mercado não publica, e reconstruí-lo sobre os que publica:

| Papel na v1 | Substituto v2 | Publicado? |
|---|---|---|
| `swingweight` | `swing_index` = `m_strung · (balanço_strung − 100)²` | derivado de peso + balanço |
| `stiffness_ra` | `stiffness_index`, do perfil da viga | sim, todas as marcas |
| `twistweight` | peso redistribuído para cabeça + massa | sim |
| `strung_weight_g` | `unstrung + 16 g`, derivação declarada | sim |

Resultado medido: `data_completeness` = **100%** nas 46 variantes do catálogo, contra 61% na v1.

**O que se perdeu, dito explicitamente.** `swing_index` não captura a polarização da distribuição de
massa; `stiffness_index` erra em frames flexíveis de viga larga (Wilson Clash). São perdas reais. A
troca é deliberada: um proxy de qualidade conhecida e cobertura de 100% serve melhor a uma
recomendação paga do que uma medição precisa disponível para 0% do catálogo. As duas limitações são
documentadas no código, nos docs e — no caso da rigidez — compensadas por uma proteção multicamada
que não depende do proxy (RECOMMENDATION_ENGINE §4.4).
5. O painel `/admin/verificacao` existe justamente para transformar `pending_verification` em `verified`
   com um humano colando a URL da fonte. O trabalho de curadoria é **parte do produto**, não um detalhe.

### O que isso significa para o cronograma

A engenharia está pronta antes do dataset. Isso é intencional e correto: o dataset é um ativo curado
manualmente, e a especificação já reconhece isso ("prefiro 40–60 raquetes muito bem cadastradas a 300
raquetes com dados ruins"). O sistema entrega hoje: schema, motor, testes, UI e fluxo comercial completos,
com um catálogo em estado `pending_verification` que precisa de uma passada humana antes do lançamento
comercial.

---

## R-02 — 🟠 Campos ausentes quebrariam o motor

### O risco

Se `swingweight` é `null` para metade do catálogo e o `racket_fit_score` depende dele, o ranking fica
enviesado a favor das raquetes que por acaso têm dados completos — um viés invisível e grave.

### A decisão

Cada componente do fit score declara os campos de que precisa. O motor implementa **renormalização de
pesos com penalização de confiança**:

- Se um campo necessário é `null`, o sub-termo é removido e os pesos restantes do componente são
  renormalizados para somar 1 (o produto não recebe nota 0 injustamente).
- A fração de peso perdida é acumulada em `data_completeness` daquela raquete.
- `data_completeness` **não** altera o `fit_score` — altera a `confidence` do relatório e é exibida na
  auditoria. Confundir "não sei" com "ruim" é um erro estatístico clássico; aqui eles são separados.
- Raquetes com `data_completeness < 0.55` são **excluídas do pódio** (podem aparecer na auditoria interna,
  não numa recomendação paga). Recomendar com base em metade dos dados é pior do que não recomendar.

---

## R-03 — 🟠 A IA pode contaminar dados técnicos

### O risco

§4 proíbe a IA de inventar peso, swingweight, rigidez, padrão, tensão ou características. Mas a IA também
precisa **gerar as explicações** (§4.5), e explicações contêm números. Um LLM gerando "esta raquete de 305 g
tem swingweight 325" a partir do contexto é uma violação silenciosa e altamente provável.

### A decisão

Duas camadas:

1. **A IA nunca recebe liberdade sobre números.** O prompt de explicação recebe um `FactSheet` fechado —
   um objeto com exatamente os fatos que a IA pode citar, já formatados como strings (`"305 g"`,
   `"swingweight não medido"`). A instrução é "você pode citar apenas os fatos deste bloco".
2. **Validador pós-geração (`guardFactualClaims`)**: extrai todos os numerais + unidades do texto gerado
   e verifica se cada um aparece no `FactSheet`. Se aparecer um número não autorizado, a explicação é
   rejeitada e o sistema **cai para o gerador determinístico de templates** (`explain/deterministic.ts`),
   que produz texto correto sem IA. O usuário nunca vê um número alucinado; no pior caso vê uma prosa
   menos fluida.

O produto continua funcionando 100% sem chave de API. A IA é um *enhancement*, nunca uma dependência —
o que também está alinhado ao §65 ("a IA é parte da tecnologia, não o produto").

---

## R-04 — 🟠 Falsa precisão nos scores

### O risco

Exibir "94% de compatibilidade" sugere precisão de 1 ponto percentual sobre um modelo que não tem essa
resolução. §23 e §62 alertam explicitamente contra isso.

### A decisão

- O score interno é `float`. O score exibido é **arredondado para inteiro**, e a UI exibe um selo de
  **empate técnico** quando `|score_a − score_b| < 2.0`: "empate técnico — a escolha entre estas duas é
  de preferência pessoal". Isso atende diretamente ao §62 ("quando duas raquetes estiverem praticamente
  empatadas, deixe isso evidente").
- Os índices de característica (CONTROLE 92, SPIN 88) são exibidos em passos de 5 e rotulados como
  **"índices Tennis Engineer (0–100), não especificações do fabricante"** (§64).
- Nenhum score é exibido sem que exista, internamente, o `ScoreBreakdown` completo que o produziu (§48).

---

## R-05 — 🟡 Conflito entre texto livre e respostas objetivas

§19 exige que texto livre nunca sobrescreva respostas objetivas silenciosamente.

**Decisão:** a extração de IA produz `ProfileSignal[]`, nunca um `PlayerProfile`. Cada sinal tem
`field`, `value`, `confidence` e `evidence` (trecho literal do usuário). O merge aplica a regra:

| Situação | Ação |
|---|---|
| Campo objetivo ausente ou "não sei" | Sinal é aplicado |
| Campo objetivo presente, sinal concorda | Confiança sobe |
| Campo objetivo presente, sinal diverge | **Resposta objetiva vence**, divergência registrada em `contradictions[]`, confiança global cai |
| Divergência crítica (nível técnico, dor no braço) | Vira uma tela de confirmação no fim do questionário |

Nenhum caminho permite sobrescrita silenciosa. As contradições vão para o relatório de auditoria.

---

## R-06 — 🟡 Gauges de corda inexistentes

A regra de integridade (bloco final da especificação) proíbe recomendar `marca+modelo+gauge` inexistente.

**Decisão:** modelagem em duas tabelas (`strings` / `string_variants`) onde **a variante é a unidade
recomendável**. O motor de cordas nunca escolhe um gauge — ele **rankeia variantes existentes**. Não há
caminho de código em que um gauge seja calculado e depois procurado: `selectStringVariant()` recebe como
entrada a lista de variantes do banco filtrada por `brazil_availability_status ∈ {widely_available, available}`
e ordena. Um gauge "ideal" que não existe simplesmente nunca é materializado como objeto.

Reforço: um teste (`tests/integrity/string-variants.test.ts`) percorre 500 perfis sintéticos e falha se
qualquer recomendação retornar um `string_variant_id` que não existe no catálogo ou que esteja marcado
`not_found` no Brasil.

---

## R-07 — 🟡 Pagamento e entitlements

§32 é explícito: não confiar em CSS. **Decisão:** a API tem duas camadas de serialização —
`toPublicResult()` e `toEntitledResult()`. O handler HTTP só consegue produzir o payload premium passando
por `assertEntitlement()`. O segundo e terceiro colocados **não existem no JSON** enviado ao cliente sem
`top3_access`; enviamos apenas `{ rank, fit_score, teaser }`. Isto é verificado por teste
(`tests/security/entitlements.test.ts`) que faz snapshot do payload sem entitlement e falha se qualquer
identificador de produto vazar.

Webhook idempotente via chave única `(provider, provider_event_id)` com `ON CONFLICT DO NOTHING`.

---

## R-08 — 🟡 LGPD e sessão anônima

§51 pede resultado sem cadastro. **Decisão:** `anonymous_sessions` com cookie `httpOnly` assinado; dados
pessoais (e-mail, nome, dados de pagamento) vivem em tabelas separadas (`users`, `orders`) das técnicas
(`player_profiles`). O e-mail só é coletado **no checkout** (necessário para entregar o relatório e emitir
recibo) — base legal: execução de contrato. Feedback é armazenado com `consent_to_research` explícito e
opt-in. Existe `deleteSubject(sessionId)` que anonimiza mantendo os agregados estatísticos.

---

## R-09 — 🟢 Pesos arbitrários no motor

§21 proíbe pesos arbitrários. **Decisão:** todos os pesos vivem em `recommendation/config/weights.v1.ts`,
são versionados (`RECOMMENDATION_ENGINE_VERSION`), cada um carrega um campo `rationale: string` obrigatório
por tipagem, e o arquivo é a única fonte de verdade — o simulador do admin permite alterá-los em runtime
para calibração, mas a alteração gera uma nova versão. Todo relatório grava
`recommendation_engine_version` + `dataset_version` (§61).

---

## R-10 — 🟢 Desvios menores da especificação (declarados)

| Especificação | Implementado | Motivo |
|---|---|---|
| Pastas na raiz (`/app`, `/domain`, …) | `src/app`, `src/domain`, … | Convenção do Next.js 15; evita colisão de `/data` com rotas. Estrutura lógica preservada integralmente. |
| shadcn/ui via CLI | Primitivas shadcn escritas à mão em `src/components/ui` | Mesma API e mesmos tokens (Radix + CVA), sem depender de rede/CLI no ambiente de build. |
| Supabase | Postgres + Drizzle, `DATABASE_URL` | Supabase é Postgres; nada no código o impede. Drizzle mantém portabilidade. |
| "Fotos de produto" | Arquitetura + placeholder elegante | §54 já prevê placeholder quando não houver foto confiável. Não há fonte de imagem licenciada disponível. |

---

## R-11 — 🔴 Limite de responsabilidade (saúde)

§17 pede dados de desconforto sem diagnóstico. **Decisão:** vocabulário controlado ("desconforto recorrente
em"), zero linguagem clínica, aviso persistente no relatório de conforto, e uma regra dura: perfis com
`arm_sensitivity_score ≥ 70` **excluem** frames com viga média ≥ 26,5 mm e cordas de poliéster monofilamento
puro em tensão alta — não por penalização suave, mas por filtro. É a única categoria onde uma recomendação
errada pode causar dano físico, então ela é tratada como *hard constraint*.
