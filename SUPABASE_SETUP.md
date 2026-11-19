# Supabase do Endo +

O app usa o projeto Supabase existente. Não é necessário criar outro banco para o piloto.

## Banco

Execute `supabase/schema.sql` pelo SQL Editor ou pela integração Supabase. Ele cria:

- `profiles`: perfil e objetivos pessoais, vinculados a `auth.users`.
- `metabolic_entries`: medidas, com unicidade por usuário e data.
- `habit_logs`: marcações de hábito, com unicidade por usuário, data e hábito.

As três tabelas usam RLS. Usuários autenticados podem ler, inserir e atualizar somente os próprios dados. Não há acesso anônimo às tabelas nem acesso profissional compartilhado nesta etapa.

O cadastro cria o perfil automaticamente. Usuários antigos sem perfil podem criá-lo no primeiro acesso por uma operação restrita ao próprio ID.

Para verificar o isolamento, execute `supabase/verify-patient-isolation.sql`. As contas e os registros sintéticos são criados dentro de uma transação e integralmente revertidos. O resultado esperado é `patient_isolation_passed`.

## URLs dos e-mails de autenticação

Em **Authentication > URL Configuration**, configure:

```text
Site URL:
https://endo-plus.vercel.app

Redirect URLs:
https://endo-plus.vercel.app/auth/callback
https://endo-plus.vercel.app/redefinir-senha
http://localhost:5173/auth/callback
http://localhost:5173/redefinir-senha
```

Mantenha a confirmação de e-mail ativa. O cadastro sem sessão exibe a orientação para confirmar o e-mail; ele não libera as telas internas. A recuperação envia o usuário à tela de nova senha, com mínimo de 8 caracteres e confirmação.

Para uso além de poucos testes, configure o provedor de envio de e-mail no Supabase e confira a entrega dos e-mails com a conta da clínica. O funcionamento dos links depende das URLs permitidas acima.

## Vercel

No projeto que atende `https://endo-plus.vercel.app`, configure as variáveis públicas nos ambientes correspondentes e publique novamente:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
VITE_GOOGLE_AUTH_ENABLED=false
```

Use a chave publishable habilitada do projeto. A aplicação rejeita chaves privadas `sb_secret_` e JWTs com papel `service_role`. As regras RLS, e não a visibilidade da chave pública, protegem os registros.

## Google, opcional

O botão só aparece quando `VITE_GOOGLE_AUTH_ENABLED=true`. Antes disso, ative o provedor Google no Supabase, cadastre o Client ID e o Client Secret diretamente no painel e configure o callback do projeto no Google Cloud:

```text
https://SEU-PROJECT-REF.supabase.co/auth/v1/callback
```

O retorno para o app é `/auth/callback`. O Client Secret nunca deve estar no frontend ou no repositório.

## Demonstração

Use o botão **Explorar demonstração**. Não crie uma conta pública com uma senha conhecida para demonstrar o produto. `supabase/seed-demo.sql` é um arquivo legado de desenvolvimento e não é necessário para este piloto.
