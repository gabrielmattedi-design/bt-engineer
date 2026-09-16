# A dor passou. E a raquete?

**Data:** 16/09/2026 · **Pilar:** P1 · Diagnóstico · **Formato:** 3 stories 9:16 ·
**Arte:** D · Story (`EAHUMDWWwI4`) · **CTA:** engajamento

---

## Por que esta pauta

**A dúvida é real e datada.** Um cliente escreveu por mensagem essa semana perguntando exatamente
isto: ele marcou desconforto no ombro "no último ano", resolveu com fisioterapia, não sentiu mais —
e queria saber o quanto aquilo tinha mexido na recomendação de corda e raquete.

> **Nada do cliente aparece na pauta.** Não é depoimento, não é caso, não tem nome, cidade nem
> laudo. A mensagem dele serviu para escolher o TEMA; o conteúdo todo sai do código do motor, que é
> público para nós e não é dado de ninguém. `limites.md` §4 barra depoimento que não existe, e
> mensagem privada de cliente não vira conteúdo sem permissão.

**P1 estava há dez dias parado** (último: 06/09), é o pilar de maior peso (27%) e é o que para o
scroll, porque a pessoa se reconhece no problema.

---

## A âncora — `build-profile.ts` e `steps.ts`

O questionário **não faz uma pergunta sobre dor, faz cinco**. Marcar uma área abre quatro
perguntas de qualificação, e o comentário no código diz por que:

> *"A primeira pergunta aceita 'sente OU JÁ SENTIU', e quase todo jogador de clube com alguns anos
> de quadra já sentiu alguma coisa em algum lugar. Uma dor leve de três anos atrás, que pode nem ter
> vindo da raquete, passava a governar a recomendação inteira."*

| Pergunta | O que separa |
|---|---|
| `discomfort_areas` | onde |
| `discomfort_status` | está ou esteve |
| `discomfort_when` | há quanto tempo (só para quem já não sente) |
| `discomfort_intensity` | incômodo ≠ afastamento da quadra |
| `discomfort_from_tennis` | **o filtro mais discriminante** — lesão de academia não diz nada sobre a raquete |

Os quatro qualificadores entram como **multiplicadores**, não como soma. Um histórico leve, antigo e
de origem não-tênis chega no motor com uma fração do peso de um problema ativo.

**E o efeito é graduado, não binário** — o que sustenta o story 3:

- o único filtro DURO por braço exige sensibilidade **≥ 70**, e barra apenas quadros de perfil muito
  largo;
- a regra que eliminava todo poliéster acima de 70 **virou peso** (`stiffnessPenalty`), de propósito:
  *"a pessoa responde 'leve, há muito tempo', o motor entende corretamente que o sinal é fraco — e
  mesmo assim dez das dezessete cordas do catálogo somem da análise dela, por causa de um limiar que
  não sabe disso"*;
- o ajuste de tensão é proporcional: `−sensibilidade/100 × 4 lb`, um entre doze ajustes.

---

## Stories — 3 telas, 1080 × 1920

> Faixa **1000–1650** vazia para o sticker.

### Story 1 · O gancho

| Campo | Texto |
|---|---|
| `titulo` | `A dor passou.` |
| `destaque` | `E a raquete?` |
| `apoio` | `Você sentiu o cotovelo há dois anos e não sentiu mais. Isso ainda muda a recomendação?` |
| `rodape` | `Responde aí ↓` |

**Sticker:** enquete — **"Você já sentiu cotovelo ou ombro jogando?"** · `Já` / `Nunca`

> A enquete é o ativo da pauta. "Já" é confissão barata e altamente provável — quase todo jogador de
> clube com alguns anos marcaria —, então ela enche. E o resultado é insumo direto: se vier dominada
> por "já", isso dimensiona quanto do público chega ao questionário com essa marca.

### Story 2 · O mecanismo

| Campo | Texto |
|---|---|
| `titulo` | `Uma pergunta` |
| `destaque` | `virou quatro` |
| `apoio` | `Além de onde doeu: se é atual ou passou, há quanto tempo foi, a intensidade, e se veio do tênis.` |
| `rodape` | `↓` |

**Sticker:** nenhum — de propósito.

> Três telas com sticker em todas cansa, e esta é a tela de informação pura. O rodapé com a seta
> sozinha mantém a sequência andando.

### Story 3 · A virada

| Campo | Texto |
|---|---|
| `titulo` | `Leve e antigo` |
| `destaque` | `não é o mesmo` |
| `apoio` | `Um episódio antigo que nem veio da quadra quase não mexe. Uma dor de hoje muda o equipamento.` |
| `rodape` | `Caixa de pergunta ↓` |

**Sticker:** caixa de pergunta — **"Que pergunta você tem sobre a sua raquete?"**

> **A caixa é sobre EQUIPAMENTO, não sobre dor.** Perguntar "alguma dúvida sobre desconforto?"
> convidaria a conta a responder pergunta de saúde em público, que a §4 proíbe e que nenhum de nós
> tem como responder. A pergunta sobre raquete colhe a mesma quantidade de material e não tem esse
> problema.

---

## Legenda de apoio (se o dono quiser reforçar no story ou em resposta)

> A gente não trata dor de hoje e dor de três anos atrás como a mesma coisa. E nenhuma das duas é
> assunto médico nosso — equipamento é o que a gente mede; se algo dói, quem avalia é profissional
> de saúde.

---

## Conferência técnica

| Afirmação | Etiqueta | Origem |
|---|---|---|
| "o questionário faz quatro perguntas depois de marcar a área" | `[motor]` | `steps.ts` — `discomfort_status`, `_when`, `_intensity`, `_from_tennis` |
| "se é atual ou passou, há quanto tempo, intensidade, origem" | `[motor]` | os quatro campos, nomeados |
| "um episódio antigo que nem veio da quadra quase não mexe" | `[motor]` | multiplicadores de recência, intensidade e origem em `computeArmSensitivity` |
| "uma dor de hoje muda o equipamento" | `[motor]` | `status: 'atual'` → peso integral; filtro duro de quadro em ≥ 70 |

### O que NÃO foi dito, e é deliberado

**Nenhum número interno.** Nem o peso base por área, nem os multiplicadores, nem o limiar de 70. São
calibrações nossas e publicá-las convida a discussão errada — sobre a tabela, não sobre a ideia.

**Nenhuma orientação de saúde.** Nenhuma tela diz o que fazer com dor, nem sugere que trocar de
equipamento resolve dor. `limites.md` §4: desconforto aponta para profissional, nunca para "troque a
raquete".

**Nada do cliente.** Ver o topo do arquivo.

**Nenhuma raquete nem corda nomeada.**

---

## Canva

Arquétipo **D · Story** (`EAHUMDWWwI4`), 1080 × 1920.

**Projeto único, 3 páginas na ordem dos stories:**

> https://www.canva.com/design/DAHVYg6MQB8/edit

| Página | Story | `design_id` de origem |
|---|---|---|
| 1 | A dor passou. / E a raquete? | `DAHVYnwmr38` |
| 2 | Uma pergunta / virou quatro | `DAHVYnWY8Ek` |
| 3 | Leve e antigo / não é o mesmo | `DAHVYpNrspM` |

Forma longa `/design/<id>/edit` — o link curto `canva.com/d/<token>` rotaciona. As páginas do projeto
são cópias: para corrigir copy depois da junção, editar o projeto, não os originais.

---

**Status:** copy fechada e conferida. Não entra em `historico/publicado.jsonl` antes da aprovação
do dono.
