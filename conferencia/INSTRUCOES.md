# Conferência do catálogo — Tennis Engineer

Gerado em 2026-08-19 · catálogo `2026.08.6` · 47 raquetes · 58 variantes de corda

---

## Para quem for conferir (pessoa ou assistente)

Cada linha dos arquivos `raquetes.csv` e `cordas.csv` é um produto. As primeiras colunas trazem o
que temos hoje; as últimas seis estão em branco para você preencher.

### O que fazer

1. Encontre a **ficha oficial do fabricante** do produto — HEAD, Wilson, Babolat ou Yonex
2. Compare cada especificação com a linha
3. Preencha as colunas de conferência

### Colunas a preencher

| Coluna | Como preencher |
|---|---|
| `CONFERE? (S/N)` | `S` se **todas** as especificações batem; `N` se qualquer uma diverge |
| `O QUE ESTA ERRADO` | Nome da coluna divergente (ex.: `balanco_mm`). Várias, separe por `;` |
| `VALOR CORRETO` | O valor da ficha oficial, na mesma ordem |
| `URL DA FONTE OFICIAL` | Link direto da página do fabricante. **Obrigatório**, inclusive quando confere |
| `AINDA E LINHA ATUAL? (S/N)` | `N` se o fabricante já lançou geração mais nova |
| `OBSERVACOES` | Qualquer coisa relevante |

### Regras que não podem ser quebradas

**Não invente número.** Se não achou a especificação na fonte oficial, escreva `NAO ENCONTRADO` em
`OBSERVACOES` e deixe `VALOR CORRETO` vazio. Um campo vazio faz o sistema baixar a confiança do
relatório, que é o comportamento correto. Um número plausível e errado atravessa o sistema inteiro
sem ser notado e chega ao cliente como fato.

**Só fonte oficial do fabricante.** Não vale loja, blog, marketplace ou fórum — varejistas copiam
especificação errada com frequência, e um erro copiado por cinco lojas continua sendo um erro.

**Peso é SEM corda** (`unstrung`). Muitas lojas publicam o peso encordoado, que é ~15–17 g maior.
Se a fonte não disser qual é, registre em `OBSERVACOES`.

**Não preencha disponibilidade no Brasil, foto nem preço.** Essa parte é conferida por quem
administra o catálogo, direto no painel.

---

## O que NÃO está nestes arquivos, e por quê

Swingweight, rigidez RA e twistweight **não fazem parte do modelo** e por isso não aparecem aqui.
São medições de laboratório que nenhum fabricante publica; incluí-las exigiria copiar números de
terceiros sem procedência. O motor usa apenas o que o fabricante publica e qualquer varejista
especializado reproduz.

---

## Depois de preenchido

O CSV é insumo de trabalho, **não entra de volta no sistema por importação**. O resultado é lançado
em `/admin/verificacao`, que grava quem verificou, quando e com qual fonte. Essa cadeia de
procedência é parte do produto — é o que sustenta a promessa de que nenhuma recomendação vendida
foi construída sobre dado não conferido.
