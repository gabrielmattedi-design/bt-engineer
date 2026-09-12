# A corda morre calada

**Data:** 12/09/2026 · **Pilar:** P1 · Diagnóstico · **Formato:** 3 stories 9:16 ·
**Arte:** D · Story (`EAHUMDWWwI4`) · **CTA:** engajamento

---

## Por que esta pauta

O dono recusou três pautas anteriores com um diagnóstico certo: *"menos técnico, mais viralizável,
curiosidade"*. As três recusadas — a faixa de tensão do fabricante, o braço no fim do jogo, a
espessura da corda — eram boas de engenharia e ruins de Instagram. Todas começavam por um número.

Esta começa por uma culpa. **Quase todo amador só troca a corda quando ela arrebenta**, e descobrir
que esse critério está errado é o tipo de coisa que a pessoa manda para o grupo do tênis.

E não é folclore de clube: o nosso próprio motor já trata a corda como algo que morre.

---

## A âncora, que é o que separa isto de um post genérico

`docs/STRING_AND_TENSION_ENGINE.md`, tabela de ajustes de tensão, linha 12:

| # | Ajuste | Valor | Motivo registrado |
|---|---|---|---|
| 12 | Frequência ≥ 4×/semana | `+0.5` lb | *Perda de tensão acelerada; começar levemente acima prolonga a janela útil* |

Ou seja: **o laudo já compensa a morte da corda antes de ela acontecer.** Quem joga muito recebe
meia libra a mais justamente porque a corda vai cair. Isso é `[motor]`, não opinião — e é o que
autoriza a pauta inteira.

---

## Stories — 3 telas, 1080 × 1920, arquétipo D

> Em todas: a faixa **1000–1650** fica vazia para o sticker nativo. É o ponto do arquétipo.

### Story 1 · O hook

| Campo | Texto |
|---|---|
| `titulo` | `Sua corda` |
| `destaque` | `não avisa` |
| `apoio` | `Ela não arrebenta quando morre. Perde tensão em silêncio, e você joga meses sem saber.` |
| `rodape` | `Responde aí ↓` |

**Sticker:** enquete — **"Quando você trocou a corda pela última vez?"**
`Menos de 6 meses` / `Não lembro`

> Duas opções, e não quatro, por dois motivos. As enquetes anteriores desta conta usaram duas e
> funcionaram; e a graça está em "não lembro" ser uma opção **oferecida**, não uma omissão. Quem
> escolhe já entendeu o post antes do slide 2.
>
> A enquete não tem resposta certa de propósito — ver `limites.md` §2-bis. Quiz marca certo e errado
> na tela de quem responde, e não existe intervalo correto universal de troca de corda.

### Story 2 · Por que você não percebe

| Campo | Texto |
|---|---|
| `titulo` | `Você não` |
| `destaque` | `percebe` |
| `apoio` | `A bola vai saindo mais longa e você corrige sem notar. Aí troca e estranha — era a correção.` |
| `rodape` | `Já sentiu? ↓` |

**Sticker:** enquete — **"Já estranhou uma corda nova?"** · `Já` / `Nunca reparei`

> Este é o slide que faz a pauta valer. A ideia contra-intuitiva não é "a corda morre" — é que **o
> jogador se adapta à corda morta e depois estranha a corda boa.** Quem já passou por isso e nunca
> tinha nomeado o fenômeno é exatamente quem compartilha.
>
> A enquete aqui é de RECONHECIMENTO, não de opinião: ela pergunta se a pessoa já viveu aquilo. O
> "já" é uma confissão barata de dar, e por isso a taxa de resposta tende a ser alta.

### Story 3 · Qual corda cai mais rápido

| Campo | Texto |
|---|---|
| `titulo` | `Poliéster` |
| `destaque` | `cai antes` |
| `apoio` | `É o tipo que domina o catálogo — 20 dos 30 modelos — e o que perde tensão mais rápido.` |
| `rodape` | `Caixa de pergunta ↓` |

**Sticker:** caixa de pergunta — **"Que corda você usa? Te digo o que esperar dela."**

> A caixa é o insumo da próxima pauta e o único ponto que exige trabalho do dono depois de postar.

#### Como responder a caixa, sem escorregar

- **Pode:** falar do TIPO — poliéster perde tensão mais rápido, multifilamento segura mais tempo,
  natural gut é o extremo oposto em toque e o mais sensível à umidade.
- **Não pode:** dizer há quantas horas de jogo "vence" uma corda nomeada. Não temos essa medição, e
  `limites.md` §5 é explícito: número que `fatos.ts` não devolve não sai.
- **Não pode:** dizer que a corda dela "está errada". §3 — descrever o comportamento, nunca
  diagnosticar a pessoa.

---

## Conferência técnica

