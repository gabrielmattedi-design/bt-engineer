# ADMIN_SPEC.md — Tennis Engineer

Status: `v1` · Rota: `/admin` · Acesso autenticado

---

## 1. Autenticação

Supabase Auth com allowlist de e-mails em `admin_users`. Middleware protege `/admin/*` e
`/api/admin/*`. Toda mutação grava `changed_by` e alimenta `data_revisions`. Sessão de 8 h.

Papéis: `curator` (edita catálogo e verifica fontes) · `admin` (tudo, incluindo preços).

---

## 2. `/admin/raquetes`

Lista com filtros por marca, status, `verification_state`, `data_completeness` e disponibilidade no Brasil.
Coluna visual de completude (barra) e um selo vermelho para `data_completeness < 0.70`.

**Ações:** adicionar raquete (família) · adicionar variante · adicionar geração · editar specs · arquivar
(nunca deletar) · recalcular atributos derivados.

**Editor de variante** — cada campo numérico é um `SourcedField`:

```
┌ perfil do quadro (viga) ────────────────────────────┐
│ valor: [ 322 ]        ☐ desconhecido (null)          │
│ fonte: [ lab ▾ ]      URL: [ https://… ]             │
│ verificado em: [2026-08-14]   confiança: [ alta ▾ ]  │
│ notas: [ medição RDC, média de 2 exemplares ]        │
└──────────────────────────────────────────────────────┘
```

Salvar sem fonte é **impossível** para campos técnicos: o botão fica desabilitado até `source_url`
existir ou o campo ser marcado como desconhecido. Esta é a barreira de UI que sustenta a política do
`DATA_SOURCING.md`.

Ao salvar, `racket_attributes` e `racket_fit_profiles` são recalculados e um diff é exibido:
*"control_score 71 → 74 (perfil da viga preenchido)"*.

---

## 3. `/admin/cordas`

Mesma estrutura, em dois níveis: **modelo** (`strings`) e **variantes de gauge** (`string_variants`).

Adicionar uma variante de gauge exige, por validação de formulário:
- `gauge_mm`
- `source_url` apontando para a página **daquele gauge**
- `brazil_availability_status` (não aceita `unknown` para publicar)

Aviso permanente no topo do editor:

> ⚠️ Cadastre um gauge apenas se ele existir comercialmente. Nunca copie os gauges de outro modelo da
> mesma linha. Se a corda não existe em 1.30, a variante 1.30 não deve existir aqui.

---

## 4. `/admin/verificacao` — fila de procedência

O coração operacional do produto. Fila priorizada por **impacto**: variantes que aparecem no Top 3 de
mais personas simuladas vêm primeiro.

Cada item mostra: campos pendentes, fontes atuais, tier, idade da verificação, e um painel lado a lado
para conferência. Ações: `verificar` · `marcar como divergente` · `marcar campo como desconhecido`.

Painel de divergências: lista tudo em `disputed` com os valores conflitantes, os tiers, a tolerância
excedida e a política sugerida — resolução em um clique, registrada em `data_revisions`.

Dashboard no topo:
```
Variantes:  47 total · 0 verified · 47 pending · 0 disputed
Completude média: 0.63        Bloqueio de produção: ATIVO ⛔
```

---

## 5. `/admin/simulador` — Recommendation Simulator (§47)

Ferramenta essencial de validação. Permite montar um perfil manualmente sem passar pelo questionário:

```
Idade 35 · Nível intermediário · Swing rápido · Topspin · Busca controle
Sem desconforto · Raquete atual: [autocomplete] 300 g
```

Saída — ranking **completo 1–20** (não só o pódio):

| # | Raquete | Fit | Físico | Nível | Swing | Estilo | Objetivo | Conforto | Transição | Penal. |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | … | 94.2 | 91 | 96 | 93 | 88 | 97 | 85 | 92 | — |
| 2 | … | 91.8 | 88 | 94 | 90 | 91 | 89 | 85 | 96 | −2.1 |

Clique em qualquer linha abre o `ScoreBreakdown` completo (§48): cada termo, peso, contribuição, campos
ausentes, e as listas legíveis de **por que ganhou** e **por que perdeu** pontos.

Aba separada mostra os **excluídos por filtro duro**, com o motivo — tão importante quanto ver quem
entrou.

**Recursos adicionais:**
- **Comparar versões:** rodar o mesmo perfil sob duas `weights_version` e ver o diff de ranking. É assim
  que uma recalibração é aprovada.
- **Rodar a suíte de personas:** executa as 20+ personas de `TEST_STRATEGY.md` e mostra a matriz
  persona × Top 5, destacando o que mudou desde a última execução.
- **Editar pesos em runtime:** sliders sobre `weights.v1`, com `rationale` obrigatório para salvar como
  nova versão. Nunca sobrescreve uma versão publicada.

---

## 6. `/admin/precos` (§34)

CRUD de `products`: nome, descrição, `price_cents`, `active`, `grants_entitlements`. Alteração de preço
gera log e **não afeta pedidos existentes** (`orders.amount_cents` é snapshot).

Sem campo de "preço anterior" ou "desconto" — por decisão de produto, dark patterns são impossíveis de
representar no schema (§58).

---

## 7. `/admin/recomendacoes`

Lista de `recommendation_sessions` com: data, confiança, Top 3, engine/dataset version, produto comprado.
Busca por `public_id`. Detalhe abre o breakdown completo — é a ferramenta de suporte quando um cliente
questiona um resultado.

Alertas automáticos:
- **Concentração:** um modelo em > 25% dos Top 1 → auditar o algoritmo (pode indicar peso mal calibrado
  ou lacuna de catálogo).
- **Confiança baixa:** > 20% das sessões com confiança `Baixa` → revisar questionário.
- **Fit médio baixo:** Top 1 médio < 80 → o catálogo não cobre o público que está chegando.

---

## 8. `/admin/feedback` (§38, §67)

Respostas do feedback loop, filtráveis por raquete recomendada, nível e confiança.

Painel do **RSS** (Recommendation Satisfaction Score) global e por segmento. Cruzamento essencial:
**Fit Score previsto × satisfação real**. Se raquetes com fit 90+ recebem satisfação baixa
sistematicamente, o algoritmo está errado — e este painel é onde isso aparece primeiro.

Nenhum ML aqui (§38). Só coleta e visualização, até haver volume.

---

## 9. `/admin/estatisticas`

Funil (§50) com conversão por etapa, abandono por etapa do quiz, split entre planos, taxa de upsell,
ticket médio, distribuição de Fit Score e de confiança, raquetes e cordas mais recomendadas.

---

## 10. Auditoria

Toda ação administrativa grava: quem, quando, o quê, valor anterior, valor novo, e — para catálogo — a
linha em `data_revisions`. Não existe edição silenciosa de dado técnico.
