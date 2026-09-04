# Pilares editoriais

Sete pilares. O oitavo que a proposta sugeria — *"O que a gente não sabe"* — foi **recusado pelo
dono** e não entra. O peso dele foi para Diagnóstico e Física.

A regra que amarra tudo: **a página tem que conseguir rodar dois meses sem nomear uma única
raquete.** Nomear modelo é bônus, não motor. Quando uma pauta só funciona se citar um modelo
específico, ela está fraca — não faltam dados.

---

## P1 · Diagnóstico — 27%

O jogador se reconhece num problema que ele já tem. É o que para o scroll, e não depende de nenhum
dado de catálogo.

Formato natural: carrossel ou post único com pergunta grande.

Fonte de pautas: `docs/QUESTIONNAIRE.md` — cada pergunta do questionário existe porque alguém tem
aquele problema. A lista de sintomas está lá pronta.

Exemplos:
- Sua bola morre curta no fim do jogo?
- Seu braço cansa no segundo set?
- Você bate bem, mas erra quando chega atrasado na bola?
- 5 sinais de que sua raquete pode estar exigente demais para você.

**Cuidado:** descrever o sintoma, nunca diagnosticar a pessoa. E desconforto articular sempre
aponta para profissional de saúde, nunca para "troque a raquete".

---

## P2 · Física aplicada — 23%

A engenharia por trás do equipamento, explicada sem jargão. É o pilar que constrói autoridade.

Fonte: `docs/RECOMMENDATION_ENGINE.md`, `docs/STRING_AND_TENSION_ENGINE.md`.

Exemplos:
- Peso na balança ≠ peso na mão.
- O que a espessura da corda realmente muda.
- Por que a mesma raquete serve para um e atrapalha outro.
- 45 lb vs 55 lb: o que se ganha e o que se perde.

**Cuidado:** física geral é `[física]`; regra nossa é `[heurística]` e precisa ser dita como nossa.

---

## P3 · Mito ou verdade — 15%

Série recorrente com arte reconhecível. Derruba crenças comuns de clube.

Exemplos:
- "Raquete pesada dá mais potência."
- "Quanto mais tensão, mais controle."
- "Poliéster é melhor porque profissional usa."
- "Raquete leve é de iniciante."

**Cuidado:** o veredicto raramente é um "mito" limpo. Quase sempre é *"verdade pela metade, e a
metade que falta é a que importa"*. Forçar mito/verdade binário é onde este pilar vira clickbait.

---

## P4 · O caso — 15%

Perfil anônimo e o raciocínio até o setup. **Gerado pelo motor de verdade** via `scripts/caso.ts` —
nunca inventado.

Exemplos:
- 42 anos, joga 2× por semana, bola curta, quer potência. Por que a resposta não foi uma raquete
  mais potente.
- Adolescente de 15 saindo da raquete júnior.
- Dois jogadores do mesmo nível, caminhos opostos.

**Cuidado:** o perfil é sintético e isso pode ser dito. Nunca usar análise real de cliente — é dado
de pessoa identificável, e `caso.ts` produz casos igualmente verdadeiros.

---

## P5 · Comparação — 12%

Duas variantes, e a distinção importa.

**Entre classes** (sem restrição): 98 vs 100 pol², 16×19 vs 18×20, poliéster vs multifilamento,
1,25 vs 1,30 mm. São verdades estruturais que não dependem da especificação de nenhum modelo.

**Entre modelos nomeados** (decisão do dono): só em **partes subjetivas, sem melhor ou pior** —
caráter, intenção de projeto, para que tipo de jogador cada um faz sentido. **Sem número de
especificação** enquanto a proveniência não tiver fonte. Ver `limites.md` §2.

Exemplos:
- 16×19 vs 18×20: o que muda de verdade.
- Pure Drive vs Pure Aero: dois caminhos, não um vencedor.
- Multifilamento vs poliéster: a pergunta certa não é qual é melhor.

**Cuidado:** toda comparação termina em *trade-off*, nunca em vencedor. Se a copy tiver "melhor",
"ganha" ou "mais completa", reescreve.

---

## P6 · Interação — 5%

Enquete e caixa de pergunta, majoritariamente em Stories. Alimenta as pautas seguintes — a resposta
de hoje vira o post de depois de amanhã.

Exemplos:
- Quantas libras você usa?
- Você sabe a espessura da sua corda?
- 98 ou 100?
- Potência, controle ou spin — o que falta no seu jogo?

---

## P7 · Bastidor — 3%

Como o método pensa. Não é "compre", é "veja como decidimos" — conversão por demonstração.

Exemplos:
- As sete dimensões de encaixe, sem jargão.
- Por que perguntamos peso, altura e idade.
- 29.152 setups possíveis — e por que a conta não é 47 × 58.

**Cuidado:** é o único pilar que aceita CTA de conversão, e mesmo assim não em todo post.

---

## Níveis de CTA

Nunca terminar todo post em "acesse o Tennis Engineer".

1. **Engajamento** — comentar, salvar, compartilhar, responder. O padrão.
2. **Curiosidade** — "você sabe se seu setup combina com seu jogo?" Planta a dúvida sem pedir clique.
3. **Conversão** — acessar o Tennis Engineer. **No máximo 1 a cada 8 posts do mês.**

Se a conta do mês passar de 1 em 8, a skill recusa a pauta de produto e propõe outra.

---

## Distribuição semanal (4 posts de feed)

| | |
|---|---|
| 2× | Post único 4:5 — diagnóstico e mito, produção rápida |
| 2× | Carrossel 4:5 — física e caso, é o que gera salvamento |
| 3–4× | Stories, sempre com enquete ou caixa |
| 1× a cada 2 semanas | Reels, só quando houver ideia real — sem cota |

Quatro por semana e não sete: conteúdo técnico bom leva tempo para escrever e conferir, e a
diferença entre 4 e 7 aparece muito mais na agenda de quem produz do que no alcance.
