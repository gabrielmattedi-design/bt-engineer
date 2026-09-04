# 06/09/2026 · A corda não é acessório

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
| 1 | **A corda não é acessório.** | **Enquete:** Eu escolho / Deixo com o encordoador |
| 2 | **0,15 mm é toda a diferença.** | nenhum — é a página da explicação |

### Página 1 — a importância

> **A corda não é acessório.**
> É ela que ajusta potência, spin, conforto e durabilidade ao mesmo tempo. Pode fazer render a
> raquete que você já tem — ou trabalhar contra ela.
>
> `Responde aí ↓`

### Página 2 — o ajuste fino

> **0,15 mm é toda a diferença.**
> Da corda mais fina à mais grossa do nosso catálogo. Parece nada — e decide spin, conforto e
> quanto tempo ela dura.
>
> `Por isso a pergunta anterior ↑`

**A ordem é importância → detalhe.** A página 1 estabelece que a corda decide muita coisa; a 2
mostra que dentro dessa decisão a margem é de décimos de milímetro. Invertida, a 2 vira minúcia de
técnico antes de alguém ter aceitado que a peça importa.

### Por que a página 1 deixou de ser uma pergunta

A primeira versão perguntava **"Quantas vezes você estoura corda?"**. Funciona como enquete, mas
começa a conversa pelo sintoma de quem já quebra corda — ou seja, por quem já leva o assunto a
sério. Quem trata a corda como acessório, que é o público que esta pauta existe para alcançar,
responde "quase nunca" e segue rolando, confirmado na própria despreocupação.

A versão publicada inverte: afirma primeiro, e só depois pede a resposta. A enquete continua ali,
mas passou a medir a coisa certa — **quem decide a corda**, não quem a arrebenta.

O rodapé da página 2 (`Por isso a pergunta anterior ↑`) continua válido: a página 1 segue tendo uma
pergunta por cima, e "por isso" agora aponta para algo mais forte — *é por isso que importa quem
escolhe*.

---

## Conferência técnica

| Afirmação | Origem | Onde |
|---|---|---|
| a corda ajusta potência, spin, conforto e durabilidade | `[motor]` — os eixos `power`, `spin`, `comfort` e `durability` de `select-string.ts` | página 1 |
| "ao mesmo tempo" — são eixos de UM vetor-alvo, não escolhas separadas | `[motor]` — `computeStringTarget` resolve os oito eixos num alvo só | página 1 |
| a corda pode fazer render ou atrapalhar a raquete | `[motor]` — a compensação cruzada de `select-string.ts` §1 | página 1 |
| a faixa de espessura do catálogo é 1,15 a 1,30 mm — logo 0,15 mm de amplitude | `[catálogo]` via `fatos.ts` | página 2 |
| espessura decide spin, conforto e durabilidade | `[motor]` — eixo `gauge` | página 2 |

A frase mais arriscada da página 1 é **"ou trabalhar contra ela"** — soa a slogan, e a regra da
skill é que slogan não se publica sem medida por trás. Aqui existe: o comentário de
`select-string.ts` descreve a compensação cruzada em que **um frame rígido ELEVA o alvo de conforto
e um frame potente ELEVA o alvo de controle** — "a corda corrige o frame, não o duplica". Uma corda
que duplica o frame em vez de corrigi-lo é literalmente o que o motor evita escolher. A frase
descreve um mecanismo do produto, não uma opinião.

`limites.md` §5 autoriza publicar a faixa que o catálogo cobre: descreve o conjunto, não um modelo
nomeado. **Nenhuma corda e nenhuma raquete é citada pelo nome em nenhuma das duas páginas.**

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

A pergunta de frequência de quebra, que era a página 1 desta pauta, é o gancho natural DAQUELE
post — e lá ela funciona, porque chega depois de alguém já ter aceitado que a corda decide algo.
