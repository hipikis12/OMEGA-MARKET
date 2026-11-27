# OMEGA MARKET — Beta 4.1.0

## Alterações da versão
- OAuth de homologação para parceiros ativos com PKCE S256, state de uso único, expiração de 10 minutos e vínculo à sessão.
- Troca e renovação de token pelo endpoint oficial de OAuth com `test_token: true`. Somente respostas `live_mode: false` e tokens `TEST-` são aceitos.
- Cofre AES-256-GCM vinculado ao ID do vendedor. A chave deve permanecer separada do banco e dos backups; não deve ser incluída no código.
- Desvinculação local, sem revogação remota de consentimento. Nenhum token é enviado à interface.
- Preferências de teste de parceiro utilizam o token do vendedor e `marketplace_fee` calculado no servidor sobre o preço da preferência. A consulta verifica também o ID do recebedor.
- A página `/#mp41` é acessível a administrador e parceiro ativo. A administração vê o estado das autorizações, não os tokens. O administrador mantém a criação de preferências de homologação em `/#mp40`.

## Execução local
Node.js 22.13+; `npm run dev`; abra http://127.0.0.1:3000. Encerre a versão anterior, faça backup e copie toda a pasta data para preservar registros. As tabelas novas são criadas automaticamente. Sem configuração OAuth, a integração externa fica desativada.

## Homologação externa — responsabilidade do administrador adulto
As variáveis esperadas no servidor são `MP_OAUTH_CLIENT_ID`, `MP_OAUTH_CLIENT_SECRET`, `MP_OAUTH_REDIRECT_URI` e `MP_OAUTH_VAULT_KEY`. A URL de retorno deve ser HTTPS e terminar em `/api/mp41/callback`; a chave do cofre deve ter 32 bytes aleatórios, representados por 64 caracteres hexadecimais. A aplicação requer PKCE. Não insira credenciais no navegador, no repositório ou em conversas. O servidor escuta exclusivamente no loopback; a homologação externa requer infraestrutura HTTPS supervisionada e revisão de segurança.

A documentação oficial esclarece que algumas credenciais de teste do Checkout Pro têm prefixo APP_USR; esta Beta mantém a rejeição conservadora desse prefixo, inclusive para OAuth, até que o ambiente possa ser verificado de forma inequívoca. Isso pode impedir a homologação com algumas contas de teste. Não contorne o bloqueio. O código não aceita credenciais de produção.

## Limitações
- 27 testes Node passaram (22.16.0), incluindo 3 novos testes de módulo com transporte fictício. Não houve chamadas reais ao Mercado Pago, testes visuais, teste HTTP completo do redirecionamento OAuth nem migração com banco existente.
- Notificações externas dos parceiros não são processadas por esta Beta; a consulta administrativa é manual. A autorização expirada ou removida impede consultas de pedidos daquele vendedor até nova autorização compatível.
- A renovação é manual. Desvinculação local não revoga o acesso no Mercado Pago. O cofre não tem rotação de chave automática.
- A homologação permanece isolada dos pedidos de compra e da entrega digital; nenhuma confirmação externa libera produtos. Reembolsos externos e conciliação oficial ainda não implementados. Sem operação comercial.
- A comissão da preferência é um valor fixado em centavos com base no preço total, não uma previsão da taxa efetiva do provedor.

Referências oficiais: https://www.mercadopago.com.br/developers/pt/docs/split-payments/split-1-1/integration-configuration/integrate-marketplace e https://www.mercadopago.com.br/developers/pt/docs/split-payments/split-1-1/additional-content/security/oauth/creation

---

## Histórico das versões anteriores
# OMEGA MARKET — 4.0.0 Beta.1

O universo digital ao seu alcance.

## Instalação local

Node.js 22.13 ou superior. Execute `npm run dev` e abra http://127.0.0.1:3000. Acesso administrativo: http://127.0.0.1:3000/#admin-login. O primeiro início imprime a senha inicial. Para migrar, pare o servidor anterior e faça backup de toda a pasta data antes de copiá-la para o novo projeto. Execute `npm test` para os testes automatizados.

## Homologação financeira

Central administrativa: http://127.0.0.1:3000/#mp40. Por padrão funciona offline. O administrador pode selecionar produtos publicados de um único vendedor, criar uma preferência local, simular aprovação, rejeição e reembolso e consultar o histórico persistente. Nenhum registro da central autoriza a entrega nem altera pedidos da loja. Os valores são recalculados no servidor, com ofertas vigentes; cupons não fazem parte desse laboratório. Comissão prevista sobre valor bruto, em centavos, sem simular a tarifa do provedor.

