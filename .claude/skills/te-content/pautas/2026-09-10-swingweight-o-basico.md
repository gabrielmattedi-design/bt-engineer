# Swingweight — o que é, por que importa, e a faixa medida

**Data:** 10/09/2026 · **Pilar:** P2 · Física aplicada · **Formato:** 3 Stories 9:16 · **CTA:** engajamento

---

## Por que esta pauta, e por que só agora

Swingweight era **proibido** nesta conta até 07/09/2026. `references/limites.md` §1 travava o assunto
inteiro porque o catálogo não tinha a medida — o campo era um proxy calculado, e falar dele seria
apresentar estimativa nossa como propriedade do quadro.

Em 07/09 as 47 raquetes ganharam **swingweight encordoado medido em laboratório**, com `source_url`
por raquete. `fatos.ts` confirma em tempo real:
`swingweight.pode_publicar_de_modelo_nomeado: true`.

Ou seja: esta é a primeira pauta que só existe porque o catálogo melhorou. É também o conceito que
mais explica por que duas raquetes de peso parecido se comportam de formas opostas na mão — a
pergunta que o jogador faz sem saber o nome dela.

---

## Story 1 — o que é

| Campo | Texto |
|---|---|
| `titulo` | `Swingweight` |
| `destaque` | `o que é isso?` |
| `apoio` | `Não é o peso da balança. É quanto a raquete resiste a girar — o esforço que o braço sente.` |
| `rodape` | `Já tinha ouvido? ↓` |

**Sticker:** enquete — **"Já tinha ouvido falar?"** · `Já` / `Nunca`

**Quando postar:** manhã.

> A enquete mede alfabetização, não opinião. Se a maioria responder "nunca", a próxima pauta do
> pilar não pode pressupor o termo — e essa é uma informação que muda o calendário inteiro.

---

## Story 2 — por que importa

| Campo | Texto |
|---|---|
| `titulo` | `Por que` |
| `destaque` | `ele importa` |
| `apoio` | `Decide se a bola sai pesada e se o braço aguenta o fim do jogo. Os dois puxam para lados opostos.` |
| `rodape` | `O que te falta? ↓` |

**Sticker:** enquete — **"O que te falta hoje?"** · `Bola pesada` / `Braço no fim do jogo`

**Quando postar:** algumas horas depois.

> A segunda frase é o que impede este story de virar propaganda de swingweight alto. Mais inércia é
> mais bola e mais cansaço ao mesmo tempo — dizer só a primeira metade seria vender um lado do
> trade-off, que é exatamente o que `pilares.md` proíbe em P2 e P5.
>
> A enquete não tem resposta certa de propósito. Ela separa a audiência em dois grupos com
> necessidades opostas, e é matéria-prima direta para as pautas seguintes.

---

## Story 3 — a faixa medida

| Campo | Texto |
|---|---|
| `titulo` | `301 a 332` |
| `destaque` | `encordoadas` |
| `apoio` | `A faixa das 47 raquetes do catálogo. E o peso da balança explica só 71% dela.` |
| `rodape` | `Qual a sua? ↓` |

**Sticker:** caixa de pergunta — **"Qual sua raquete? Te digo o swingweight medido dela."**

**Quando postar:** fim da tarde.

> ⚠️ **"Encordoadas" está no destaque, em amarelo, e não numa nota de rodapé.** `limites.md` §1 exige
> dizer a convenção sempre: sem corda o número cai uns 30 pontos, e um leitor que comparasse os
> nossos 301–332 com uma fonte de outra convenção concluiria que erramos. A palavra ocupa a segunda
> linha do título justamente para não ter como ser ignorada.

### Como responder a caixa de pergunta

As 47 estão no catálogo com fonte. Ao responder um modelo nomeado:

- **sempre dizer "encordoada"** junto do número;
- se a raquete não estiver entre as 47, dizer que não temos a medida — nunca estimar.

Material extra para as respostas, de `fatos.ts`:

- **35 das 47 raquetes** têm mais swingweight que alguma raquete pelo menos **5 g mais pesada**;
- com **15 g** de diferença, só **8 das 47** invertem.

Ou seja: peso é bom guia grosso e péssimo guia fino.

---

## Conferência técnica

| Afirmação | Etiqueta | Origem |
|---|---|---|
| "É quanto a raquete resiste a girar" | `[física]` | Definição de momento de inércia |
| "301 a 332" | `[catálogo]` | `fatos.ts` → `swingweight.faixa_kgcm2: [301, 332]` |
| "47 raquetes, medidas" | `[catálogo]` | `swingweight.medidas: 47`, `convencao: "encordoada"` |
| "o peso explica só 71%" | `[catálogo]` | `peso_vs_inercia.explica_pct: 71` (R² de r = 0,844) |
| "35 das 47 … 5 g mais pesada" | `[catálogo]` | `invertidas_por_limiar_g: {5: 35}` |
| "bola pesada × braço no fim do jogo" | `[física]` | Mais inércia no impacto = mais penetração e mais fadiga |

### O erro que quase entrou

O rascunho dizia **"35 pares"**. `invertidas` conta **raquetes**, não pares — a função é
`medidas.filter((m) => medidas.some((o) => o.g >= m.g + limiar && o.si < m.si)).length`.

"35 pares" e "35 das 47 raquetes" soam igualmente plausíveis numa arte e dizem coisas diferentes.
É exatamente o modo de falha que derrubou a primeira pauta desta conta ("26 das 47"), e a defesa é a
mesma: ler o código que produz o número antes de publicá-lo, não só o número.

---

## Canva

| | Design | Editar |
|---|---|---|
| Story 1 | `DAHU1TSwOwU` | https://www.canva.com/design/DAHU1TSwOwU/edit |
| Story 2 | `DAHU1WR5bNI` | https://www.canva.com/design/DAHU1WR5bNI/edit |
| Story 3 | `DAHU1Rjt16g` | https://www.canva.com/design/DAHU1Rjt16g/edit |

Arquétipo **D · Story** (`EAHUMDWWwI4`), 1080×1920. Nos três, o `apoio` coube em 2 linhas e a faixa
1000–1650 ficou livre para o sticker.

---

## O que fazer com as respostas

A enquete do Story 2 divide a audiência entre quem quer **mais bola** e quem quer **menos cansaço** —
os dois lados do mesmo trade-off. Seja qual for o lado maior, ele define a próxima pauta de P2, e
ela já nasce sabendo para quem fala.

---

**Status:** gerado. Aguardando aprovação do dono antes de entrar em `historico/publicado.jsonl`.
