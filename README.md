# News Anime Monitor

![Version](https://img.shields.io/badge/version-1.0.4-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Node](https://img.shields.io/badge/node-%3E%3D20.18.1-brightgreen.svg)

> [!WARNING]
> Este projeto não tem intenção de atacar, sobrecarregar ou prejudicar qualquer site.
> As requisições são feitas de forma não agressiva, com limites, retries e boas práticas.
> O uso é destinado a estudo, aprendizado e monitoramento técnico.

`News Anime Monitor` é um monitor de notícias de anime com pipeline modular de ingestão, filtros por fonte, enriquecimento semântico, dedupe em camadas, score de relevância, histórico de aparição e API REST.
Além da coleta, o projeto atua como um radar editorial inteligente para classificar relevância, tendência e persistência de tópicos.

O projeto possui duas camadas:
- `API monitor` (Node.js + Express) para coleta/processamento e endpoints.
- `Frontend` (Next.js em `web/`) para portal editorial e navegação.

## Funcionalidades

- Monitoramento contínuo com ciclo configurável.
- Suporte real a buckets `feed`, `home` e `sitemap` por fonte.
- Regras por fonte em `SOURCE_DEFINITIONS` (autoridade de coleta/filtro).
- Respeito a `robots.txt` com modo de descoberta e fetch restrito.
- Enriquecimento de artigo com campos de pipeline (`bucket`, `sourceType`, `contentType`, `canonicalUrl`, `score`, `timesSeen`, etc).
- Dedupe por `canonicalUrl`, `titleNormalized`, `contentHash` e reconciliação com storage.
- Persistência com MySQL (preferencial) e fallback JSON local.
- Observabilidade por ciclo e por fonte em `/debug/sources`.
- Frontend com páginas de notícias, tendências, fontes e franquias.
- Sumário editorial orientado a contexto e neutralidade (Gemini CLI).
- Score composto com sinais de qualidade, importância, tendência e velocidade (`velocityScore`).
- Healthcheck de SEO automatizado para páginas críticas.
- Lint padronizado para API e frontend.

## Fontes suportadas

As fontes ativas no projeto são:
- `animenew`
- `animecorner`
- `animenewsnetwork`
- `crunchyrollnews`
- `myanimelist`
- `anitrendz`
- `otakuusa`
- `animeherald`
- `animeuknews`
- `otakunews`
- `siliconera`

Cada fonte preserva regras próprias de:
- `collectionPriority`
- `enableSitemap`
- `excludedPathPrefixes`
- `allowedPathPrefixes` (quando aplicável)
- `requiredFeedCategories` (quando aplicável)
- `homeLinkSelectors`
- `requestHeaders`/cookies (ANN)
- `mergeBuckets`
- `maxItems`

## Arquitetura do pipeline

Fluxo principal:
1. Coleta bruta por fonte e bucket.
2. Normalização de URL/campos.
3. Filtro por regras reais da fonte.
4. Enriquecimento semântico.
5. Dedupe/reconciliação.
6. Decisão de aceitação/rejeição.
7. Persistência.
8. Métricas e exposição via API.

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

- MySQL é usado quando `DB_HOST`, `DB_USER` e `DB_NAME` estão definidos.
- A tabela `articles` é criada automaticamente quando necessário.
- Se MySQL não estiver configurado, o sistema usa cache local em:
  - `src/data/processed_articles.json`

## API REST

Base local padrão: `http://127.0.0.1:3000`

Endpoints principais:
- `GET /` - inventário bruto atual em memória.
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
- `GET /debug/sources` - métricas internas do monitor.

Filtros comuns em endpoints listados:
- `limit`, `offset`, `q`, `source`, `bucket`, `contentType`, `lastSeenEvent`, `from`, `to`.

## Frontend (Next.js)

App em `web/` com navegação:
- `Home`
- `Notícias`
- `Tendências`
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

## Instalação

1. Clone o repositório:
```bash
git clone https://github.com/kaikybrofc/news-anime-monitor.git
cd news-anime-monitor
```

2. Instale dependências da API:
```bash
npm install
```

3. Instale dependências do frontend:
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
- `npm run lint` - lint da API (`src/**/*.js`).
- `npm run lint:fix` - lint da API com auto-fix.
- `npm run web:lint` - lint do frontend (`web/`).
- `npm run seo:check` - validação automatizada de SEO em produção.
- `npm run web:deploy:safe` - build + restart + healthchecks de deploy.

## Variáveis de ambiente

### API

Obrigatório:
- Gemini CLI instalado/autenticado no servidor

Principais opcionais:
- `PORT` (padrão `3000`)
- `NODE_ENV`
- `GEMINI_CLI_PATH` (padrão `gemini`)
- `GEMINI_MODEL` (usa o padrão do CLI quando vazio)
- `GEMINI_TIMEOUT_MS` (padrão `90000`)
- `GEMINI_APPROVAL_MODE` (padrão `plan`)
- `GEMINI_DISABLE_EXTENSIONS` (padrão `true`)
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

Se nada for definido, o frontend usa `http://127.0.0.1:3001` por padrão.

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

## CI (GitHub Actions)

Atualmente o repositório mantém workflow de revisão de dependências (`dependency-review.yml`).
O deploy em VPS via GitHub Actions foi removido e o fluxo recomendado é deploy manual/operacional via PM2 + Nginx.

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

## Troubleshooting rápido

- API não sobe: valide `.env` e porta configurada.
- Erro no Gemini CLI: confirme comando `gemini` disponível e autenticado.
- Frontend sem dados: configure `NEWS_MONITOR_API_URL` para a API correta.
- MySQL não conecta: confira `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`.
- ANN com restrição: configure `ANIMENEWSNETWORK_COOKIE` (ou `ANN_COOKIE`) e mantenha fallback guest.
- Deploy: use os scripts PM2 locais e valide logs após restart.
- `npm run web:lint` com warnings de `<img>`: esperado no estado atual, não bloqueia build.

## Licença

Projeto sob licença MIT. Veja `LICENSE`.