O adaptador contém transporte HTTPS para a API oficial de preferências Checkout Pro e consulta de pagamentos, limitado a credenciais de teste fornecidas pelo administrador adulto responsável em variáveis de ambiente do servidor (MP_TEST_ACCESS_TOKEN, MP_TEST_WEBHOOK_SECRET). Não aceita credenciais de produção, não armazena nem exibe segredos na interface, não segue redirecionamentos da API e só disponibiliza URLs de sandbox explicitamente permitidas. Não se realizou nenhuma chamada externa na validação deste pacote. A disponibilidade e o formato de sandbox_init_point precisam ser confirmados na homologação oficial. Não há modo de produção. O adaptador oficial está restrito a produtos do proprietário; a comissão de parceiros só é testada offline, sem autorização OAuth externa. Não há integração de reembolsos externos.

A rota de webhook de teste verifica HMAC-SHA256, timestamp, ID da requisição e do pagamento, consulta o provedor e valida referência, moeda, valor, live_mode e estado. O servidor continua escutando apenas em loopback. Não exponha esta Beta na internet. O protocolo e a entrega externa ainda precisam de homologação, inclusive o tratamento de eventos fora de ordem e retentativas. A documentação oficial informa que compras com credenciais de teste podem não emitir notificações; nesse caso a consulta administrativa e testes controlados são caminhos distintos. Nenhuma entrega de produto é autorizada por esses eventos. A idempotência da criação registra a tentativa antes da chamada externa, sem repetir automaticamente uma tentativa cujo resultado seja incerto; não existe recuperação automática de preferências incertas. A proteção CSRF por token vale apenas para as novas rotas administrativas Beta; não constitui proteção integral da loja.

## Pendências críticas antes de produção

OAuth oficial com renovação/revogação, split homologado por vendedor, entrega atômica após confirmação oficial, reembolsos e conciliação oficial, tratamento de múltiplas tentativas, auditoria geral, HTTPS e infraestrutura, proteção de credenciais e backups em produção, recuperação de senha/2FA, testes de navegador e migração de banco real. A operação financeira comercial requer administrador adulto elegível e homologação. A Beta não é pronta para produção.

## Validação

24 testes automatizados aprovados no Node.js 22.16.0 (inclui testes anteriores, transporte HTTP do provedor substituído por respostas fictícias, validação de assinaturas e teste HTTP local). Não foram efetuadas chamadas externas, testes de navegador nem migração de dados reais. O teste de webhook externo não foi realizado.

## Histórico anterior (Alpha 3.7.0 e anteriores)

# Alpha 2.5.0 — Marketing & Commercial Center

Novidades: avaliações públicas anônimas de pedidos de teste aprovados, médias no catálogo, lançamentos e mais vendidos em testes, ordenação por avaliação e vendas. Reembolsos removem a elegibilidade das avaliações. Nenhum pagamento real. Cupons, ofertas temporárias, licenças e suporte permanecem pendentes.

# Alpha 2.4.0 — Professional Seller Experience

Busca de produtos, menu recolhível, indicadores por situação e prévia de formulário. Duplicação cria cópia pendente do mesmo vendedor, sem imagens, arquivos ou pedidos. Pagamentos exclusivamente locais.

# Omega Market — Alpha 2.3.0

Central de contas: acesso administrativo em `/#admin-login`, filtros de parceiros e clientes, indicadores por conta, aprovação/reativação/suspensão com justificativa e histórico. Suspensão revoga sessões existentes. A tabela nova é criada automaticamente; faça backup da pasta data antes de migrar. Pagamentos exclusivamente simulados.

# OMEGA MARKET — Alpha 1.5.0

O universo digital ao seu alcance.

## Executar
Node.js 22.13 ou superior. Na pasta omega-market, execute `npm run dev` e abra http://127.0.0.1:3000. Não há dependências externas. O primeiro início gera a senha de admin@omega.local no terminal.

## Atualizar
Pare o servidor anterior. Faça backup de toda a pasta data e copie-a para o novo projeto. O servidor cria as novas tabelas automaticamente. Não substitua o banco existente por um banco vazio.

## Novidades
- Menu lateral responsivo no painel; abas de visão geral, produtos, imagens, parceiros, vitrine e pagamentos conforme perfil.
- Indicadores e gráfico de pedidos demonstrativos por status.
- Galeria de até seis imagens por produto (PNG, JPEG, WebP, até 3 MB cada), primeira imagem como capa.
- Administrador configura título e descrição do primeiro banner, aviso e categorias adicionais. As categorias existentes dos produtos são preservadas.
- Imagens locais em data/images; inclua essa pasta no backup.

## Limites
Checkout exclusivamente demonstrativo; sem Mercado Pago real, cupons, avaliações, arquivos digitais privados ou biblioteca de downloads. Validação básica de assinaturas de imagem, não inspeção completa. Sem testes visuais completos ou migração de banco real. Uso exclusivamente local, não publicar em produção.

