# Pesquisa de RA e swingweight — planilha de curadoria

> **Estado: INCOMPLETA E NÃO APLICADA.** Nada aqui entrou no catálogo, no schema ou no motor.
> Este arquivo é material de trabalho para `/admin/verificacao`, não uma fonte.

## Por que parou pela metade

O ambiente de execução deste projeto bloqueia saída HTTP para domínios externos. Tennis Warehouse,
Tennis Warehouse Europe, tennisnerd.net, racqix.com, iq.tennis, tennisgearguide.co.uk — todos
retornam `EGRESS_BLOCKED`. Sobra a busca, que devolve **resumos** das páginas, não as páginas.

O resultado é que parte dos números vem exata ("RA 66, swingweight 323 encordoada") e parte vem em
linguagem de marketing ("sub-64 RA", "mid-320s", "325+"). Para o campo que existe justamente para
DESEMPATAR raquetes que hoje empatam, um valor aproximado é pior que valor nenhum: ele desempata,
mas por ruído.

## Duas armadilhas que qualquer coleta futura precisa resolver antes de gravar

**1. Encordoada ≠ sem corda, e a diferença é enorme.** Um jogo de cordas soma cerca de **+30
pontos de swingweight** e derruba o **RA em ~3 pontos**. As fontes alternam entre as duas
convenções sem avisar. Exemplo real desta pesquisa — Babolat Pure Aero 2026:

| | RA | swingweight |
|---|---|---|
| sem corda | 69 | 290 |
| encordoada | 66 | 320 |

Misturar as duas colunas no mesmo campo produziria um catálogo em que raquetes parecem diferir por
30 pontos de swingweight quando a diferença é só de quem mediu de que jeito.

**2. Laboratórios discordam de verdade.** Babolat Pure Drive 2025: Tennis Warehouse mediu **RA 66**;
outros testadores relataram **70–71**; um comentário de usuário citou 69. Não é erro de ninguém — é
variação de fabricação somada a protocolos diferentes. Antes de gravar é preciso escolher **uma
fonte única para todo o catálogo**: a consistência entre as 46 importa mais que a exatidão absoluta
de cada uma, porque o motor compara raquetes entre si.

## O que foi possível estabelecer

Legenda de confiança: **A** = número exato com fonte identificada · **B** = número exato, convenção
(encordoada/sem corda) incerta · **C** = aproximação verbal, inutilizável como dado.

| Raquete | RA | Swingweight | Conf. | Observação |
|---|---|---|---|---|
| Babolat Pure Aero (2026) | 69 s/corda · 66 encord. | 290 s/corda · 320 encord. | **A** | as duas convenções, explícitas |
| Yonex EZONE 98 (2025) | 63 | ~290 s/corda · 320 encord. | **A** | RA caiu vs. geração anterior |
| HEAD Radical MP (2025) | 66 | 323 encord. | **A** | balanço 4 pts HL encordoada |
| Wilson Clash 100 v3 (2024) | 54 | ~310 encord. | **A** | o RA mais baixo do catálogo |
| Yonex VCORE 98 (2026) | ~66 | 321 encord. | **B** | era ~64 na geração 2023 |
| Wilson Blade 98 16x19 v10 (2026) | 64 s/corda | 291 s/corda | **B** | varejista, não o fabricante |
| HEAD Speed MP (2026) | 60 | "325+" | **B** | RA confiável, SW não |
| HEAD Speed Pro (2026) | 61 | — | **B** | SW não localizado |
| Yonex VCORE 100 (2026) | — | 325 encord. | **B** | RA não localizado |
| Babolat Pure Drive (2025) | 66 · 69 · 70–71 | 290 s/corda · 317 encord. | **C** | fontes em conflito aberto |
| Wilson Blade 98 18x20 v10 (2026) | "sub-64" | "mid-320s" | **C** | só aproximação verbal |
| HEAD Gravity MP (2025) | "baixa" | "sub-325" | **C** | só aproximação verbal |

**Cobertura: 12 de 46 raquetes tocadas, 4 em confiança A.** As 34 restantes não foram pesquisadas
porque o mesmo teto se aplicaria a elas.

## Como completar

Em ordem de qualidade do resultado:

1. **Liberar os domínios no ambiente** (Tennis Warehouse basta — é uma fonte só, um laboratório só,
   protocolo constante, e cobre praticamente o catálogo inteiro). Com isso a coleta das 46 vira
   trabalho mecânico e consistente.
2. **Colar as páginas de spec** aqui manualmente, uma a uma. Funciona, é lento.
3. **Medir localmente**, se houver acesso às raquetes: swingweight exige um Babolat RDC ou similar;
   RA idem. É o padrão-ouro e é o que os concorrentes não têm.

## Antes de aplicar no motor

Mesmo com os dados completos, ligar RA e swingweight ao ranking é uma decisão separada e precisa de
cuidado: `stiffness_index` e `swing_index` **já existem** como proxies derivados do perfil da viga e
de peso × balanço. Substituir proxy por medição sem recalibrar faria os pesos atuais — ajustados
contra os proxies — apontarem para o lugar errado. A sequência correta é: gravar como campo novo →
medir a divergência proxy × medição no catálogo inteiro → recalibrar → só então trocar.
