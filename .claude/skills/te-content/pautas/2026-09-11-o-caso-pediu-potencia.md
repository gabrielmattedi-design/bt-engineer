# Ele pediu uma raquete mais potente

**Data:** 11/09/2026 · **Pilar:** P4 · O caso · **Formato:** carrossel 6 páginas 4:5 ·
**Arte:** A · Ficha técnica (`EAHUMHdg-_0`) · **CTA:** curiosidade

---

## Por que esta pauta

P4 é 15% do calendário e **nunca tinha sido usado** — é o pilar que mostra o método funcionando em
vez de falar sobre ele.

E ele encaixa no que já está no ar hoje: os três stories de swingweight terminaram com uma enquete
que parte a audiência entre quem quer **mais bola** e quem quer **menos cansaço**. Este caso é
exatamente a primeira metade, respondida pelo motor.

---

## O caso, rodado no motor de verdade

```bash
npx tsx .claude/skills/te-content/scripts/caso.ts '{"age":44,"height_cm":176,"weight_kg":82,...}'
```

**Perfil sintético** — 44 anos, 176 cm, 82 kg, intermediário, preparo moderado, swing moderada,
2× por semana, joga do fundo. Bola sai curta. Marcou "falta potência". Usa poliéster a **54 lb** e
descreve a corda como "um pouco dura".

**O que o motor devolveu:**

| | |
|---|---|
| Teto de peso | 315 g |
| Capacidade de manejo | 62,57 |
| Pódio | Babolat Pure Aero (2026) · Wilson Shift 99 v1 · Yonex Percept 100 (2023) |
| Corda | Yonex Poly Tour Fire 1,20 mm (co-poliéster) |
| **Tensão** | **48 lb**, faixa 46–50 |

### A decisão editorial: o pódio NÃO vai para a arte

O motor devolveu três raquetes com nota, e nenhuma delas aparece no carrossel. Dois motivos:

1. **`limites.md` §2.** Publicar "Pure Aero — 92,7" apresenta o nosso índice como se fosse
   propriedade do quadro. O que a regra libera é leitura qualitativa, dita como nossa e sem número.
   Manter o pódio fora resolve isso sem precisar contornar.
2. **O ponto do post é a tensão.** Nomear o primeiro colocado transformaria um caso de método numa
   indicação de produto, e o leitor levaria embora "compre a Pure Aero" em vez de "confira a sua
   tensão" — que é a única coisa que ele pode fazer ainda esta semana.

---

## Carrossel — 6 páginas, 1080 × 1350, arquétipo A

### 01 · Capa
| Campo | Texto |
|---|---|
| `etiqueta` | `O CASO · PERFIL SINTÉTICO` |
| `titulo` | `Ele pediu uma raquete mais potente` |
| `apoio` | `A resposta do motor começou por outro lugar. O perfil é montado por nós; a análise é a de verdade, no mesmo motor do site.` |
| `rodape` | `01 / 06` |

### 02 · O perfil
| Campo | Texto |
|---|---|
| `etiqueta` | `O PERFIL` |
| `titulo` | `44 anos, joga 2× por semana` |
| `apoio` | `Intermediário, preparo moderado, swing moderada. Joga do fundo. A bola morre curta e ele sente falta de potência.` |
| `rodape` | `02 / 06` |

### 03 · A suspeita
| Campo | Texto |
|---|---|
| `etiqueta` | `O QUE ELE MARCOU` |
| `titulo` | `"Falta potência na minha raquete"` |
| `apoio` | `É a conclusão mais natural do mundo: se a bola não vai, o quadro é fraco. Quase todo mundo chega aqui pelo mesmo caminho.` |
| `rodape` | `03 / 06` |

### 04 · O que o laudo devolve
| Campo | Texto |
|---|---|
| `etiqueta` | `O QUE O LAUDO DEVOLVE` |
| `titulo` | `Raquete, corda, espessura e tensão` |
| `apoio` | `Quatro coisas, não uma. E para o jogo dele, a que muda mais rápido não é o quadro — é o que está enrolado nele.` |
| `rodape` | `04 / 06` |

### 05 · A tensão
| Campo | Texto |
|---|---|
| `etiqueta` | `A TENSÃO` |
| `titulo` | `Ele usa 54. O laudo pede 48.` |
| `apoio` | `Ele mesmo descreve a corda como "um pouco dura". Menos tensão devolve mais energia à bola — e custa um encordoamento, não uma raquete.` |
| `rodape` | `05 / 06` |

### 06 · O trade-off
| Campo | Texto |
|---|---|
| `etiqueta` | `O QUE SE PERDE` |
| `titulo` | `Nada disso é de graça` |
| `apoio` | `Tensão mais baixa dá mais bola e menos precisão. Compensa quando falta profundidade, como no caso dele. Você sabe em quantas libras está a sua?` |
| `rodape` | `06 / 06` |

> O slide 06 existe porque `pilares.md` exige o trade-off em P2 e P5, e P4 herda a mesma
> obrigação: um caso que só mostra o ganho é propaganda com cara de método. E ele carrega o CTA —
> nível **curiosidade**, não conversão.