## Alpha 1.5.0 — Entrega digital demonstrativa
- Painel > Arquivos digitais: envie até cinco arquivos de até 4 MB por produto.
- Cliente cria pedido de teste no carrinho; administrador aprova em Pedidos de teste.
- Biblioteca permite baixar arquivos com sessão ativa e pedido demonstrativo aprovado. Revogação bloqueia novos downloads.
- Avaliações demonstrativas na biblioteca; API de consulta disponível, sem exibição pública na interface nesta versão.
- Auditoria registra uploads e aprovações/revogações. Não é auditoria integral.
- Faça backup de toda a pasta data antes de atualizar. Não exponha o servidor à internet. Arquivos não passam por antivírus. Não há cobrança, repasse, OAuth, licença digital ou cupons nesta versão.

## Alpha 1.7.0 — Pagamentos simulados
Base 1.5.0. Node 22.13+. Execute npm run dev. Painel > Pagamentos. Comissão por parceiro de 0 a 40%, taxa fictícia de 5%, valores em centavos congelados no pedido. Aprovação/revogação de teste permanece na aba Pedidos de teste; não há cobrança ou repasse. Pedidos antigos não entram no novo histórico. Não insira credenciais ou dados financeiros reais. Não publique em produção. Para migrar, pare o servidor, faça backup e copie a pasta data.

## Alpha 2.0.0 — Payment Sandbox Local
Laboratório exclusivamente local, sem chamadas ao Mercado Pago, credenciais, QR Codes ou cobranças reais. No carrinho crie um pedido de teste e abra Pagamentos de teste no menu. Escolha PIX, cartão ou boleto fictícios. O administrador pode emitir eventos simulados de aprovação, rejeição ou expiração. Aprovação libera a biblioteca demonstrativa. Rejeição/expiração permitem nova tentativa. Identificadores de eventos são deduplicados. O fluxo manual anterior continua disponível; não representa confirmação financeira. Faça backup da pasta data antes de migrar. Não publique em produção. A integração oficial, OAuth, split real e validação de webhooks externos permanecem pendentes.

## Alpha 2.0.0 — Payment Security
Ambiente exclusivamente local. Menu Segurança financeira: relatórios de pedidos aprovados e reembolsados, cancelamento de pedidos pendentes e reembolso integral fictício pelo administrador. Parceiros podem marcar uma vinculação fictícia, sem login externo ou credenciais. Novos pedidos são agrupados por vendedor, mas continuam com tentativas individuais por produto. Pedidos anteriores não são agrupados retroativamente. Eventos continuam restritos ao administrador e são idempotentes; não há webhook externo. Reembolso revoga a autorização daquele pedido (outras compras aprovadas do mesmo produto continuam válidas). Execute `npm test` para o teste de integração local. Não usar em produção.

## Alpha 2.0.0 — Arquitetura de pagamentos
- Gateway modular exclusivamente local (`gateway.mjs`), sem conexão externa.
- Segurança financeira > Abrir extrato e exportação CSV: busca por produto ou pedido, filtro de estado e exportação com valores em centavos; parceiros veem apenas suas vendas.
- Comissão individual e agrupamento de pedidos preservados. Pagamento único por grupo e OAuth externo não implementados.
- `npm test`: testes de cálculo, CSV e fluxo integrado anterior.

## Alpha 2.1.0 — Feedback visual
- Avisos persistentes entre telas, com sucesso, erro e informação.
- Indicador de solicitações, botões em processamento, bloqueio de ações simultâneas e limite de espera de 30 segundos.
- Animação da capa até o carrinho e destaque do contador; respeito à preferência por movimento reduzido.
- Não altera o banco ou integra pagamentos reais. Teste visual manual recomendado.

## Alpha 2.2.0 — Premium User Experience
Carrinho lateral ao clicar no cabeçalho (checkout permanece na página de carrinho), persistência local de IDs, histórico de até 30 notificações locais, contador de parceiros pendentes, skeleton do catálogo e diálogos personalizados para arquivar e operações financeiras de teste. Sair limpa carrinho e histórico. Não há envio de notificações por e-mail. Pagamentos continuam simulados. Progresso percentual de uploads, sons opcionais e transições gerais de páginas não implementados. Faça backup da pasta data antes de migrar.

## Alpha 2.6.0 — Promoções demonstrativas
- Painel > Promoções: administrador e parceiro podem cadastrar ofertas dos produtos autorizados, com preço e data de expiração. Apenas administrador cria cupons percentuais globais (1–90%, validade e limite de utilizações).
- No carrinho completo, clientes autenticados podem calcular o desconto e criar pedido de teste. O servidor recalcula o valor e registra o uso na mesma transação do pedido. Cupons podem acumular com ofertas. Um uso é contado por checkout criado, inclusive pendente; cancelamento não devolve o uso. A validade é verificada no momento do pedido.
- O preço original não é modificado; a vitrine exibe preço promocional quando vigente. Não há pagamentos reais. Sem contagem regressiva, campanhas por categoria ou relatórios avançados nesta versão.
- Atualização: parar o servidor, fazer backup e copiar a pasta data. Novas tabelas são criadas automaticamente.

