# PRODUCT_SPEC.md — Tennis Engineer

**Seu jogo. Seu setup. Sob medida.**

Status: `v1` · Mercado: Brasil · Idioma: pt-BR

---

## 1. O que é o produto

Tennis Engineer é uma **ferramenta de análise de equipamento**. O usuário responde um questionário
estruturado de 3–5 minutos sobre seu físico, técnica, estilo, equipamento atual, conforto e objetivos.
O sistema produz um perfil técnico e cruza esse perfil com um catálogo curado de raquetes e cordas,
retornando um setup recomendado com justificativa auditável.

**O produto comercial é a análise, não o equipamento.** Não vendemos raquetes (§56).

### O que o usuário compra

Não "o nome de uma raquete escondida atrás de um paywall". Ele compra o entendimento de *por que* aquele
equipamento faz sentido para o jogo dele — comparação com o que ele usa hoje, o que vai ganhar, o que vai
perder, e como ajustar. O critério de sucesso do §68: o usuário termina pensando *"agora eu entendo por
que essa raquete e esse setup fazem sentido para o meu jogo"*.

### O que explicitamente NÃO é

| Não é | Por quê |
|---|---|
| Um quiz de 4 perguntas | O perfil tem ~28 dimensões e alimenta um motor determinístico |
| Um chatbot | A IA não escolhe equipamento; ela interpreta texto e escreve explicações |
| Uma loja / site de afiliados | v1 não tem links comerciais |
| Um blog de tênis | Sem produção de conteúdo massiva na v1 (§52) |

---

## 2. Princípio de arquitetura de produto (§4)

Um LLM **não** recebe as respostas e devolve "use a raquete X com corda Y a 52 lbs". A arquitetura é
híbrida e em camadas:

```
Camada 1  DATASET TÉCNICO       raquetes, variantes, gerações, cordas, gauges reais
Camada 2  NORMALIZAÇÃO          specs físicas → scores 0–100 por funções documentadas
Camada 3  PLAYER PROFILE        respostas → objeto técnico com ~28 scores
Camada 4  RECOMMENDATION ENGINE algoritmo determinístico e reproduzível
Camada 5  IA                    interpreta texto livre · escreve explicações · nunca inventa dados
```

**Garantia de reprodutibilidade:** mesmas respostas + mesma `dataset_version` + mesma
`recommendation_engine_version` ⇒ mesmo ranking, sempre. A camada de IA é *aditiva* e não participa do
ranking. Isto é verificado por teste de propriedade.

---

## 3. Fluxo do usuário

```
Landing  →  Questionário (7 etapas)  →  Processamento  →  Análise concluída (teaser)
                                                                    │
                                                              Planos R$19,99 / R$49,99
                                                                    │
                                                            Pagamento (PIX/cartão)
                                                                    │
                                                            Resultado + Pódio
                                                                    │
                                                        Upsell Top 3 (R$9,99) → Comparativo
                                                                    │
                                                              Feedback loop
```

### Tela "Análise concluída" (§27.5)

Antes do pagamento, provamos que houve processamento real — sem revelar o produto:

```
✓ Perfil físico analisado
✓ Nível técnico calibrado          (6 perguntas objetivas)
✓ Swing analisado
✓ Estilo de jogo mapeado
✓ Equipamento atual comparado
✓ Objetivo interpretado

Analisamos 47 raquetes e 31 variantes de corda.
Encontramos 3 raquetes com alta compatibilidade com seu jogo.
Confiança da análise: Alta
```

Os números são **reais** (contagem do catálogo efetivamente avaliado naquela sessão), não decorativos.
Sem cronômetro falso, sem escassez (§58).

---

## 4. Produtos e preços (§25, §26, §30, §34)

| SKU | Nome | Preço | Entitlements concedidos |
|---|---|---|---|
| `racket_report` | Descubra sua raquete ideal | R$ 19,99 | `racket_report_access` |
| `full_setup` | Descubra seu setup completo | R$ 49,99 | `racket_report_access`, `full_setup_access` |
| `top3_unlock` | Desbloquear Top 3 | R$ 9,99 | `top3_access` |

Preços vivem em `products` (banco) — nunca hardcoded (§34). Editáveis pelo admin.

**`racket_report` (R$ 19,99)** — análise completa do jogador, melhor raquete, Fit Score, justificativa,
benefícios, pontos de atenção, análise de transição. **Não inclui** corda, gauge nem tensão.

