# Endo +

Aplicativo mobile-first para o piloto com pacientes da Clínica Endócrinos, em React, Vite, Tailwind CSS e Supabase.

Endereço público: [Endo +](https://endo-plus.vercel.app/).

## Fluxo do paciente

- Cadastro por e-mail, confirmação e login com senha.
- Recuperação de acesso e definição de uma nova senha pelo link enviado por e-mail.
- Perfil e objetivos pessoais editáveis.
- Registros de peso, cintura, sono, atividade, água e bem-estar, com uma anotação por data.
- Hábitos marcados por dia, compartilhados entre Início e Hábitos.
- Histórico por período, com gráfico das medidas registradas.
- Educação com links reais para o canal do Dr. Wallace Miranda.
- Sessão persistente, telas protegidas e logout.

Nenhum registro de paciente usa `localStorage` como banco. Em contas reais, dados são gravados no Supabase e as políticas RLS restringem leituras e escritas ao próprio usuário. As consultas também incluem filtros explícitos por usuário autenticado.

A demonstração é aberta pelo botão **Explorar demonstração**, sem cadastro. Ela usa dados fictícios em memória, mostra um aviso permanente e não aceita medidas pessoais nem alterações de perfil. Sem Supabase configurado, o login real fica indisponível: não há autenticação simulada silenciosa.

## Desenvolvimento

Use Node.js 22 ou 24 e pnpm.

```bash
pnpm install
pnpm run dev
pnpm test
pnpm run build
```

Copie `.env.example` para `.env.local` e use apenas a URL do projeto e a chave pública/publishable do Supabase. Nunca use `service_role` ou uma chave `sb_secret_` em uma variável `VITE_*`.

```text
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=chave-publica-do-projeto
VITE_GOOGLE_AUTH_ENABLED=false
```

O nome `VITE_SUPABASE_ANON_KEY` é mantido por compatibilidade e aceita a chave pública moderna `sb_publishable_...`.

## Banco e autenticação

Veja [SUPABASE_SETUP.md](SUPABASE_SETUP.md) para o esquema, as URLs de retorno e a configuração da Vercel.

- `supabase/schema.sql`: tabelas, validações, perfil automático e políticas RLS.
- `supabase/verify-patient-isolation.sql`: teste com duas contas sintéticas e rollback integral.
- `tests/`: validação de dados e contratos de consultas/gravações por usuário.

O login Google fica oculto até o provedor estar configurado e `VITE_GOOGLE_AUTH_ENABLED=true`. Cobranças, consultas e painel profissional não fazem parte desta etapa do piloto.

## Marca

`src/config/brand.js` centraliza o nome e os azuis da logomarca da Clínica Endócrinos. O ícone vetorial é `public/endo-plus-symbol.svg`, também usado como favicon.

## Estrutura

```text
src/components/  Interface, navegação e estados de carregamento
src/config/      Marca e cores
src/contexts/    Sessão e dados da conta atual
src/lib/         Configuração pública, datas e validação
src/screens/     Telas públicas, conta, registros e histórico
src/services/    Supabase Auth e repositório de pacientes
supabase/        Esquema e verificação de isolamento
tests/           Testes com node:test
```
