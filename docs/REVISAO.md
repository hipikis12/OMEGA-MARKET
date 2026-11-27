# Revisão do OMEGA MARKET 5.8.0-RC → 6.0.0

O código original está preservado no commit inicial do `main` (5.8.0-RC). Esta revisão explica o que foi encontrado e por que a versão 6 foi reconstruída em vez de adaptada.

## 1. Diagnóstico da 5.8.0-RC

| # | Gravidade | Achado | Consequência |
|---|-----------|--------|--------------|
| 1 | **Crítica** | `public/index.html` estava **vazio (0 bytes)** | A loja não renderizava nada no navegador; os 50 testes passavam porque nenhum testava a interface |
| 2 | **Crítica** | Servidor em `node:http` + `node:sqlite` + sistema de arquivos local (`data/`) | Impossível rodar no Cloudflare Pages/Workers, que não têm disco nem SQLite nativo do Node |
| 3 | **Crítica** | Nenhum pagamento real: tudo era "laboratório", "homologação" ou "simulado"; tokens `APP_USR-` (produção) eram **rejeitados de propósito** | Não era possível vender |
| 4 | Alta | ~40 módulos versionados (`security30.mjs`…`security49.mjs`, `mp32`, `mp40`, `bridge45`, `checkout44`, `delivery42`…) com responsabilidades sobrepostas e **4 fluxos de checkout paralelos** que não se conectavam | Manutenção inviável; risco de regras divergentes |
| 5 | Alta | Código minificado em linhas únicas (`server.mjs` com 50 KB em 180 linhas, `app.js` com 100 KB em 139 linhas) | Revisão e depuração muito difíceis |
| 6 | Alta | Uploads em JSON/base64 na memória e imagens como BLOB no SQLite | Estoura memória; não escala |
| 7 | Média | Senha inicial do admin impressa no console | Vaza em logs |
| 8 | Média | Rate limit e bloqueios em memória do processo | Não funciona com várias instâncias (edge) |
| 9 | Média | CSRF por token só nas "rotas Beta"; restante dependia só de checagem de origem | Proteção inconsistente |
| 10 | Baixa | README acumulava o histórico de ~40 versões | Documentação confusa |

**Pontos bons que foram mantidos como ideia:** hash de senha forte (scrypt), tokens de sessão guardados como digest, CSP restritiva, chave de idempotência no checkout, valores sempre em centavos, preço recalculado no servidor, verificação HMAC do webhook, reconsulta do pagamento na API antes de liberar, licenças atribuídas atomicamente, auditoria.

## 2. Nova arquitetura (6.0.0)

```
Navegador (SPA estática em /public)
   │  fetch /api/*  (cookies HttpOnly, mesma origem)
   ▼
Cloudflare Pages Functions (/functions/api)  ── WAF, Turnstile, DDoS, TLS da Cloudflare
   │  chave secreta (nunca vai ao navegador)
   ├──► Supabase Postgres (RLS + funções SQL atômicas)
   ├──► Supabase Auth (cadastro, login, recuperação de senha)
   ├──► Supabase Storage (bucket privado p/ arquivos, público p/ capas)
   └──► Mercado Pago (Checkout Pro + Webhooks)
```

### Decisões
- **Sem dependências npm em produção.** As Functions falam com Supabase e Mercado Pago via `fetch`. Menos superfície de ataque e deploy sem build.
- **Regras de dinheiro no banco.** `create_order` calcula preço, desconto e uso de cupom numa transação; `apply_payment` aplica o resultado do Mercado Pago de forma idempotente (repetição de webhook, eventos fora de ordem, estorno, chargeback e valor divergente).
- **O webhook não é confiável.** Ele só dispara uma reconsulta: o status, o valor e a moeda vêm da API do Mercado Pago. Também é verificada a assinatura `x-signature` (HMAC-SHA256).
- **Fallback sem webhook.** Na volta do checkout, a página do pedido consulta `/v1/payments/search?external_reference=` (útil em testes, onde o Mercado Pago às vezes não notifica).
- **Arquivos nunca públicos.** O download confere a compra e redireciona para uma URL assinada que vale 2 minutos. Uploads do admin vão direto do navegador ao Storage com URL assinada, o que evita o limite de corpo do Worker.
- **Sessão em cookies `HttpOnly; Secure; SameSite=Lax`.** O JavaScript nunca vê tokens. A sessão é renovada automaticamente com o refresh token.
- **RLS ativo em todas as tabelas.** Mesmo que a chave publishable vaze, ela só lê o catálogo publicado.

### O que ficou de fora nesta versão (e por quê)
- **Marketplace multi-vendedor com split (OAuth do Mercado Pago).** A 5.8 só tinha isso em modo de homologação. A 6.0 é uma loja de um vendedor, que é o caso de "loja de produtos digitais". O schema pode ganhar `seller_id` depois.
- **2FA próprio.** O Supabase Auth tem MFA (TOTP) nativo, que pode ser ativado no painel. Não vale a pena manter uma implementação caseira.
- **Chamados de suporte, campanhas e CMS de banners.** Ficaram fora para reduzir a superfície. O CMS foi trocado pelos textos da vitrine em `Admin › Loja`.
- **Backup e restauração manuais em scripts.** O Supabase faz backups automáticos (diários no plano Pro, com PITR opcional).

## 3. Mapa de funcionalidades

| 5.8.0-RC | 6.0.0 |
|----------|-------|
| Catálogo, categorias, busca, ordenação | ✅ `/api/products` com busca, filtro e 6 ordenações |
| Avaliações de compradores | ✅ só quem pagou; média atualizada por gatilho |
| Ofertas (preço riscado) | ✅ `compare_cents` |
| Cupons percentuais com limite e validade | ✅ consumidos atomicamente no pedido |
| Entrega de arquivos com versão | ✅ Storage privado + URL assinada + log de downloads |
| Licenças com estoque | ✅ atribuídas no pagamento (`FOR UPDATE SKIP LOCKED`) |
| Checkout simulado | ✅ **Checkout Pro real** (Pix, cartão, boleto) |
| Webhook de teste | ✅ webhook real com assinatura + reconsulta |
| Reembolso fictício | ✅ estorno/chargeback real revoga o acesso |
| Painel admin | ✅ painel, produtos, arquivos, capas, licenças, pedidos, cupons, vitrine |
| Recuperação de senha | ✅ via Supabase Auth |
| Bloqueio de força bruta | ✅ Turnstile + rate limit do Supabase Auth + regras da Cloudflare |

## 4. Testes
- `npm test`: 17 testes Node (assinatura do webhook, montagem da preferência, validações, CSRF, checkout, webhook, download, permissões de admin e renovação de sessão), com `fetch` simulado.
- `test/sql/business.sql`: regras do banco executadas num PostgreSQL 16 real, cobrindo cupom, idempotência, valor divergente, aprovação, licença, repetição, estorno, recusa seguida de aprovação, produto em rascunho e RLS anônimo. Roda no GitHub Actions a cada push.
- Testes visuais com o navegador em `npm run preview`, com dados fictícios.
- **Não testado:** chamadas reais ao Supabase e ao Mercado Pago. Faça uma compra de teste completa antes de abrir a loja (veja o README).
