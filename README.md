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
cp .env.example .env   # preencha SUPABASE_SERVICE_ROLE_KEY
npm run dev            # netlify dev (front + API) → http://localhost:8888
```
Para rodar só o front: `npm run dev -w frontend` (http://localhost:5173).

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
