# News Anime Monitor

![Version](https://img.shields.io/badge/version-1.0.3-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Node](https://img.shields.io/badge/node-%3E%3D20.18.1-brightgreen.svg)

> [!WARNING]
> Este projeto nao tem intencao de atacar, sobrecarregar ou prejudicar qualquer site.
> As requisicoes sao feitas de forma nao agressiva, com limites, retries e boas praticas.
> O uso e destinado a estudo, aprendizado e monitoramento tecnico.

`News Anime Monitor` e um monitor de noticias de anime com pipeline modular de ingestao, filtros por fonte, enriquecimento semantico, dedupe em camadas, score de relevancia, historico de aparicao e API REST.

O projeto possui duas camadas:
- `API monitor` (Node.js + Express) para coleta/processamento e endpoints.
- `Frontend` (Next.js em `web/`) para portal editorial e navegacao.

## Funcionalidades

- Monitoramento continuo com ciclo configuravel.
- Suporte real a buckets `feed`, `home` e `sitemap` por fonte.
- Regras por fonte em `SOURCE_DEFINITIONS` (autoridade de coleta/filtro).
- Respeito a `robots.txt` com modo de descoberta e fetch restrito.
- Enriquecimento de artigo com campos de pipeline (`bucket`, `sourceType`, `contentType`, `canonicalUrl`, `score`, `timesSeen`, etc).
- Dedupe por `canonicalUrl`, `titleNormalized`, `contentHash` e reconciliacao com storage.
- Persistencia com MySQL (preferencial) e fallback JSON local.
- Observabilidade por ciclo e por fonte em `/debug/sources`.
- Frontend com paginas de noticias, tendencias, fontes e franquias.

## Fontes suportadas

As fontes ativas no projeto sao:
- `animenew`
- `animecorner`
- `animenewsnetwork`

Cada fonte preserva regras proprias de:
- `collectionPriority`
- `enableSitemap`
- `excludedPathPrefixes`
- `allowedPathPrefixes` (quando aplicavel)
- `requiredFeedCategories` (quando aplicavel)
- `homeLinkSelectors`
- `requestHeaders`/cookies (ANN)
- `mergeBuckets`
- `maxItems`

## Arquitetura do pipeline

Fluxo principal:
1. Coleta bruta por fonte e bucket.
2. Normalizacao de URL/campos.
3. Filtro por regras reais da fonte.
4. Enriquecimento semantico.
5. Dedupe/reconciliacao.
6. Decisao de aceitacao/rejeicao.
7. Persistencia.
8. Metricas e exposicao via API.

Modulos principais:
- `src/pipeline/ingestion.js`
- `src/pipeline/normalization.js`
- `src/pipeline/filtering.js`
- `src/pipeline/enrichment.js`
- `src/pipeline/dedupe.js`
- `src/pipeline/scoring.js`
- `src/pipeline/decisioning.js`
- `src/pipeline/metrics.js`

## Persistencia

- MySQL e usado quando `DB_HOST`, `DB_USER` e `DB_NAME` estao definidos.
- A tabela `articles` e criada automaticamente quando necessario.
- Se MySQL nao estiver configurado, o sistema usa cache local em:
  - `src/data/processed_articles.json`

## API REST

Base local padrao: `http://127.0.0.1:3000`

Endpoints principais:
- `GET /` - inventario bruto atual em memoria.
- `GET /articles` - lista paginada com filtros.
- `GET /articles/:id` - detalhe por id.
- `GET /articles/slug/:slug` - detalhe por slug SEO.
- `GET /trends` - tendencias agregadas por janela.
- `GET /franchises` - ranking de franquias.
- `GET /franchises/:slug` - detalhe de franquia com artigos.
- `GET /sources` - resumo por fonte.
- `GET /sources/:sourceId` - detalhe de uma fonte.
- `GET /seo/entities` - agregados por entidades SEO.
- `GET /seo/:type/:slug` - detalhe de entidade (`anime`, `character`, `studio`, `tag`).
- `GET /debug/sources` - metricas internas do monitor.

Filtros comuns em endpoints listados:
- `limit`, `offset`, `q`, `source`, `bucket`, `contentType`, `lastSeenEvent`, `from`, `to`.

## Frontend (Next.js)

App em `web/` com navegacao:
- `Home`
- `Noticias`
- `Tendencias`
- `Franquias`
- `Fontes`
- `API`
- `Sobre`

Rotas editoriais principais:
- `/`
- `/noticias`
- `/noticias/[id]`
- `/tendencias`
- `/franquias`
- `/franquias/[slug]`
- `/fontes`
- `/fontes/[sourceId]`

## Instalacao

1. Clone o repositorio:
```bash
git clone https://github.com/kaikybrofc/news-anime-monitor.git
cd news-anime-monitor
```

2. Instale dependencias da API:
```bash
npm install
```

3. Instale dependencias do frontend:
```bash
npm --prefix web install
```

4. Configure ambiente:
```bash
cp .env.example .env
```

## Scripts (raiz)

- `npm start` ou `npm run api:start` - inicia a API monitor.
- `npm run monitor:log` - executa script auxiliar de monitoramento/log.
- `npm run start:pm2` - sobe API via PM2 (`news-anime-monitor`).
- `npm run pm2:restart` - reinicia API no PM2.
- `npm run pm2:logs` - logs da API no PM2.
- `npm run web:dev` - sobe frontend em dev (`web`, porta 3010).
- `npm run web:build` - build do frontend.
- `npm run web:start` - start do frontend built.
- `npm run web:pm2:start` - sobe frontend no PM2 (`news-anime-web`).
- `npm run web:pm2:restart` - reinicia frontend no PM2.
- `npm run web:pm2:logs` - logs do frontend no PM2.

## Variaveis de ambiente

### API

Obrigatorio:
- Gemini CLI instalado/autenticado no servidor

Principais opcionais:
- `PORT` (padrao `3000`)
- `NODE_ENV`
- `GEMINI_CLI_PATH` (padrao `gemini`)
- `GEMINI_MODEL` (usa o padrao do CLI quando vazio)
- `NEWS_SOURCE_IDS`
- `MAX_ITEMS_PER_SOURCE`
- `MAX_SITEMAPS_PER_SOURCE`
- `MAX_NEW_ARTICLES_PER_CYCLE`
- `CHECK_INTERVAL_MS`
- `ARTICLE_PROCESS_CONCURRENCY`
- `IN_MEMORY_MAX_ARTICLES`
- `API_DEFAULT_LIMIT`
- `API_MAX_LIMIT`

MySQL:
- `DB_HOST`
- `DB_USER`
- `DB_PASSWORD`
- `DB_NAME`
- `DB_POOL_LIMIT`

ANN (cookie opcional):
- `ANIMENEWSNETWORK_COOKIE`
- `ANN_COOKIE`

### Frontend

Para apontar o frontend para a API monitor:
- `NEWS_MONITOR_API_URL`

Fallbacks aceitos no frontend:
- `MONITOR_API_URL`
- `API_BASE_URL`

Se nada for definido, o frontend usa `http://127.0.0.1:3001` por padrao.

## Deploy com PM2 + Nginx (exemplo)

### 1) Subir processos

```bash
npm run start:pm2
npm run web:pm2:start
```

### 2) Nginx para `omnizap.xyz`

Exemplo de bloco server (ajuste paths de certificado):

```nginx
server {
    listen 80;
    server_name omnizap.xyz www.omnizap.xyz;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name omnizap.xyz www.omnizap.xyz;

    ssl_certificate /etc/letsencrypt/live/omnizap.xyz/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/omnizap.xyz/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3010;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /monitor-api/ {
        proxy_pass http://127.0.0.1:3001/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Estrutura de pastas

```txt
news-anime-monitor/
├── src/
│   ├── api/
│   ├── config/
│   ├── db/
│   ├── pipeline/
│   ├── services/
│   ├── utils/
│   └── data/
├── web/
├── logs/
├── ecosystem.config.js
├── package.json
└── README.md
```

## Troubleshooting rapido

- API nao sobe: valide `.env` e porta configurada.
- Erro no Gemini CLI: confirme comando `gemini` disponivel e autenticado.
- Frontend sem dados: configure `NEWS_MONITOR_API_URL` para a API correta.
- MySQL nao conecta: confira `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`.
- ANN com restricao: configure `ANIMENEWSNETWORK_COOKIE` (ou `ANN_COOKIE`) e mantenha fallback guest.

## Licenca

Projeto sob licenca MIT. Veja `LICENSE`.
