# Limites — leia ANTES de escrever qualquer copy

Este arquivo existe porque o maior risco desta skill não é o modelo inventar uma raquete. É publicar
como **fato** um dado do próprio projeto que é mais frouxo do que parece.

Auditoria de 03/09/2026, feita contra o catálogo no ar.

---

## 1. O que o projeto NÃO tem

### Swingweight e RA — não existem no catálogo

O motor tem `swing_index`, que é **peso × braço de balanço**. O código repete em quatro arquivos que
isso **NÃO é swingweight**, e `docs/PESQUISA_RA_SWINGWEIGHT.md` está marcado
**"INCOMPLETA E NÃO APLICADA"** — 12 de 46 raquetes pesquisadas, 4 em confiança alta.

- ❌ Nunca dar swingweight ou RA de nenhuma raquete.
- ❌ Nunca sugerir que o Tennis Engineer mede, usa ou considera swingweight.
- ❌ Nunca comparar dois quadros por esses números.
- ✅ **Pode** explicar o conceito de swingweight como física geral, sem número e sem ligar ao produto.

O documento de pesquisa registra por que: fontes misturam medição com e sem corda (diferença de
~30 pontos), e laboratórios discordam entre si em até 5 pontos de RA no mesmo modelo.

### Fotos de raquete — nenhuma verificada

`image_verified` é **0 de 47**. Não usar foto de produto. O sistema visual se sustenta em
tipografia, número e diagrama.

---

## 2. Especificações numéricas de modelo nomeado

**Estado real:** as 47 raquetes têm `verification_state: "verified"`, mas os **470 campos de
especificação** carregam todos `confidence: "medium"`, `source_url: null`, `verified_at: null` e a
nota *"AGUARDANDO verificação humana contra a página oficial"*.

Zero campos têm URL de fonte.

> ❌ **Não publicar peso, balanço, perfil de viga, padrão de cordas ou área de uma raquete
> NOMEADA** enquanto `source_url` for `null` para aquele campo.

Isso não é excesso de zelo. No relatório pago a especificação é *insumo* de uma recomendação, e o
produto já avisa que os índices são internos. No Instagram ela vira *afirmação pública*, sem
contexto — e quem corrige é a marca ou um seguidor que sabe mais, no comentário. O custo é
exatamente a autoridade que a página existe para construir.

**Como saber:** `scripts/fatos.ts` expõe `temFonte(variantId, campo)`. Se devolver `false`, o número
não sai. Quando os campos ganharem `source_url`, isso destrava sozinho — a skill lê a proveniência
em tempo real, não uma cópia.

### O que PODE ser dito sobre modelos nomeados

Decisão do dono: *"comparações entre modelos em partes subjetivas, sem melhor ou pior"*.

| | |
|---|---|
| ✅ | **Caráter e intenção de projeto.** "A Pure Aero é desenhada em torno da rotação; a Pure Drive, em torno de mandar a bola ao fundo com menos esforço." |
| ✅ | **Posicionamento declarado pelo próprio fabricante.** É fala pública dele, não medição nossa. |
| ✅ | **Para que tipo de jogador cada uma faz sentido** — que é a pergunta que interessa. |
| ✅ | **Leitura qualitativa do nosso índice**, desde que dita como nossa: "no nosso índice ela pesa mais para o lado do controle". Sem número. |
| ❌ | Qualquer número de especificação (ver acima). |
| ❌ | "Melhor", "pior", "ganha", "perde", "a mais completa", ranking entre marcas. |
| ❌ | Índice nosso apresentado como propriedade objetiva do quadro. |

**A frase-teste:** se a comparação sobreviveria a um comentário do tipo *"de onde você tirou esse
número?"*, ela pode ir. Se a resposta honesta for "do nosso catálogo, que ainda não tem fonte
conferida", reescreve sem o número.

---

## 3. Heurística nossa ≠ lei da física

O erro mais fácil de cometer sem perceber, e o que o dono pediu explicitamente para evitar.

| Errado | Certo |
|---|---|
| "Existe um peso máximo para o seu corpo." | "O teto de peso do Tennis Engineer considera porte, idade e preparo." |
| "A ciência diz que 55 lb dá mais controle." | "Subir a tensão fecha a janela de erro — e cobra do braço." |
| "Sua raquete está errada." | "Esse conjunto de sintomas costuma aparecer quando a massa está acima do que o braço sustenta no fim do jogo." |

Toda regra calibrada por nós é **nossa**, e a frase precisa deixar isso claro.

---

## 4. Proibições diretas

- ❌ "Estudos mostram", "comprovado", "cientificamente" sem referência real e citável.
- ❌ Promessa de resultado: "vai melhorar seu jogo", "acaba com a dor no cotovelo".
- ❌ Qualquer coisa que soe a diagnóstico ou conselho médico. Desconforto → sugerir profissional.
- ❌ Número de clientes, vendas, avaliações ou depoimento que ainda não exista.
- ❌ Atacar marca, modelo ou loja.
- ❌ Falar de preço de raquete — não vendemos raquete e não acompanhamos preço de varejo.

---

## 5. Números que PODEM ser publicados

Só o que `scripts/fatos.ts` deriva do catálogo no momento de gerar. Nunca um número digitado à mão
num arquivo — é assim que uma afirmação envelhece em silêncio quando o catálogo cresce.

Seguros hoje, porque descrevem o **conjunto** e não um modelo:

- quantas raquetes e cordas o catálogo tem;
- a faixa de peso / área / espessura que o catálogo cobre;
- quantos setups o motor pode recomendar (`countSetupCombinations()` — hoje 29.152);
- distribuições: quantas são 16×19, quantas são de poliéster;
- resultados do motor sobre perfis sintéticos, via `scripts/caso.ts`.

O contraste com a §2 é o ponto: **o conjunto é publicável, o item nomeado ainda não.**

---

## 6. Etiqueta de origem — obrigatória antes de gerar arte

Cada afirmação técnica da copy recebe uma etiqueta interna. Ela não vai para o post; serve para a
conferência antes de a arte existir.

| Etiqueta | Significa | Publicável? |
|---|---|---|
| `[catálogo]` | Sai de `load.ts` via `fatos.ts` | Sim |
| `[motor]` | Saída real de `recommend()` | Sim, **como decisão do método** |
| `[física]` | Consenso amplo (mais massa resiste mais ao impacto) | Sim |
| `[heurística]` | Regra nossa, calibrada | Só se a frase disser que é nossa |
| `[opinião]` | Achismo | **Não. Reescreve ou corta.** |

Se qualquer frase ficar `[opinião]` e estiver escrita como fato, a pauta não avança para a arte.
