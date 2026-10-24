# LOJA DE CLIMATIZADORES — GUIA PASSO A PASSO

**Projeto:** Brisa Casa (NOME TEMPORÁRIO; substitua pelo da sua empresa).  
**Objetivo:** site responsivo de climatizadores residenciais, catálogo, carrinho, cadastro/login, checkout, acompanhamento de pedidos e painel para cadastrar produtos.  
**Tecnologias:** React + Vite (site), GitHub Pages (hospedagem do site), Supabase (usuários, banco e funções), Mercado Pago (pagamento externo seguro).

> **ATENÇÃO:** o pacote começa em **modo demonstração**. Produtos, nomes, preços, descrições e ilustrações são fictícios. **Nenhum pagamento real está habilitado** até configurar a loja, cadastrar produtos reais, definir frete, implantar as funções e fazer testes. Não utilize os exemplos para anunciar mercadorias reais.

## 1. O que cada serviço faz?

- **GitHub:** armazena os arquivos e publica o site estático no GitHub Pages. GitHub Pages, sozinho, não é servidor para fazer login ou cobrar cartões.
- **Supabase:** banco de dados, autenticação dos clientes, pedidos, acesso administrativo e funções de backend protegidas.
- **Mercado Pago:** recebe pagamentos no ambiente seguro do próprio Mercado Pago. **Nunca digite a chave secreta no código do site ou no GitHub.**

## 2. Ver o site no seu computador (antes de publicar)

1. Instale o **Node.js LTS** em https://nodejs.org/ .
2. Instale o **Visual Studio Code** em https://code.visualstudio.com/ .
3. Extraia este ZIP para uma pasta (ex.: `C:\loja-climatizadores`).
4. Abra essa pasta com **Arquivo > Abrir Pasta** no VS Code.
5. No VS Code abra **Terminal > Novo Terminal** e digite, um comando por vez:

   ```bash
   npm install
   npm run dev
   ```

6. Abra no navegador o endereço que o terminal mostrar (geralmente `http://localhost:5173`).
7. Você já poderá navegar no site, filtrar modelos, ver detalhes e testar o carrinho de demonstração. O cadastro e os pagamentos precisam do Supabase.

## 3. Trocar nome da empresa, contatos e produtos

Abra `src/config.ts` e substitua:

- `nome`: nome real da empresa.
- `whatsapp`: número no formato `55` + DDD + número, sem espaços (ex.: `5511999999999`).
- `email`, `cidade`, `cnpj`, `endereco`: dados reais da empresa.

Abra `index.html` e substitua o título e a descrição para refletirem a marca verdadeira. Para retirar produtos fictícios, basta cadastrar **um produto real ativo no Supabase** (veja abaixo): os produtos de demonstração deixam de aparecer. No painel administrativo, informe fotos reais hospedadas em URLs HTTPS.

## 4. Criar o Supabase

1. Abra https://supabase.com/ e crie seu projeto.
2. No menu do projeto entre no **SQL Editor** > **New query**.
3. Abra o arquivo `supabase/migrations/001_loja.sql`, copie todo o texto e cole no SQL Editor. Execute (`Run`).
4. Em **Authentication > Providers**, mantenha `Email` ativado. É recomendável confirmar e-mails e configurar SMTP próprio antes de lançar a loja.
5. Vá em **Project Settings > API Keys** ou **Connect** e copie a **Project URL** e a chave **Publishable / anon (pública)**. Nunca copie `service_role` ou `secret` para o frontend.
6. Na raiz do projeto, crie `.env` com base no arquivo `.env.example` e preencha `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
7. Reinicie o site: `Ctrl+C` no terminal, e depois `npm run dev`.
8. Abra a loja, entre em Minha Conta e **Cadastre-se**. Confirme o e-mail recebido se a confirmação estiver ativada.
9. Volte ao Supabase, em **Authentication > Users**, copie o `User UID` da SUA conta.
10. No SQL Editor execute, substituindo o UID pelo valor real:

   ```sql
   update public.profiles
   set role = 'admin'
   where id = 'COLE-O-UID-DA-SUA-CONTA-AQUI';
   ```

11. Saia e entre novamente na conta da loja. Abra **Minha conta > Painel administrativo**. Cadastre produtos reais, preços, fotos, estoque e informações que você pode comprovar.
12. No painel, informe o **valor fixo do frete** (R$) para todos os pedidos. **Esse protótipo utiliza um único frete fixo:** só use se a sua área de entregas e precificação realmente permitirem essa regra. Ainda não possui cálculo automático pelos Correios/transportadoras nem restrição por CEP.

**Atenção:** a função `create-checkout` valida os valores e quantidades no Supabase, não confia no preço enviado pelo navegador.

## 5. Criar sua integração Mercado Pago (backend)

1. Acesse https://www.mercadopago.com.br/developers/pt .
2. Crie uma aplicação vinculada à conta comercial que receberá os valores.
3. Habilite o Checkout Pro via **Orders API**, preferencialmente com credenciais de teste antes de produção.
4. No Supabase vá em **Edge Functions > Secrets** e crie estes segredos:
   - `MERCADOPAGO_ACCESS_TOKEN` = chave **privada** de teste, e depois de produção, obtida no Mercado Pago.
   - `MERCADOPAGO_WEBHOOK_SECRET` = chave de assinatura secreta gerada na configuração de Webhooks do Mercado Pago.
   - `SITE_URL` = URL HTTPS pública completa da loja, inclusive a subpasta do GitHub Pages e barra final. Ex.: `https://SEU_USUARIO.github.io/loja-climatizadores/`. Quando comprar domínio, mude para `https://www.seudominio.com.br/`.