## Alpha 2.7.0 — Digital Delivery Pro
- Menu Entregas e suporte (`#entregas`): histórico pessoal de downloads iniciados, chamados vinculados a pedidos de teste aprovados, respostas e encerramento.
- Vendedores e administradores podem identificar versões dos arquivos existentes. A biblioteca mostra a versão. Para manter versões anteriores, envie arquivos separados (limite anterior de cinco por produto).
- Chamados acessíveis apenas ao comprador, vendedor do pedido e administrador. Não envie informações confidenciais.
- Novas tabelas criadas automaticamente; faça backup e copie toda a pasta data com servidor desligado.
- Licenças, notificações de atualização, progresso de upload e relatórios de entregas continuam pendentes. Pagamentos exclusivamente locais e fictícios.

## Alpha 2.8.0 — Licenças demonstrativas
Acesse `#licencas` após login. Admin e parceiros ativos podem gerar de 1 a 100 chaves fictícias por operação para produtos autorizados. A aprovação de novos pedidos atribui uma chave única atomicamente; estoque esgotado impede a aprovação. A revogação oculta a chave, sem devolvê-la ao estoque. Pedidos já aprovados não recebem chaves retroativamente. Não há integração com ativação externa. Faça backup da pasta data antes de atualizar. Testes: npm test (6 aprovados). Interface visual não testada. Importação TXT, produtos gratuitos e progresso de uploads continuam pendentes.

## Alpha 2.9.0 — Upload avançado
- Progresso real do envio HTTP de imagens e arquivos, seguido de confirmação do servidor.
- Arquivos privados de até 20 MB (cinco por produto); imagens continuam até 3 MB.
- Autorização antes de ler o corpo ampliado de upload.
- Versão do arquivo exibida no painel.
- Ambiente local, pagamentos exclusivamente demonstrativos. Upload ainda usa JSON/base64 em memória, não streaming; não indicado para produção.
- Próximas fases: segurança de autenticação, testes de pagamento, auditoria e preparação para integração oficial sob responsabilidade do administrador.

## Alpha 3.0.0 — Payment Core & Security

Build exclusivamente local. `PAYMENT_MODE` aceita apenas `local_only` (padrão); qualquer outro valor impede a inicialização. Não há comunicação externa nem credenciais financeiras. O menu Núcleo de pagamentos (`#payment-core`) mostra o estado do gateway para administradores e parceiros ativos.

Requisições POST exigem JSON e rejeitam origens externas quando informadas; requisições de navegador explicitamente cross-site são rejeitadas. Cabeçalhos adicionais restringem enquadramento, referenciador e permissões do navegador. Não constitui auditoria de segurança ou proteção completa contra CSRF.

Checkout: o navegador reutiliza uma chave de idempotência durante a repetição de uma tentativa com o mesmo carrinho, enquanto a página permanecer aberta. O servidor guarda a chave por comprador e impede reutilização com outro carrinho; APIs antigas sem chave continuam aceitas por compatibilidade. Uma nova chave pode criar novo pedido. A tabela é criada automaticamente. Não há garantia de deduplicação entre abas, após recarregar a página ou com múltiplas instâncias do servidor.

Testes: npm test (8 casos passaram em Node 22.16.0); inclui repetição da chave, conflito de carrinho, acesso ao núcleo e testes de origem/formato. Interface não testada em navegador. Migração de banco existente não testada. Não publicar comercialmente.

## Alpha 3.1.0 — autorização local e proteção de login
- Núcleo de pagamentos: autorização demonstrativa e desvinculação do parceiro, sem OAuth externo.
- Cinco falhas de login por IP ou combinação IP/e-mail em dez minutos bloqueiam novas tentativas. Contadores em memória, reiniciados com o servidor; IP compartilhado pode afetar outros usuários.
- Sessões expiradas são removidas após login bem-sucedido.
- Identificador de checkout pendente mantido no navegador até resposta bem-sucedida. Não garante coordenação entre abas simultâneas.
- Testes: npm test (9 aprovados). Interface e migração não verificadas.
- Mercado Pago oficial, credenciais externas e cobranças reais não implementados.

## Alpha 3.2.0 — laboratório Mercado Pago offline
Acesse `/#mp32` como administrador ou parceiro ativo, ou o link no núcleo de pagamentos. O adaptador gera uma representação local de preferência Checkout Pro e valida respostas fictícias. Não utiliza API oficial, tokens, OAuth, split externo ou webhooks reais. Não libera pedidos. Nenhuma cobrança é possível por esse módulo. O sandbox anterior permanece intacto. A integração oficial requer implementação e homologação separadas pelo responsável comercial.

