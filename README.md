# Casa Nova da Letícia: lista de presentes

Site do chá de casa nova: lista de presentes com Pix, reservas e dashboard da anfitriã.

| Pasta | O que é |
|---|---|
| `frontend/` | React + Vite: site público e dashboard `/admin` |
| `backend/` | API (Netlify Functions), migrações do Supabase e scripts |
| `design/` | HTML original do design: fonte dos dados importados |

Tudo roda em um único site na **Netlify**:
- `/api/*` vai para a function `api`
- o resto vai para a SPA

Banco e fotos ficam no **Supabase** (Postgres + Storage).

## Requisitos
- Node 20+
- Projeto Supabase: `dikrjwafzlcqlbhiwqcx`

## Setup local
```bash
npm install
cp .env.example .env   # preencha as variáveis abaixo
npm run dev            # netlify dev (front + API) → http://localhost:8888
```
Para rodar só o front: `npm run dev -w frontend` (http://localhost:5173).

### Variáveis de ambiente
Em produção ficam no painel da Netlify; localmente, no `.env` da raiz.

| Variável | De onde vem |
|---|---|
| `SUPABASE_URL` | Supabase → Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API (secreta, nunca no front) |
| `JWT_SECRET` | 48+ bytes aleatórios: `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` |
| `ADMIN_USERS` | `email:hash` por admin, separados por vírgula. Gere com `npm run hash-password -w backend -- voce@exemplo.com` (a senha é pedida no terminal) |
| `MELI_CLIENT_ID`, `MELI_CLIENT_SECRET` | opcionais: app do Mercado Livre para preencher o produto pelo link (veja "Preencher pelo link do Mercado Livre") |

## Front-end
React + Vite + TypeScript, portado do design: o CSS original fica em `src/styles/design.css` e as fontes em `src/assets/fonts`.

| Arquivo | O que tem |
|---|---|
| `src/content.ts` | textos, história, galerias, **chave Pix e WhatsApp**, planta e faixas de preço. Edite aqui e faça deploy |
| `src/pages/Home.tsx` | página pública: hero, sumário, história, planta + lista, vales |
| `src/components/PickModal.tsx` | "Vou presentear": levar / Pix / parte, QR Code, registro na API e mensagem do WhatsApp |
| `src/lib/pix.ts` | gera o Pix copia e cola (mesmo código do design, com testes) |

### Dashboard (`/admin`)
Login com um usuário do `ADMIN_USERS`; a sessão dura 12h e fica salva no navegador. O código do admin é carregado à parte (o convidado não baixa).

| Tela | O que faz |
|---|---|
| Presentes (`/admin`) | lista com busca (nome, chave ou convidado) e filtros por tipo, situação e cômodo; mostra quem escolheu e como |
| Novo / editar (`/admin/presentes/...`) | todos os campos, foto reduzida no navegador antes do upload, apagar com confirmação; abaixo, "Quem presenteou": corrigir/remover e lançar contribuição manual |
| Resumo (`/admin/resumo`) | escolhidos, quem vai levar, total esperado em Pix, vales, partes e todas as contribuições |

### Preencher pelo link do Mercado Livre
No formulário de presente, ao colar o link do produto no campo **Link do produto**, o nome, as especificações (marca, modelo, cor…), o valor e a foto são preenchidos sozinhos. Confira tudo antes de salvar. O botão "Atualizar com os dados do link" refaz o preenchimento, substituindo o que estiver nos campos.

O Mercado Livre bloqueia a leitura automática das páginas e fechou a API pública, então isso usa a **API oficial com um app seu** (grátis):
1. Entre em [developers.mercadolivre.com.br](https://developers.mercadolivre.com.br) com a sua conta do Mercado Livre e crie uma aplicação (os nomes dos campos podem variar um pouco; o redirect pode ser qualquer `https://…`).
2. Copie o **App ID** (client id) e a **Secret Key** do app.
3. No `.env`, preencha `MELI_CLIENT_ID` e `MELI_CLIENT_SECRET` e reinicie o `npm run dev`. Em produção, cadastre as mesmas duas variáveis na Netlify.

Sem essas chaves, ou se a API recusar o link, o formulário preenche só o nome (tirado do próprio endereço) e avisa; o resto fica manual. Funcionam links de anúncios (`…/p/MLB…?pdp_filters=item_id:MLB…`, `…/up/MLBU…`, `produto.mercadolivre.com.br/MLB-…`); links curtos (`meli.la/…`) não: abra o produto e copie o endereço completo. A foto é baixada pelo servidor, só do CDN do Mercado Livre (`mlstatic.com`).

Para o Pix e o botão do WhatsApp aparecerem, preencha `pix` e `whatsapp` em `src/content.ts`. Para as galerias, ponha as fotos em `public/photos/` e liste-as em `galleries`.

Testes: `npm test -w frontend`.

## Deploy (Netlify + GitHub)
1. Crie um repositório **privado** no GitHub e envie o código:
   `git remote add origin https://github.com/<você>/<repo>.git && git push -u origin main`
2. Na Netlify: **Add new site → Import from Git**, escolha o repo. Deixe o diretório base vazio (a raiz); o resto vem do `netlify.toml`.
3. Em **Site configuration → Environment variables**, crie (marque como secretas):
   `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `JWT_SECRET` (use outro valor, não o do `.env` local) e `ADMIN_USERS`.
4. **Deploys → Trigger deploy**. Depois confira:
   - `https://<site>.netlify.app/api/health` → `{"ok":true}`
   - a home lista 113 presentes; `/admin` pede login e entra com o seu usuário
   - em **Functions**, a `keepalive` aparece como agendada (diária)
5. Antes de divulgar: preencha `pix` e `whatsapp` em `frontend/src/content.ts` e faça push.

## Banco de dados
As migrações ficam em `backend/supabase/migrations/`:

| Migração | Conteúdo |
|---|---|
| `…_init.sql` | tabelas `products` e `contributions`, com RLS ligado e sem policies |
| `…_logic.sql` | view `public_products` (status sem nomes) e RPC `create_contribution` (reserva com lock) |
| `…_storage.sql` | bucket público `products` |

Só a API acessa o banco, usando a `service_role`. A anon key não lê nada.

Para aplicar em outro projeto:
```bash
cd backend && npx supabase link --project-ref <ref> && npx supabase db push
```

### Regras da reserva (`create_contribution`)

| Situação | Resultado |
|---|---|
| Item com `levar` ou `pix` | fica "escolhido". Uma segunda reserva retorna `PT409`, ou seja, HTTP 409 |
| `parte` | só em itens de R$ 600 ou mais. Não fecha o item |
| Vale (`cota`) | só por Pix, repetível. Com preço 0, o valor é livre e obrigatório |

## Importar os presentes do design
```bash
npm run import:design -- --check   # só confere o arquivo
npm run import:design              # envia as fotos e faz upsert dos produtos
```
Pode rodar de novo sem problema: faz upsert por `slug` e sobrescreve as fotos.

## API
Express rodando como Netlify Function (`backend/netlify/functions/api.ts`), com a lógica em `backend/src/`.
Os erros voltam como `{ "error": "<codigo>" }`, por exemplo `already_chosen`, `unauthorized` ou `invalid_body`.

### Pública
| Método e rota | O que faz |
|---|---|
| `GET /api/health` | checa a conexão com o banco |
| `GET /api/products` | lista os presentes com `status` (`livre`/`escolhido`). Nunca traz nomes nem o modo |
| `POST /api/products/:slug/contributions` | `{ guestName, mode: "levar"\|"pix"\|"parte", amountCents? }` → 201, 409 (já escolhido), 400 ou 404. Limite: 10 a cada 10 min por IP |

### Admin (`Authorization: Bearer <token>`)
| Método e rota | O que faz |
|---|---|
| `POST /api/auth/login` | `{ email, password }` → `{ token, expiresAt }` (válido por 12h). Limite: 5 por minuto |
| `GET /api/auth/me` | valida o token |
| `GET /api/admin/products` · `GET /api/admin/products/:id` | produtos com as contribuições (nomes e modo) |
| `POST /api/admin/products` | JSON ou multipart (campo `image`: jpg/png/webp até 4 MB). Sem `slug`, gera um a partir do nome |
| `PUT /api/admin/products/:id` | atualização parcial; `image` troca a foto, `removeImage: true` remove |
| `DELETE /api/admin/products/:id` | apaga o produto, as contribuições e a foto |
| `GET /api/admin/contributions?productId=` | lista as contribuições |
| `POST /api/admin/contributions` | lançamento manual `{ productSlug, guestName, mode, amountCents? }`, com as mesmas regras da reserva |
| `PUT /api/admin/contributions/:id` · `DELETE …/:id` | correção direta |
| `GET /api/admin/summary` | itens escolhidos, totais por modo, total em Pix, vales e partes |

A function `keepalive` roda uma vez por dia e faz uma consulta, para o Supabase free não pausar o projeto.

### Testes
```bash
npm test -w backend
```
Vitest + supertest com um repositório em memória. `test/lambda.test.ts` passa pelo `serverless-http`, como na Netlify.