5. O Supabase fornece automaticamente variáveis internas como `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` para as funções. **Não exponha a chave service role nem o Access Token do Mercado Pago.**
6. Vá em **Edge Functions > Deploy a new function > Via Editor**. Crie função com nome **`create-checkout`**. Copie o conteúdo completo de `supabase/functions/create-checkout/index.ts` para o editor e publique.
7. Desative **Verify JWT** na configuração de `create-checkout`. **IMPORTANTE:** essa função valida o token do usuário com `auth.getUser()` dentro do código, portanto continua exigindo usuário autenticado. A desativação é apenas do filtro automático da plataforma, para compatibilidade com chaves atuais.
8. Crie e publique a segunda função **`mercadopago-webhook`**, copiando `supabase/functions/mercadopago-webhook/index.ts`. Também desative **Verify JWT** para ela; o provedor não envia JWT Supabase, mas o código exige a assinatura HMAC correta.
9. No Mercado Pago, configure o Webhook do evento **Orders / Order**, com a URL:

   ```text
   https://SEU_PROJECT_REF.supabase.co/functions/v1/mercadopago-webhook
   ```

10. Revele a **assinatura secreta do webhook** no Mercado Pago e configure em `MERCADOPAGO_WEBHOOK_SECRET` no Supabase. A notificação deve ser testada pelo painel oficial do Mercado Pago.
11. Teste uma compra com credenciais de **teste** e conta compradora de testes. Verifique o pedido em **Minha conta** e no banco `public.orders`. O pedido só fica confirmado após o backend consultar o Mercado Pago.
12. Só depois de validar compra aprovada, pendente e falha, habilite credenciais de produção e faça testes controlados.

> **Importante:** este é um ponto de partida para lançar sua loja, não uma solução de operação logística completa. A reserva atômica de estoque e integração real com transportadoras ainda não estão implementadas; evite vender itens de estoque crítico sem revisão desse fluxo. A decretação de estoque ocorre quando o pagamento é confirmado. Também revise o comportamento de estornos/contestações antes de operar em escala.

## 6. Colocar o site no GitHub Pages

1. Acesse https://github.com/ e crie sua conta se ainda não tiver.
2. Clique em **New repository**, nomeie (ex.: `loja-climatizadores`), deixe público se usar GitHub Pages Free. Não coloque senhas ou `.env` no repositório.
3. Clique em **uploading an existing file** e arraste o conteúdo da pasta descompactada, incluindo `.github/workflows/deploy.yml`, `src/`, `supabase/`, `package.json`, `index.html` e `vite.config.ts` (não carregue `node_modules`). Se o upload web ignorar pastas ocultas, envie `.github/workflows/deploy.yml` separadamente pela interface ou use Git no VS Code.
4. Faça **Commit changes** na branch `main`.
5. No repositório abra **Settings > Pages**. Em **Build and deployment**, selecione **GitHub Actions**.
6. Em **Settings > Secrets and variables > Actions > Variables**, adicione:
   - `VITE_SUPABASE_URL`: URL HTTPS do Supabase.
   - `VITE_SUPABASE_ANON_KEY`: chave pública do Supabase.
   - `VITE_BASE_PATH`: se a URL for `https://seuusuario.github.io/loja-climatizadores/`, configure `/loja-climatizadores/` (com as duas barras). Se usar domínio próprio, use `/`.
