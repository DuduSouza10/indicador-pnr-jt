# Indicador de PNR — J&T Express

Dashboard Flask pronto para Railway, com PostgreSQL compartilhado, atualização multiusuário, edição do PNR BI, exportação XLSX completa e tradução PT-BR / Chinês Simplificado.

## Atualização obrigatória com 2 planilhas

O botão **Atualizar dados** exige os dois arquivos na mesma operação:

1. **PNR BI** — reclamações, RM, tipo de estação e valor da mercadoria.
2. **Entregas BI** — volume entregue por data/RM/Base.

A atualização é transacional: se um dos arquivos faltar ou falhar na validação, nenhum dos dois bancos é substituído.

Senha de alteração configurada no projeto: `3264542`.

## Taxa de PNR

Por RM e por dia:

`Taxa PNR = Reclamações do dia / Quantidade entregue com assinatura do dia × 10.000`

- Reclamações: contagem de linhas do PNR BI agrupadas por RM.
- Entregas: coluna **Quantidade entregue com assinatura** da Entregas BI, agrupada por RM.
- O pareamento de RM ignora diferenças de maiúsculas/minúsculas e acentuação.
- O ranking exibe também Valor da Mercadoria, Taxa PNR do dia de referência e variação contra D-1.

## Dashboards

- **Dashboard Geral**: visão principal e ranking por RM.
- **Dashboard - Bases/Franquias**: mesma leitura operacional, mas sem filtro de RM; o ranking, os filtros por clique e a Taxa PNR são baseados em Base/Franquia. A taxa por base cruza a Base do PNR BI com o Nome da base da Entregas BI.

## Página Gráficos

A aba **Gráficos** contém filtros independentes de data, Regional e RM, cards consolidados e um modelo Sparkline em faixas: cada RM fica em uma linha própria, com cor própria, datas no eixo inferior e bolinhas/rótulos de Taxa PNR + reclamações. Esse layout evita a sobreposição quando muitos RMs são exibidos juntos.

## Exportação XLSX

A exportação inclui os resumos do dashboard e também a(s) aba(s) **PNR BI** com todas as colunas e todos os valores do recorte filtrado. Bases maiores que 100.000 linhas são divididas em várias abas.

## Railway

Adicione um PostgreSQL ao mesmo projeto e, no serviço do dashboard, configure:

```text
DATABASE_URL=${{Postgres.DATABASE_URL}}
```

O projeto já contém `railway.json`, `Procfile` e `requirements.txt`.

## Local

No Windows, execute `INICIAR_LOCAL.bat` ou:

```bash
pip install -r requirements.txt
python app.py
```


## v5 - Taxa regional e supervisor no ranking
- Card global **Taxa PNR por Regional** em todas as abas, calculado por periodo como `Reclamacoes / Entregas x 10.000`.
- Ranking por RM agora exibe **Base** e **Supervisor** antes das metricas. A base/supervisor representam a combinacao mais recorrente daquele RM no recorte.
- A exportacao do Ranking RM tambem inclui Base e Supervisor.

### Ajuste v6
- Ranking por RM voltou a ficar sem a coluna Supervisor.
- Ranking por Base/Franquia agora exibe Supervisor logo após Base.
- Os rankings ocupam toda a largura da página.
- A distribuição Base Própria x Franquia foi movida para um painel separado abaixo do ranking.

## v7 - Classificação por quantidade
- Ranking por RM agora é ordenado pela quantidade total de reclamações no período, do maior para o menor.
- Ranking por Base/Franquia também é ordenado pela quantidade total de reclamações no período, do maior para o menor.
- Taxa PNR e variação D-1 continuam exibidas como métricas, mas não definem mais a posição no ranking.
