# SOMA Supabase Setup

Use este checklist para ligar o protótipo SOMA a dados reais.

## 1. Criar projeto

1. Acesse o Supabase.
2. Crie um novo projeto.
3. Guarde:
   - Project URL
   - anon public key

## 2. Criar tabelas

No Supabase, abra:

```text
SQL Editor > New query
```

Cole e execute o conteúdo de:

```text
supabase/schema.sql
```

Isso cria:

- `profiles`
- `metabolic_entries`
- `habit_logs`
- políticas RLS
- trigger para criar perfil automaticamente a partir de `auth.users`

## 3. Criar usuário demo

No Supabase:

```text
Authentication > Users > Add user
```

Sugestão para teste:

```text
Email: marina@soma.app
Password: soma1234
```

Depois, no SQL Editor, rode:

```text
supabase/seed-demo.sql
```

## 4. Configurar local

Crie `.env.local`:

```bash
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anon-publica
```

Rode:

```bash
pnpm install
pnpm run dev
```

## 5. Configurar Vercel

Na Vercel:

```text
Project Settings > Environment Variables
```

Adicione:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

Depois faça um novo deploy.

## 6. Autenticação

O app já usa Supabase Auth quando as variáveis existem.

Funcionalidades prontas:

- Entrar com e-mail e senha.
- Criar conta com nome, e-mail e senha.
- Manter sessão ativa.
- Proteger telas internas.
- Sair da conta pelo Perfil.

Sobre confirmação de e-mail:

- Se a confirmação estiver ligada no Supabase, o usuário verá a mensagem para confirmar o e-mail antes de entrar.
- Se a confirmação estiver desligada, o cadastro leva diretamente para o app.

Para ajustar:

```text
Authentication > Providers > Email
```

Configure conforme o piloto comercial.

## 7. Estado atual do app

Sem variáveis, o app continua em modo demo para não quebrar o protótipo.