7. Abra a guia **Actions**, selecione o fluxo **Publicar no GitHub Pages** e verifique a publicação. Em alguns casos, é necessário executar **Run workflow**.
8. A loja será publicada em um endereço semelhante a `https://SEU_USUARIO.github.io/loja-climatizadores/`.
9. Em Supabase **Authentication > URL Configuration**, configure Site URL e URLs permitidas de redirecionamento para o endereço HTTPS do site. Configure também o `SITE_URL` nos Secrets das Edge Functions, incluindo a barra final.

Documentação oficial de Actions: https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages

## 7. Quando comprar um domínio

1. Compre o domínio em registrador da sua escolha.
2. No repositório, vá em **Settings > Pages > Custom domain** e informe seu domínio.
3. Siga as instruções de DNS do GitHub Pages para `www` e/ou domínio raiz, conforme sua preferência; habilite **Enforce HTTPS** quando disponível.
4. Ajuste `VITE_BASE_PATH` para `/` nas variáveis do GitHub e publique novamente.
5. Atualize **SITE_URL** nos Secrets do Supabase e o endereço de redirecionamento em **Authentication > URL Configuration**.
6. Teste novamente os retornos do checkout e o cadastro de usuários.

## 8. Checklist antes de aceitar vendas reais

- [ ] Nome, identidade visual, empresa, CNPJ, endereço, e-mail e WhatsApp reais.
- [ ] Marcas, fotos autorizadas, estoque, valores, ficha técnica, consumo de energia, voltagem e prazo de garantia de cada climatizador conferidos.
- [ ] Região de atendimento, política de frete e prazos de entrega confirmados. (O sistema inicial suporta somente frete fixo.)
- [ ] Supabase Auth com confirmação de e-mail e serviço SMTP adequado.
- [ ] Mercadopago Checkout Pro Orders API configurado em ambiente de teste e Webhook validado.
- [ ] Testar pagamento aprovado, pendente, recusado, reembolso, estoque e disputa/chargeback.
- [ ] Páginas de privacidade, termos e trocas adaptadas à operação, com revisão jurídica, inclusive obrigações de comércio eletrônico e LGPD.
- [ ] Não publicar `.env`, `service_role`, Access Token, senha ou segredo de Webhook no GitHub.
- [ ] Regras de operação/estoque revisadas por desenvolvedor antes de alto volume de pedidos.
- [ ] Testar tudo em celular e PC antes de iniciar anúncios.

## 9. Estrutura dos principais arquivos

| Arquivo | Função |
|---|---|
| `src/config.ts` | Marca e contatos. |
| `src/demo.ts` | Produtos fictícios de demonstração. |
| `src/App.tsx` | Vitrine, carrinho, cadastro, histórico e painel. |
| `src/styles.css` | Layout, cores, responsividade. |
| `supabase/migrations/001_loja.sql` | Banco e regras de segurança (RLS). |
| `supabase/functions/create-checkout/index.ts` | Cria pedidos e inicia pagamento com valores calculados no servidor. |
| `supabase/functions/mercadopago-webhook/index.ts` | Valida assinatura, verifica situação no Mercado Pago e atualiza pedido. |
| `.github/workflows/deploy.yml` | Publicação automática pelo GitHub Actions. |

### Limitações atuais

O pacote não inclui integração de transportadora/Correios, emissão automática de nota fiscal, painel logístico avançado, upload direto de fotos, integração de ERP, rastreamento de envio, mecanismo de reserva de estoque antes da cobrança, cupons e e-mails transacionais personalizados. As políticas jurídicas são rascunhos de referência, não versões finais. É necessário testar os serviços externos com suas contas antes de liberar pagamentos reais. A estrutura foi escrita e validada sintaticamente, mas não foi possível executar uma compilação completa local nesta sessão devido à falta de acesso para instalar dependências.