## Alpha 3.3.0 — Payment Configuration & Security
Acesse `/#mp33` como administrador, ou pelo link no núcleo de pagamentos. O diagnóstico local gera uma chave efêmera e uma credencial fictícia, testa AES-256-GCM e HMAC-SHA256 e registra a execução na auditoria. Não armazena credenciais, não implementa a assinatura oficial do Mercado Pago e não realiza conexões externas. OAuth continua demonstrativo. Não informe tokens reais. Execute `npm test` (13 testes aprovados no Node 22.16.0). Migração e interface no navegador não verificadas.

## Alpha 3.4.0 — validação financeira local
Acesse `/#mp34` como administrador (link no núcleo de pagamentos). O laboratório testa assinatura HMAC local, janela de cinco minutos, repetição no mesmo cenário, valor, moeda, referência e status. Os últimos 50 resultados são registrados na auditoria SQLite. Não recebe notificações externas, não utiliza credenciais reais e não altera pedidos. A proteção de repetição é limitada à execução de cada cenário; não é uma proteção persistente de webhooks oficiais. Testes: 14 aprovados em Node 22.16.0. Novas rotas HTTP e interface ainda não testadas especificamente.

## Alpha 3.5.0 — Segurança de sessões
- Bloqueios de login persistidos no SQLite, com expiração de 10 minutos.
- Tokens de sessão armazenados como digest SHA-256; a primeira migração encerra as sessões antigas. Entre novamente.
- Menu Sessões (#security35): consulta da quantidade de sessões válidas e revogação das outras sessões da própria conta.
- Antes de atualizar, pare o servidor e faça uma cópia integral da pasta data. Backup automático, CSRF por token e integração externa permanecem pendentes. Uso local demonstrativo apenas.

## Alpha 3.6.0
Admin: #security36. Conciliação local de pedidos e registros demonstrativos; pedidos legados sem registros são sinalizados, não corrigidos. Verificação SQLite de integridade e chaves estrangeiras com auditoria. Nenhuma conexão externa. Backup automático, CSRF por token e alteração de senha pendentes.

## Alpha 3.7.0 — Segurança de contas e backup local
- Menu Alterar senha (`/#security37`): exige senha atual, limita falhas, revoga todas as sessões ao concluir e registra a operação.
- Com o servidor parado, execute `npm run backup` na pasta do projeto. O script copia o banco SQLite por sua API de backup, verifica integridade e copia imagens e arquivos privados para `backups/omega-*`. O manifesto contém SHA-256 do banco. Proteja a pasta de backups: contém dados privados. Não é criptografada. Não execute com o servidor ativo; não há bloqueio automático de outros processos. Restauração é manual e não foi testada.
- Não há verificação individual de integridade dos arquivos digitais, CSRF por token, backup agendado ou integração externa nesta versão.

## Beta 4.2.0 — entrega de homologação

Novo painel administrativo `/#mp42`. Cria registros fictícios de R$ 49,90 e testa aprovação, pendência, reembolso, contestação, valores e recebedores divergentes e repetição de eventos. O estado de autorização fictícia é persistido no SQLite, separado dos pedidos e arquivos reais. Não há chamadas externas novas, nem liberação de arquivos ou cobranças reais. CSRF e autorização administrativa nas novas rotas. Os eventos são gerados pelo próprio laboratório, não são webhooks oficiais. OAuth, renovação automática e integração com pedidos reais permanecem pendentes de homologação. A restrição de credenciais da 4.1 permanece. Testes: 28 aprovados em Node 22.16.0, incluindo um novo teste de módulo. Interface e novas rotas HTTP não testadas separadamente. Faça backup da pasta data antes da atualização.

## Beta 4.3.0 — Auditoria financeira
Acesse #audit43 como administrador. Diagnóstico somente leitura: integridade SQLite, totais por vendedor, ambiente e estado, autorizações ausentes/expiradas/a expirar, alertas de registros inconsistentes e contagem de eventos. Não exibe tokens, não consulta a API e não altera pedidos. Os totais não são saldos reais. OAuth automático, checkout integrado aos pedidos, webhooks de parceiros, reembolsos oficiais e 2FA continuam pendentes. Faça backup e copie data com o servidor desligado. Execute npm test. Não use em produção.

## Beta 4.4.0 — Checkout de homologação

Acesse `/#checkout44` após entrar na conta. Selecione produtos de um único vendedor; o servidor usa preços atuais e ofertas válidas, sem cupons nesta rota. O administrador pode simular aprovação, rejeição, reembolso e divergência. O comprador vê somente seus registros; o administrador vê todos. A autorização de entrega é fictícia e não concede acesso à biblioteca ou aos arquivos. Nenhuma chamada externa é feita pelo novo módulo. Os registros são persistidos separadamente em `checkout44` e `checkout_events44`. A mesma chave de operação não cria outro pedido; eventos repetidos não reativam entregas revogadas. Os testes do módulo e a suíte anterior passaram (30 testes). Testes no navegador, migração de dados existentes e homologação externa permanecem pendentes. OAuth automático, webhooks externos de parceiros, reembolso oficial e 2FA não foram acrescentados. Para atualizar, encerre o servidor, faça backup e copie a pasta data da versão anterior.

## Beta 4.5.0 — Payment Gateway Finalization (homologação local)

- Painel administrativo `/#bridge45`: seleciona pedidos pendentes de `/#checkout44` e passa o snapshot de itens e preços ao construtor de preferências e ao cliente MP 4.0, com transporte exclusivamente fictício.
- Histórico SQLite com referência única por checkout, tentativas, erros e estado. Respostas inválidas e indisponibilidade podem ser repetidas com a mesma referência; interrupções locais são recuperáveis após reiniciar.
- Confirmação fictícia valida valor, moeda e referência; aprovação e reembolso não alteram o pedido original nem liberam arquivos. Sem split neste novo módulo. Nenhuma URL fictícia de checkout é apresentada para pagamento.
- Rotas administrativas protegidas por sessão e CSRF. O adaptador externo anterior permanece inalterado, com suas restrições e pendências.
- Execute `npm run dev` com Node 22.13+ e `npm test`. Para atualizar, pare a versão anterior, faça backup e copie a pasta data. Migração real e navegador não testados.
- Ainda pendentes: conexão externa homologada, webhooks dos parceiros, renovação automática OAuth, reembolsos oficiais, 2FA e integração comercial. Esta versão não é uma finalização da integração oficial.

## Beta 4.6.0 — autenticação em dois fatores
- MFA opcional TOTP (6 dígitos, SHA-1, 30 segundos), com chave manual e confirmação da senha atual.
- Segredos criptografados AES-256-GCM; oito códigos de recuperação aleatórios armazenados como hashes, de uso único. Ativação revoga sessões existentes; login exige segundo fator quando ativo.
- Configuração local: antes de iniciar, no PowerShell, gere uma chave exclusiva de 32 bytes com `$env:OMEGA_MFA_KEY = (node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))")`. Guarde-a em local seguro e reutilize a mesma chave nas próximas execuções; não publique nem inclua no ZIP. Sem chave o cadastro MFA fica desativado e contas já protegidas não conseguem autenticar.
- Painel: `/#security46`. Não há desativação ou recuperação administrativa nesta versão; preserve os códigos e a chave do servidor. Não utilize contas reais antes de validar o procedimento de recuperação. Backup anterior não inclui a variável de ambiente.
- Pagamentos mantidos como antes; não houve homologação externa. Sem QR code, rotação da chave, backup criptografado ou testes visuais/migração de banco existente.

## Beta 4.7.0 — recuperação e backups

Em `#security47`, uma conta com 2FA pode regenerar os oito códigos de recuperação ou desativar 2FA. Exige senha atual e um código TOTP novo (não um código de recuperação). Ambas as operações revogam todas as sessões; a regeneração invalida todos os códigos antigos. Não é recuperação administrativa de conta perdida.

O utilitário `backup47.mjs` cifra ou decifra um arquivo de backup já criado (por exemplo um ZIP da pasta de backup) com AES-256-GCM. Use uma chave aleatória independente de 32 bytes, em hexadecimal, mantida localmente na variável de ambiente `OMEGA_BACKUP_KEY`. Preserve a chave separadamente e nunca publique backups ou chaves. Execute `npm run backup` com servidor parado e compacte a pasta gerada antes de cifrar. Exemplo: `node backup47.mjs encrypt backup.zip backup.omega` e `node backup47.mjs decrypt backup.omega restauracao.zip`. O destino deve ser novo. O arquivo original não é apagado. A ferramenta lê o arquivo inteiro em memória; não é adequada para backups grandes. A decifragem verifica a autenticação antes de gravar. Não restaura automaticamente o banco nem verifica seu conteúdo SQLite. QR Code, recuperação administrativa, homologação externa e testes de migração continuam pendentes.

## Beta 4.8.0
- Monitoramento administrativo em `/#security48`, filtros de auditoria e diagnóstico básico de configuração, sem revelar credenciais.
- Com servidor parado, execute `npm run backup`, depois `node backup48.mjs create backups/omega-XXXX` e `node backup48.mjs verify backups/omega-XXXX` (substitua pela pasta efetiva). O inventário SHA-256 detecta alterações, inclusões e exclusões; não é uma assinatura autenticada. Mantenha a cópia e o manifesto protegidos, preferencialmente dentro do backup criptografado.
- Não altera o gateway financeiro. QR code, restauração automática, limites gerais de API e homologação externa ainda pendentes.

## Beta 4.9.0 — Final Beta
- API: limite local de 300 requisições por IP a cada 60 segundos, HTTP 429 e Retry-After. Contadores em memória, reiniciados com o processo; atrás de proxy o IP do proxy pode ser compartilhado. Não é proteção distribuída.
- Painel administrativo `#security49`: checklist local, não certifica produção.
- Recuperação: com servidor parado e backup confiável, execute `node backup48.mjs create backups/omega-XXXX` (somente se manifesto ainda não existir) e `node restore49.mjs backups/omega-XXXX data-restaurada`. O destino deve ser novo, não substitui `data`. Valide a cópia antes de qualquer troca manual. Preserve chaves externas; o manifesto SHA-256 não é autenticado. Não use backups de origem desconhecida.
- Pagamentos continuam em homologação; nenhuma mudança no gateway. QR code 2FA, monitoramento geral de erros, revisão visual e homologação externa pendentes.
- 39 testes locais aprovados com Node 22.16.0; novas rotas HTTP e migração real ainda não verificadas.

## 5.0.0 RC1 — estabilidade e organização

- Navegação agrupada em Minha conta, Gestão e Homologação, preservando links e restrições existentes.
- Ajustes CSS para telas estreitas, menus e tabelas; revisão visual em navegador ainda pendente.
- Cinco índices SQLite criados de forma idempotente para consultas de pedidos, sessões e produtos. Não há benchmark de desempenho.
- Teste HTTP de acesso administrativo ao diagnóstico, reinício com preservação de catálogo, versão da página e presença dos índices. Não equivale a migração de uma base real da Beta 4.9.
- 40 testes automatizados passaram no Node.js 22.16.0. Pagamentos permanecem sem habilitação comercial; homologação externa, QR Code 2FA e auditoria integral pendentes.
- Atualização: pare o servidor, faça backup, copie a pasta data e preserve as chaves existentes. Execute npm run dev. Para verificar, npm test.

## 5.0.0 RC2 — validação final
- Migração automatizada testada com esquema legado sintético, preservando conta, catálogo e preço, com PRAGMA integrity_check e foreign_key_check.
- Recuperação agora confere os hashes dos arquivos copiados antes de aceitar o destino; o original não é sobrescrito.
- Teste HTTP de rejeição de origem externa e acesso administrativo anônimo.
- 41 testes aprovados com Node.js 22.16.0. Sem testes de navegador, carga, banco real ou API externa.
- Execute `npm test` e `npm run dev` localmente. Antes da atualização, pare a RC1, faça backup e copie `data` para a RC2; preserve as chaves existentes.
- A operação comercial continua bloqueada. Não publique este servidor como serviço de produção; HTTPS, auditoria completa, QR Code TOTP e homologação financeira permanecem pendentes.

## 5.0.0 RC3 — validação de permissões

- Versão e rodapé atualizados para RC3. Novo teste HTTP cobre oito rotas administrativas, com administrador, cliente, parceiro ativo e visitante anônimo. Verifica também acesso dos usuários às próprias sessões.
- Executar `npm test` (42 testes locais aprovados no Node 22.16.0). Para iniciar, `npm run dev`. Node >=22.13.
- Atualização: parar a RC2, guardar cópia integral de `data` e preservar as chaves criptográficas separadamente; copiar os dados para a RC3 antes de iniciar. Testar primeiro com cópia, não com banco comercial.
- Checklist de homologação: validar interface em navegador e celular; medir carga; verificar restauração com cópia do banco existente; revisar todas as rotas e isolamento entre vendedores; validar HTTPS e proxy; confirmar QR Code 2FA; administrador responsável deve homologar OAuth, checkout, split, webhooks, reembolsos e entrega digital com o provedor. Não habilitar pagamentos comerciais antes dessas verificações.
- A RC3 não altera o gateway nem habilita produção. O relatório de prontidão permanece negativo. Não foram realizados testes externos, visuais ou de carga nesta evolução.

## 5.1.0 RC — Professional Experience
- Refinamento visual da loja, dos cartões, dos menus e dos temas claro/escuro.
- Painel de gestão com menu lateral ajustado, indicadores de produtos publicados e pedidos de teste aprovados, incluindo total bruto de teste (não receita real).
- Biblioteca digital com cartões, versões, tamanhos e pesquisa local por produto ou arquivo; permissões de download permanecem no servidor.
- Ajustes de responsividade e controles de formulário.
- 42 testes automatizados aprovados em Node 22.16.0. A tentativa de teste no Chromium foi bloqueada pela política do ambiente; validação visual ainda pendente.
- Sem alteração no gateway financeiro, sem homologação externa ou cobranças comerciais. Testes de carga, QR Code 2FA e revisão integral de permissões continuam pendentes.
- Atualização: interrompa a versão anterior, preserve backup da pasta data e chaves criptográficas, copie data para a nova versão e execute npm run dev.

## 5.2.0 RC — Professional Marketplace Experience
- Categorias rápidas, pesquisa sem distinção de acentos, múltiplas palavras, sugestões de até seis produtos e contador de resultados.
- Limpeza de filtros, vitrine pública do vendedor com contagem de produtos e navegação inferior mobile.
- Imagens com proporção reservada e renderização diferida dos cartões fora da tela; ganho de desempenho não medido.
- Corrige recuperação de favoritos locais malformados; novo módulo público servido com MIME JavaScript.
- O checkout e a integração financeira não foram modificados. Não há homologação externa ou ativação comercial.
- Atualização: com servidor parado, preserve backup, pasta data e chaves existentes. Node 22.13+, npm run dev, npm test.
- Testes de pesquisa e regressão locais; validação visual e carga permanecem pendentes.

## 5.3.0 RC — Business Intelligence
- `/#business53`: administrador e parceiro ativo; parceiro vê apenas seus produtos e pedidos. Períodos de 7, 30 ou 90 dias (UTC); valores brutos exclusivamente de pedidos demonstrativos aprovados.
- Indicadores e barras de aprovações diárias, contagem por situação, filtros de produtos por título/categoria e situação, paginação local de 15 itens e CSV dos produtos filtrados (preço em centavos).
- Não modifica o gateway financeiro. A paginação é no navegador, não no banco; sem benchmark ou teste visual. Não há receitas comerciais reais.
- Execute `npm test` e `npm run dev`. Preserve a pasta data e chaves da versão anterior após backup com servidor parado.

## 5.4.0 RC — Marketing & Sales Growth
- Nova central `/#marketing54`, disponível para administradores e parceiros ativos.
- Rankings de até 10 produtos e, para administradores, até 10 vendedores; agrupamento por categoria; períodos de 7, 30 ou 90 dias (dias UTC). Somente pedidos demo_approved, classificados por quantidade e valor bruto.
- Acompanhamento de ofertas existentes e, para administradores, cupons, com estados de validade e uso. Edição permanece em `/#promocoes`.
- Parceiros consultam somente seus próprios registros; sem exposição de cupons administrativos ou rankings de outros vendedores.
- 46 testes aprovados, incluindo teste unitário do relatório e extensão da matriz HTTP de permissões.
- Sem mudanças no gateway financeiro. Ainda não há homologação externa, testes visuais ou paginação SQL geral. Não foram implementadas campanhas novas, notificações ou ofertas relâmpago com contador.

## 5.5.0 RC — Advanced Storefront & Personalization

Administrador ativo: abra `/#storefront55` para configurar de 1 a 3 banners (título, descrição e ilustração local), selecionar até 12 produtos publicados e escolher a cor do banner (turquesa, azul ou roxo). Configuração persistida em SQLite, com auditoria. Produtos que deixarem de estar disponíveis não aparecem na seleção pública. Antes da primeira configuração, a vitrine anterior permanece como padrão. Após salvar, o editor 5.5 passa a controlar os banners; o anúncio antigo continua independente.

Não inclui upload de banners personalizados, ofertas relâmpago, coleções ou notificações. Pagamentos inalterados. Testes de navegador e HTTP específicos do editor pendentes. Execute `npm test` para os testes automatizados. Node 22.13+.

## 5.6.0 RC — CMS visual
Acesse `/#cms56` como administrador ativo. Reordene quatro seções, configure até seis coleções de até 12 produtos publicados, visualize o resumo e publique. O histórico permite restaurar as últimas 20 versões exibidas, criando uma nova revisão. Produtos indisponíveis são rejeitados na publicação/restauração e omitidos no catálogo público. O editor de banners 5.5 continua independente. Nenhuma alteração financeira. Upload de mídia, agendamento e prévia visual completa permanecem pendentes.

## 5.7.0 RC — Omega Media Studio
Acesse `/#media57` como administrador ativo. Envie PNG de até 2 MB (máximo 4096 por lado e 8 milhões de pixels; até 100 arquivos). Selecione logo, banner desktop e mobile e publique. A mídia fica no SQLite e acompanha o backup do banco. Imagens não selecionadas são acessíveis apenas ao administrador; imagens selecionadas são públicas. Remova uma imagem da configuração antes de excluí-la. A imagem de banner é uma camada visual comum aos slides; as ilustrações anteriores permanecem como fundo. Validação estrutural PNG com CRC, não decodificação completa ou antivírus. Não envie dados privados. JPEG/WebP, recorte, agendamento e revisão visual continuam pendentes. Gateway financeiro inalterado.

## 5.8.0 RC — campanhas e comunicados

Administrador: `#campaign58` permite programar título e mensagem, público (todos, clientes ou vendedores), início e fim e desativar campanhas. Horários são interpretados no fuso do navegador e armazenados em milissegundos UTC. Contas autenticadas: `#notices58` lista os comunicados ativos e permite marcar como lidos individualmente. O servidor aplica as janelas de validade e a segmentação; não há envio por e-mail, push, descontos automáticos ou integração financeira nova. Limites: 1000 campanhas no banco, 100 registros recentes por consulta. Teste unitário novo cobre segmentação, expiração, leitura e cancelamento. Testes visuais e HTTP específicos ainda pendentes. Execute `npm test` e `npm run dev` (Node 22.13+). Preserve data e chaves da versão anterior após backup e encerramento do servidor.
