# Indicador de PNR — J&T Express

Dashboard Flask pronto para Railway, com PostgreSQL compartilhado, atualização multiusuário, edição do PNR BI, exportação XLSX completa e tradução PT-BR / Chinês Simplificado.

## Atualização obrigatória com 2 planilhas

O botão **Atualizar dados** exige os dois arquivos na mesma operação:

1. **PNR BI** — reclamações, RM, tipo de estação e valor da mercadoria.
2. **Entregas BI** — volume entregue por data/RM.

A atualização é transacional: se um dos arquivos faltar ou falhar na validação, nenhum dos dois bancos é substituído.

Senha de alteração configurada no projeto: `3264542`.

## Taxa de PNR

Por RM e por dia:

`Taxa PNR = Reclamações do dia / Quantidade entregue com assinatura do dia × 10.000`

- Reclamações: contagem de linhas do PNR BI agrupadas por RM.
- Entregas: coluna **Quantidade entregue com assinatura** da Entregas BI, agrupada por RM.
- O pareamento de RM ignora diferenças de maiúsculas/minúsculas e acentuação.
- O ranking exibe também Valor da Mercadoria, Taxa PNR do dia de referência e variação contra D-1.

## Página Gráficos

A aba **Gráficos** contém filtros independentes de data, Regional e RM, cards consolidados e gráfico de linhas por RM com Taxa PNR e quantidade de reclamações em cada ponto.

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