**`full_setup` (R$ 49,99)** — tudo acima + corda + gauge + tensão + faixa + explicação da combinação
frame/corda/tensão + orientação de ajuste + análise de conforto. Destacado como **ANÁLISE COMPLETA**.

**`top3_unlock` (R$ 9,99)** — libera 2º e 3º colocados com nomes, fotos, scores, justificativas,
trade-offs e comparativo completo.

> Regra ética (§30): as três raquetes do pódio são calculadas pelo mesmo algoritmo e precisam ser
> **três opções reais e boas**. É proibido inserir opções fracas para inflar o upsell. O teste
> `tests/ethics/podium-quality.test.ts` falha se o 3º colocado tiver `fit_score < 75` — nesse caso o
> pódio é reduzido e o upsell **não é oferecido**.

---

## 5. Pódio (§28, §29)

Após a compra do plano base, o resultado mostra um pódio de 3 raquetes:

- **1º lugar**: central, maior, mais alto. Foto, marca, modelo, Fit Score, características. Totalmente visível.
- **2º e 3º**: laterais, foto borrada, nome mascarado, Fit Score visível + uma frase de posicionamento
  ("Alternativa com um pouco mais de controle").

O bloqueio é **de servidor** (§32): sem `top3_access`, a API não envia marca, modelo, foto ou justificativa
dos colocados 2 e 3. Nunca é ocultação por CSS.

---

## 6. Fit Score e Confiança (§23, §24)

São duas dimensões **separadas e nunca combinadas**:

- **Compatibilidade** — `0–100`, saída do motor. Exibida arredondada, com selo de empate técnico quando
  a diferença for < 2 pontos.
- **Confiança da análise** — `Alta / Média / Baixa`. Cai quando: muitos "não sei", nível técnico ambíguo,
  contradições detectadas, raquete atual não reconhecida, dados faltando no catálogo, texto livre pobre.

Um resultado pode ser `94% de compatibilidade · Confiança: Média` — e essa combinação é exibida
honestamente, com a explicação do que reduziria a incerteza ("informe seu swingweight atual").

---

## 7. Tom e comunicação (§55, §62, §65)

Especialista, acessível, confiante, sem arrogância.

| ❌ Nunca | ✅ Sempre |
|---|---|
| "Esta é definitivamente a única raquete certa para você." | "Esta foi a raquete com maior compatibilidade com o perfil informado." |
| "Nossa IA escolheu…" | "A análise Tennis Engineer indicou…" |
| "Cientificamente comprovado" | "Baseado nas especificações do fabricante e no seu perfil" |
| Ocultar incerteza | "Duas opções ficaram tecnicamente empatadas — a escolha aqui é de preferência." |

Externamente falamos em **análise Tennis Engineer**, **motor de recomendação**, **compatibilidade** — não
em "IA" (§65).

---

## 8. Métrica central (§67)

A métrica de qualidade **não** é conversão. É o **Recommendation Satisfaction Score (RSS)**, coletado
após o jogador testar o equipamento:

```
RSS = média ponderada de:
  "Essa recomendação fez sentido?"        (peso 0.3, coletado no resultado)
  "Você testou?"                          (gate)
  "Foi melhor que seu setup anterior?"    (peso 0.5, coletado no follow-up)
  Notas 1–5 de potência/controle/spin/conforto/estabilidade vs. esperado (peso 0.2)
```

Conversão, ticket médio e upsell são métricas de negócio monitoradas (§50), mas o RSS é a métrica de
produto. Se o RSS cair, o algoritmo é recalibrado antes de qualquer otimização de funil.

---

## 9. Escopo v1 vs. futuro (§66)

**Na v1:** raquete + corda + gauge + tensão; 4 marcas de raquete; 7 marcas de corda; pt-BR; PIX + cartão;
admin com simulador; feedback loop (coleta apenas).

**Fora da v1, mas com arquitetura preparada:** customização de peso / lead tape / balanço alvo, grips e
overgrips, tênis, comparador público, histórico de setups, rediagnóstico após meses, ML sobre o feedback,
conteúdo SEO, links comerciais e parceiros. Nenhuma decisão de schema impede estas extensões —
`setup_recommendations` já é polimórfico por `component_type`.

**Não implementar ML prematuramente (§38).** Primeiro coletar dados.
