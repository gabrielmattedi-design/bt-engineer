# 04/09/2026 · Peso não é inércia de swing

**Pilar** P2 Física aplicada · **Formato** carrossel 6 slides + 3 stories ·
**Arte** Ficha técnica (fundo papel) · **CTA** engajamento · **Status** `gerado`

---

## Carrossel — 6 slides, 1080 × 1350

| | Etiqueta | Título | Apoio | Canva |
|---|---|---|---|---|
| 01 | FÍSICA APLICADA · 01 | **Mais leve nem sempre é mais fácil de girar.** | A balança mede uma coisa. Seu braço sente outra. | [`DAHUMJjnaYs`](https://www.canva.com/d/NbCt8JtCJ-RhHbP) |
| 02 | O QUE A BALANÇA MEDE | **Ela pesa a raquete parada.** | Só que você nunca joga com a raquete parada. O que o seu braço sente é o quanto ela resiste a girar — e isso é outra conta. | [`DAHUMLLD-40`](https://www.canva.com/d/KSnhQRGD3uiO2On) |
| 03 | ONDE ESTÁ A MASSA | **A mesma massa, mais longe da mão, custa muito mais.** | Massa perto do cabo gira fácil. A mesma massa perto da cabeça resiste bem mais — porque a distância até a sua mão conta ao quadrado. | [`DAHUMBOkfu0`](https://www.canva.com/d/UA0mJOZew14YiSX) |
| 04 | NAS 47 QUE ANALISAMOS | **Em 39 delas, uma raquete 10 g mais pesada gira mais fácil.** | Quatro em cada cinco do nosso catálogo. Saber os gramas quase não ajuda a prever o esforço: a relação entre os dois números é praticamente zero. | [`DAHUMCmGCOY`](https://www.canva.com/d/Upv7Y_hsp__Ou-p) |
| 05 | O QUE ISSO MUDA | **"Quero uma mais leve" resolve menos do que parece.** | Trocar 300 g por 285 g pode não aliviar nada, se na nova a massa estiver mais longe da sua mão. | [`DAHUMDO9Y94`](https://www.canva.com/d/sUene6Z2iubUXig) |
| 06 | TESTE DE 5 SEGUNDOS | **Segure pelo cabo e gire o punho.** | A que resistir mais é a que vai cobrar mais de você no terceiro set — não importa o que diz a etiqueta. Você escolheu a sua olhando os gramas? | [`DAHUMEvaYEE`](https://www.canva.com/d/UlXNAVoxZfzYuRC) |

## Legenda

> Todo mundo escolhe raquete pelo número na etiqueta. É o único número que dá pra
> entender sem estudar — e é justamente o que menos prevê o esforço.
>
> Peso é o quanto ela pesa parada. Você nunca joga com a raquete parada. O que o
> seu braço sente é o quanto ela resiste a girar, e isso depende de onde a massa
> está, não só de quanta existe.
>
> Fomos conferir no nosso catálogo: em 39 das 47 raquetes existe alguma 10 g mais
> pesada que gira mais fácil. Quatro em cada cinco.
>
> Antes de trocar por uma "mais leve", faz o teste do último slide.
>
> **Você escolheu a sua olhando os gramas? Conta aí 👇**

## Hashtags

`#tenis #tenisbrasil #raquetedetenis #tenisamador #equipamentodetenis #setupdetenis`

---

## Stories — 3, arquétipo D, 1080 × 1920

| | Quando | Arte | Sticker por cima |
|---|---|---|---|
| 1 | junto com o post | **Você sabe o peso da sua raquete.** · [`DAHUMJQrGd8`](https://www.canva.com/d/ulLJHb2DjOEXNlf) | **Enquete:** o quanto o peso prevê o esforço no 3º set — Quase tudo / Mais ou menos / Quase nada |
| 2 | ~4h depois | **39 das 47 custam mais pra girar** · [`DAHUMFVpq4w`](https://www.canva.com/d/qJGgWHXasX0NCV6) | **Sticker do post** |
| 3 | dia seguinte | **Qual raquete você usa hoje?** · [`DAHUMNSqL_E`](https://www.canva.com/d/AmZyJ3XgWulHQ3e) | **Caixa de pergunta** |

Cada arte deixa a faixa de 1000 a 1650 vazia — é onde o sticker entra. Story sem
sticker não tem motivo para existir.

---

## Conferência técnica

Todo número desta pauta saiu de `scripts/fatos.ts`, contra o catálogo ao vivo.

| Afirmação | Origem | Onde aparece |
|---|---|---|
| 47 raquetes no catálogo | `[catálogo]` | slide 04, story 2 |
| **39** delas têm mais inércia que alguma ≥ **10 g** mais pesada | `[catálogo]` | slide 04, story 2, legenda |
| r(peso, inércia) = 0,029 — "praticamente zero" | `[catálogo]` | slide 04 |
| distância conta ao quadrado | `[física]` | slide 03 |
| a que resiste mais cobra mais no terceiro set | `[heurística]` | slide 06 |

**Duas frases que NÃO entraram, e por quê.** "Duas raquetes de 300 g cansam de
formas completamente diferentes" era a manchete óbvia — e o catálogo não sustenta:
entre as 13 raquetes de 298–302 g a inércia varia só 5%. E o slide 04 diz "a
relação entre os dois números é praticamente zero" em vez de citar `r = 0,029`,
porque coeficiente de correlação num carrossel de Instagram é jargão sem ganho.

Nenhum modelo é citado pelo nome em lugar nenhum: `source_url` é nulo nas 47, e
`limites.md` §2 proíbe especificação numérica de modelo nomeado enquanto for.

---

## Duas correções antes de publicar

**O número estava errado, e da pior forma.** A primeira versão dizia "26 das 47 …
do que outra 10 g mais pesada". As duas metades são verdadeiras separadas e falsas
juntas: 26 é a contagem com **15 g** de diferença; com **10 g** são **39**.

Não foi erro de conta — foi de processo. `fatos.ts` não devolvia este número, então
ele foi medido uma vez num script descartável e daí em diante carregado à mão entre
a arte, a legenda e este arquivo. O limiar se perdeu no caminho e a contagem
continuou. É exatamente o defeito que o cabeçalho de `fatos.ts` existe para evitar,
cometido no único número que o arquivo não cobria.

A contagem agora sai de `fatos.peso_vs_inercia`, **sempre acompanhada do limiar**.
Não dá para citar uma sem o outro.

**O Story 1 mudou de abordagem, por pedido do dono.** Era "Você sabe quanto pesa
sua raquete?" com enquete de sim/não. O risco que ele apontou:

> "alguém mais experiente vai falar: pô, é óbvio que eu já sei o peso da minha
> raquete."

Está certo, e o problema é estrutural: uma enquete que o experiente responde de
primeira não entrega nada a ele, e sinaliza que a página é para iniciante. A versão
nova **concede** que ele sabe — "Você sabe o peso da sua raquete." — e pergunta o
que ninguém sabe de cabeça: o quanto esse número prevê o esforço no terceiro set.

A resposta certa (*quase nada*, r = 0,029) é contraintuitiva o bastante para que a
maioria erre, inclusive quem entende. Errar é o que faz o post seguinte valer.
