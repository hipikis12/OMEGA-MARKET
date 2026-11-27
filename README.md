# Ω OMEGA MARKET 6

Loja de produtos digitais (templates, e-books, cursos, softwares e licenças) com **entrega automática após o pagamento**.

- **Frontend:** SPA estática em `public/`, sem build e sem dependências
- **Backend:** Cloudflare Pages Functions em `functions/api/`
- **Banco, login e arquivos:** Supabase (Postgres + Auth + Storage)
- **Pagamentos:** Mercado Pago Checkout Pro (Pix, cartão e boleto) com webhook assinado

A revisão do código antigo e as decisões de arquitetura estão em [`docs/REVISAO.md`](docs/REVISAO.md). O código 5.8.0-RC está preservado no primeiro commit do `main`.

## Estrutura

```
public/                 site estático (index.html, assets/, _headers)
functions/api/          rotas /api/* (Cloudflare Pages Functions)
lib/                    código compartilhado (Supabase, Mercado Pago, auth, validação)
supabase/migrations/    schema, RLS, funções SQL e buckets
supabase/seed.sql       categorias e produtos de demonstração (opcional)
test/                   testes Node (npm test) e SQL (test/sql)
scripts/preview.mjs     pré-visualização do visual com dados fictícios
```

## Passo a passo para colocar no ar

### 1. Supabase
1. Crie um projeto em https://supabase.com (região **South America (São Paulo)**).
2. Em **SQL Editor**, rode `supabase/migrations/0001_init.sql`. Se quiser os produtos de exemplo, rode também `supabase/seed.sql`.
3. Em **Authentication › Sign In / Providers › Email**, deixe **Confirm email** ligado.
4. Em **Authentication › URL Configuration**:
   - Site URL: `https://SEU-DOMINIO`
   - Redirect URLs: `https://SEU-DOMINIO/conta-confirmada` e `https://SEU-DOMINIO/nova-senha`
5. Em **Authentication › Emails › SMTP**, configure um SMTP próprio (por exemplo Resend ou Brevo). O SMTP padrão do Supabase tem limite baixo de envios.
6. Em **Project Settings › API Keys**, copie a URL, a *publishable key* e a *secret key*. A chave secreta **nunca** vai para o frontend nem para o Git.

### 2. Cloudflare Pages
1. Abra **Workers & Pages › Create › Pages › Connect to Git** e escolha `hipikis12/omega-market`.
2. Configuração de build:
   - Framework: *None*
   - Build command: vazio
   - Output directory: `public`
3. Em **Settings › Variables and Secrets** (Production), cadastre como **Secret**:

| Variável | Valor |
|----------|-------|
| `SITE_URL` | `https://SEU-DOMINIO` (sem barra no final) |
| `SUPABASE_URL` | `https://xxxx.supabase.co` |
| `SUPABASE_PUBLISHABLE_KEY` | publishable (ou anon) key |
| `SUPABASE_SECRET_KEY` | secret (ou service_role) key |
| `MP_ACCESS_TOKEN` | `TEST-...` para testar e `APP_USR-...` para vender de verdade |
| `MP_WEBHOOK_SECRET` | assinatura secreta do webhook (passo 3) |
| `TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` | passo 4 |

4. Em **Custom domains**, adicione o seu domínio.

### 3. Mercado Pago
1. Em https://www.mercadopago.com.br/developers › **Suas integrações**, crie uma aplicação do tipo **Checkout Pro**.
2. Copie o **Access Token** (de teste ou de produção) para `MP_ACCESS_TOKEN`.
3. Em **Webhooks**, configure:
   - URL de produção: `https://SEU-DOMINIO/api/webhooks/mercadopago`
   - Evento: **Pagamentos**
   - Copie a **assinatura secreta** para `MP_WEBHOOK_SECRET`.
4. Para testar, crie **contas de teste** (vendedor e comprador) no painel e use os cartões de teste do Mercado Pago.
5. Os reembolsos são feitos no painel do Mercado Pago. O webhook marca o pedido como reembolsado e bloqueia os downloads sozinho.

### 4. Segurança da Cloudflare (recomendado)
No painel do domínio:
- **SSL/TLS:** modo *Full (strict)*, **Always Use HTTPS** ligado, **Minimum TLS 1.2** e **HSTS** ligado (o `_headers` já envia HSTS).
- **Turnstile:** crie um widget para o domínio e cadastre as duas chaves. Ele protege cadastro, login e recuperação de senha.
- **Security › Bots:** ligue o **Bot Fight Mode**.
- **Security › WAF › Rate limiting rules**:
  - `URI Path starts with /api/auth/` → 10 requisições por minuto por IP → *Block* por 10 minutos
  - `URI Path equals /api/checkout` → 20 por minuto por IP → *Block*
  - `URI Path starts with /api/` → 300 por minuto por IP → *Managed Challenge*
- **Security › WAF › Custom rules**: em `/api/webhooks/mercadopago`, não aplique desafio, senão o Mercado Pago não consegue entregar a notificação.
- **Opcional:** em **Zero Trust › Access**, proteja `/#/admin` com login por e-mail (camada extra além do papel de admin).
- O `public/_headers` já aplica CSP restritiva, `X-Frame-Options`, `Referrer-Policy` e `Permissions-Policy`.

### 5. Primeiro administrador
1. Crie sua conta pela própria loja (`/#/cadastro`) e confirme o e-mail.
2. No SQL Editor do Supabase, rode:
   ```sql
   update public.profiles set role = 'admin'
   where id = (select id from auth.users where email = 'SEU@EMAIL.com');
   ```
3. Entre de novo. O menu **Admin** aparece no topo.

### 6. Antes de abrir a loja
- [ ] Fazer uma compra completa com `TEST-` e conta de comprador de teste. Conferir se o pedido fica **Pago** e se o arquivo baixa na biblioteca.
- [ ] Fazer um reembolso de teste. O pedido deve virar **Reembolsado** e o download deve ser bloqueado.
- [ ] Trocar `MP_ACCESS_TOKEN` para `APP_USR-...` e fazer um redeploy.
- [ ] Arquivar ou excluir os produtos de demonstração do seed.
- [ ] Publicar termos de uso, política de privacidade (LGPD) e política de reembolso. O CDC dá 7 dias de arrependimento em compras online.

## Desenvolvimento local
```bash
npm test                         # testes Node
npm run preview                  # só o visual, com dados fictícios → http://127.0.0.1:8790
cp .dev.vars.example .dev.vars   # preencha com chaves de teste
npx wrangler pages dev           # fluxo real → http://localhost:8788
```
Os testes SQL rodam no GitHub Actions (`.github/workflows/ci.yml`) contra um PostgreSQL 16.

## Como o pagamento funciona
1. O cliente clica em **Pagar** e `/api/checkout` chama `create_order` no banco. Preço, cupom e total são calculados lá, numa transação, com chave de idempotência.
2. A Function cria a preferência do Checkout Pro com `external_reference = id do pedido` e redireciona o cliente ao Mercado Pago.
3. O Mercado Pago chama `/api/webhooks/mercadopago`. A assinatura é verificada e o pagamento é **reconsultado na API**. Valor, moeda e referência são conferidos, e `apply_payment` atualiza o pedido de forma idempotente, atribuindo as licenças.
4. Ao voltar para a loja, a página do pedido também consulta o Mercado Pago, caso o webhook atrase.
5. Os downloads conferem a compra a cada clique e entregam uma URL assinada que vale 2 minutos.
