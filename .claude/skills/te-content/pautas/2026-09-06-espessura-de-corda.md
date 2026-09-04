# 06/09/2026 · A pergunta de corda que quase ninguém faz

**Pilar** P1 Diagnóstico + P2 Física aplicada · **Formato** 2 stories · **Arte** Story (fundo ink) ·
**CTA** engajamento · **Status** `gerado`

**➡️ Projeto único: [`DAHUR200K04`](https://www.canva.com/design/DAHUR200K04/edit)** — 2 páginas,
1080 × 1920.

**Por que corda, e por que agora.** Os dois primeiros dias falaram de quadro. Corda é o outro eixo
do produto — 30 modelos, 58 variantes — e o assunto que o amador mais decide no escuro, quase sempre
delegando ao encordoador. Abrir esse eixo agora também amplia a conta para além de "raquete", que é
o que impede a página de virar monotema.

---

## As duas páginas

| | Arte | Sticker por cima |
|---|---|---|
| 1 | **Quantas vezes você estoura corda?** | **Enquete:** Toda semana / Todo mês / Quase nunca |
| 2 | **0,15 mm é toda a diferença.** | nenhum — é a página da explicação |

### Página 1 — o sintoma

> **Quantas vezes você estoura corda?**
> Parece detalhe. É uma das perguntas que mais muda a recomendação de corda — e quase ninguém pensa
> nela na hora de comprar.
>
> `Responde aí ↓`

### Página 2 — por que a pergunta importa

> **0,15 mm é toda a diferença.**
> Da corda mais fina à mais grossa do nosso catálogo. Parece nada — e decide spin, conforto e
> quanto tempo ela dura.
>
> `Por isso a pergunta anterior ↑`

A ordem é deliberada: pergunta primeiro, explicação depois. Invertida, a página 2 responde algo que
ninguém perguntou; nesta ordem, quem votou já está investido quando a explicação chega.

---

## Conferência técnica

| Afirmação | Origem | Onde |
|---|---|---|
| a faixa de espessura do catálogo é 1,15 a 1,30 mm — logo 0,15 mm de amplitude | `[catálogo]` via `fatos.ts` | página 2 |
| espessura decide spin, conforto e durabilidade | `[motor]` — eixo `gauge` em `select-string.ts` | página 2 |
| a frequência de quebra muda a recomendação | `[motor]` — alimenta `durability` e `gauge` | página 1 |

`limites.md` §5 autoriza explicitamente **"a faixa de peso / área / espessura que o catálogo
cobre"**: descreve o conjunto, não um modelo nomeado. Nenhuma corda é citada pelo nome.

---

## O que ficou de fora, e por quê

O comentário de `select-string.ts` guarda material melhor do que o publicado — uma reclamação real
de usuário e o defeito que ela expôs:

> "sempre ponho que nunca estouro corda, e sempre me recomendam 1.30 mm"

A investigação mediu que a espessura média ia de **1,206 mm** em "nunca" a **1,242 mm** em
"mensalmente", com **"semanalmente" saindo mais FINO que "mensalmente"** — o eixo de durabilidade
cobrava só a falta, nunca a sobra, então quem não pagava o preço da corda fina também não recebia o
benefício dela. Daí nasceu o eixo `gauge`.

É um P7 Bastidor excelente e **não foi publicado**, por uma razão só: esses milímetros estão num
comentário de código, não em `fatos.ts`. Número que não é remedido no momento de gerar é
exatamente o caminho que produziu o erro do "26 das 47 · 10 g".

**Para publicar, é preciso antes** acrescentar a medição a `fatos.ts` — varrer perfis sintéticos
por frequência de quebra e devolver a espessura média de cada resposta. Aí a pauta existe, e é
forte: *"um usuário reclamou, a gente mediu, e ele estava certo."*
