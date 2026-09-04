# 05/09/2026 · Mesma linha, raquetes diferentes

**Pilar** P6 Interação + P5 Comparação · **Formato** 3 stories · **Arte** Story (fundo ink) ·
**CTA** engajamento · **Status** `gerado`

**Dia sem post no feed.** O primeiro post saiu 04/09; o próximo respeita as 48h. A função destes
stories é dupla: devolver o retorno de quem respondeu a caixa de pergunta, e manter o perfil vivo
num dia em que não há publicação.

**➡️ Projeto único: [`DAHURgkIX8I`](https://www.canva.com/design/DAHURgkIX8I/edit)** — 3 páginas,
1080 × 1920.

---

## As três páginas

| | Arte | Sticker por cima |
|---|---|---|
| 1 | **Quatro raquetes. Zero acordo.** | a resposta de quem participou, se quiser mostrar |
| 2 | **26 raquetes cabem dentro da VCORE.** | nenhum — é a página do dado |
| 3 | **Você sabe qual versão é a sua?** | **Enquete:** Sei exatamente / Sei mais ou menos / Nunca reparei |

### Página 1 — o retorno

> **Quatro raquetes. Zero acordo.**
> Pure Drive, Clash, Speed Pro e VCORE. Vocês mandaram quatro quadros que pedem coisas diferentes
> de quem joga — e nenhum deles é o melhor.
>
> `Vai por partes →`

### Página 2 — o dado

> **26 raquetes cabem dentro da VCORE.**
> Entre a VCORE mais confortável e a menos confortável do nosso catálogo cabem 26 de outras marcas.
> Mesmo nome, pedidos diferentes.
>
> `Por isso perguntei qual →`

### Página 3 — a enquete que alimenta a próxima pauta

> **Você sabe qual versão é a sua?**
> Não a marca, nem a linha — a versão. É ela que decide o que a raquete pede de você.
>
> `Sem vergonha, responde aí ↓`

O "sem vergonha" não é enfeite: a resposta honesta da maioria é *nunca reparei*, e sem a licença
para admitir isso a enquete só coleta quem já sabia — que é justamente o público que não precisa
do post seguinte.

---

## Conferência técnica

Todo número saiu de `fatos.ts dispersaoDaFamilia('vcore')`, contra o catálogo ao vivo.

| Afirmação | Origem | Onde |
|---|---|---|
| 26 raquetes de outras marcas dentro da amplitude de conforto da VCORE (percentil 9 → 58) | `[catálogo]` | página 2 |
| a família tem 3 membros no catálogo | `[catálogo]` | sustenta "mesma linha" |
| as quatro respondidas pedem coisas diferentes | `[catálogo]` | página 1 — caráter, sem número |

**Nenhuma especificação numérica de modelo nomeado.** Peso, balanço e tamanho de cabeça ficam de
fora enquanto `source_url` for nulo (`limites.md` §2). O que se publica é o número do CATÁLOGO —
quantas raquetes cabem num intervalo —, que não é especificação de nenhum modelo.

**Nenhuma versão é chamada de melhor ou pior**, em nenhuma das três páginas.

---

## Uma frase que quase foi publicada e é falsa

Ao descrever a Speed Pro para a página 1, a formulação natural era *"o extremo de controle do nosso
catálogo"*. É falso: ela é alta em controle, e Blade 98 18×20, Pure Strike 18×20 e Gravity Pro
estão acima. O que é verdade sobre ela — e mais interessante — é que **não gera giro por você**: o
spin sai do golpe, não do quadro.

Terceira vez nesta série em que a conferência derruba uma frase que soava certa. O padrão comum às
três: a frase plausível era sempre um SUPERLATIVO ("o extremo", "a mais leve pesa mais"), e o
catálogo quase nunca sustenta superlativo. Caráter sustenta; recorde não.

---

## O que fazer com as respostas

A enquete da página 3 é a matéria-prima do próximo post. Se a maioria responder *nunca reparei*, a
pauta seguinte já está escrita: **por que a versão importa mais que a linha** — P5 Comparação, com
o dado das 26 como espinha dorsal.

Me diga o resultado e eu monto.