| Afirmação | Etiqueta | Onde |
|---|---|---|
| "a corda perde tensão sem arrebentar" | `[física]` | Story 1 |
| "o laudo soma +0,5 lb para quem joga 4×/semana por causa disso" | `[motor]` | âncora desta pauta, `STRING_AND_TENSION_ENGINE.md` §12 |
| "o jogador corrige o swing sem notar" | `[física]` | Story 2 — comportamento, não promessa |
| "20 dos 30 modelos do catálogo são poliéster" | `[catálogo]` | Story 3 · `fatos.ts` → `tipos_de_corda.co_polyester` |
| "poliéster perde tensão mais rápido que multifilamento" | `[física]` | Story 3 — comportamento de material, sem número |

**Nenhuma raquete nomeada.** Nenhuma especificação travada pela §2 é tocada.

**Nenhum intervalo de troca recomendado.** A tentação era enorme: a regra de clube diz "troque
tantas vezes por ano quantas você joga por semana". Ela circula muito e **não tem origem que a gente
possa citar** — seria `[opinião]` escrita como fato, que a §6 barra. O post levanta a pergunta e não
finge ter o número.

### O que NÃO foi dito, e é deliberado

Não há CTA de produto. Um post que termina em "faça sua análise" logo depois de convencer alguém de
que a corda dele está morta transforma um diagnóstico honesto numa isca — e a página perde
exatamente a autoridade que a pauta acabou de construir.

---

## Canva

✅ **Arte pronta.** Arquétipo **D · Story** (`EAHUMDWWwI4`), 1080 × 1920, os três comitados.

### O projeto para publicar

**`DAHVAtBJJQ0`** — `canva.com/design/DAHVAtBJJQ0/edit` — *TE · Stories 12/09 · A corda morre
calada*, 3 páginas na ordem 1 → 3.

É daqui que se baixa e se posta. Ordem conferida lendo o projeto de volta depois da junção, e não
assumida da sequência das chamadas.

### As páginas de origem

| Story | `design_id` | Abrir |
|---|---|---|
| 1 · A corda não avisa | `DAHVAiYIYXk` | `canva.com/design/DAHVAiYIYXk/edit` |
| 2 · Você não percebe | `DAHVArtNim8` | `canva.com/design/DAHVArtNim8/edit` |
| 3 · Poliéster cai antes | `DAHVApToDes` | `canva.com/design/DAHVApToDes/edit` |

Nos três o `apoio` coube em **2 linhas** e a faixa **1000–1650** ficou livre para o sticker —
conferido no thumbnail de cada um antes do commit, não assumido.

Ids dos campos, prefixo de página `PB217X2Lkn1WJxbg`:

| Campo | `locator_id` |
|---|---|
| `titulo` | `PB217X2Lkn1WJxbg-LBQSc0v6WnMJgCfM` |
| `destaque` | `PB217X2Lkn1WJxbg-LBZs6t5v57hntdd9` |
| `apoio` | `PB217X2Lkn1WJxbg-LBYcJhfXGDMZ0KM7` |
| `rodape` | `PB217X2Lkn1WJxbg-LBMzL3mdm3W7NkSj` |

> **Link longo, e não `canva.com/d/<token>`.** O curto rotaciona: o token muda e a URL guardada aqui
> apontaria para lugar nenhum em algumas semanas.

> **Os PNGs não estão baixados.** O proxy desta sessão nega `export-download.canva.com` (403 no
> CONNECT). O `export-design` funciona e devolve as URLs; o que falha é buscá-las daqui. O download
> sai do Canva, pelos links acima.

---

## 📌 Na folha — pauta guardada a pedido do dono (12/09)

**"O pior lugar para guardar a raquete é onde quase todo mundo guarda"** — o porta-malas do carro.

- **Pilar:** P1 · **Formato:** stories · **CTA:** engajamento
- **Enquete:** *"Você deixa a raquete no carro?"* · `Sim` / `Nunca`
- **Por que espalha:** culpa reconhecível na hora, zero jargão, e é o formato "marca o amigo" mais
  natural que existe.
- **O risco já identificado:** é raso. Rende um story ótimo e um arco fraco — precisa de um segundo
  beat com substância, que ainda não existe.
- **O que precisa ser conferido antes de escrever:** o efeito do calor na corda e no grip é
  `[física]` genérica. **Não temos medição própria disso.** Qualquer número — quantos graus, quantas
  libras perdidas — seria inventado. A pauta só pode ir em linguagem qualitativa.

~~O dono pediu para puxar esta quando ele pedir de novo.~~

✅ **Puxada e produzida em 12/09** → `pautas/2026-09-13-raquete-no-carro.md`. O "risco já
identificado" acima foi resolvido lá: o segundo beat que faltava saiu justamente desta pauta —
o porta-malas é o acelerador da morte silenciosa que os stories de hoje descrevem.

---

**Status:** copy fechada e conferida, arte pronta. Não entra em `historico/publicado.jsonl` antes
da aprovação do dono.