---

## Legenda

```
Ele não estava errado — estava incompleto.

Quando a bola morre curta, a primeira suspeita é sempre o quadro. Às vezes é mesmo. Mas o que sai do laudo são quatro coisas: raquete, corda, espessura e tensão — e três delas mudam sem trocar de raquete.

Neste caso o motor devolveu um pódio de três quadros E um encordoamento: 48 libras, na faixa de 46 a 50, com um poliéster mais macio que o que ele usa hoje.

A parte que ele pode fazer esta semana custa um encordoamento.

O perfil é sintético, montado por nós para o post. A análise não: é o mesmo motor do site, com as mesmas 47 raquetes e 58 cordas.

Você sabe em quantas libras está a sua?
```

**Hashtags:** `#tenisbrasil` `#raquetedetenis` `#encordoamento` `#tensaodacorda` `#tenisamador`
`#setupdetenis`

---

## Conferência técnica

| Afirmação | Etiqueta | Onde |
|---|---|---|
| "48 libras, faixa 46 a 50" | `[motor]` | slide 05, legenda |
| "Yonex Poly Tour Fire 1,20 mm" | `[motor]` | legenda |
| "o laudo devolve raquete, corda, espessura e tensão" | `[motor]` | slide 04, legenda |
| "menos tensão devolve mais energia à bola" | `[física]` | slide 05 |
| "tensão mais baixa dá mais bola e menos precisão" | `[física]` | slide 06 |
| "47 raquetes e 58 cordas" | `[catálogo]` | legenda · `fatos.ts` |
| "o perfil é sintético" | — | slide 01 e legenda, ditos em voz alta |

**Nenhuma especificação numérica de raquete nomeada.** O pódio ficou fora da arte por decisão
editorial, e com isso a §2 nem chega a ser tocada.

**Nenhuma promessa de resultado.** O slide 05 diz o que a tensão faz com a bola, não o que fará com
o jogo dele — §4 proíbe "vai melhorar seu jogo".

### O que NÃO foi dito, e é deliberado

O motor recomendou trocar de raquete **também**. Escrever "não precisa trocar de raquete" seria
mais vendável e seria falso: o pódio existe e faz parte da resposta. O carrossel diz que a parte
mais rápida e mais barata não é o quadro — o que é verdade e não nega o resto.

---

## Canva

✅ **Arte pronta.** Seis designs a partir de `EAHUMHdg-_0`, um por página, todos comitados,
juntados num projeto único e exportados em PNG 1080 × 1350.

### O projeto para publicar

**`DAHU6k6hkEM`** — `canva.com/design/DAHU6k6hkEM/edit` — *TE · Carrossel 11/09 · O caso que pediu
potência*, 6 páginas na ordem 01 → 06.

É daqui que se baixa e se publica. A ordem foi conferida pelo rodapé de cada página (`01 / 06` …
`06 / 06`) depois da junção, e não pela ordem em que as chamadas foram feitas — `merge-designs`
aceita **uma operação por chamada**, então são seis inserções em sequência e o resultado só é
confiável se for lido de volta.

### As páginas de origem

Seguem existindo, e é nelas que se corrige uma página sem desmontar o projeto.

| Slide | `design_id` | Abrir |
|---|---|---|
| 01 · Capa | `DAHU6c1tCPk` | `canva.com/design/DAHU6c1tCPk/edit` |
| 02 · O perfil | `DAHU6R1Hzjc` | `canva.com/design/DAHU6R1Hzjc/edit` |
| 03 · A suspeita | `DAHU6YqiuSU` | `canva.com/design/DAHU6YqiuSU/edit` |
| 04 · O laudo | `DAHU6UQnizU` | `canva.com/design/DAHU6UQnizU/edit` |
| 05 · A tensão | `DAHU6Vz3ac8` | `canva.com/design/DAHU6Vz3ac8/edit` |
| 06 · O trade-off | `DAHU6fKvSO8` | `canva.com/design/DAHU6fKvSO8/edit` |

> **Por que o link longo e não o `canva.com/d/<token>`.** O link curto ROTACIONA — o token muda e a
> URL guardada aqui apontaria para lugar nenhum daqui a algumas semanas. `design/<DESIGN_ID>/edit`
> é a única forma estável, e é a que um arquivo versionado pode carregar.

**As URLs de exportação não estão registradas aqui de propósito.** São links assinados que expiram
em algumas horas; guardar no repositório produziria um documento que parece completo e não abre. O
`design_id` é o que sobrevive — exportar de novo a partir dele leva um clique.

> **Nota de ambiente.** A sessão que gerou esta arte não consegue BAIXAR os PNGs: o proxy de rede
> nega `export-download.canva.com` (403 no CONNECT). O `export-design` funciona e devolve as URLs
> — o que falha é buscá-las daqui. O download sai do Canva, pelo projeto acima.

---

**Status:** copy fechada, arte pronta e reunida em projeto único. Não entra em
`historico/publicado.jsonl` antes da aprovação do dono.
