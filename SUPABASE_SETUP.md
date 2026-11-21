# Supabase do Endo +

O app usa o projeto Supabase existente. Não é necessário criar outro banco para o piloto.

## Banco

Execute `supabase/schema.sql` pelo SQL Editor ou pela integração Supabase. Ele cria:

- `profiles`: perfil e objetivos pessoais, vinculados a `auth.users`.
- `metabolic_entries`: medidas, com unicidade por usuário e data.
- `habit_logs`: marcações de hábito, com unicidade por usuário, data e hábito.

As três tabelas usam RLS. Usuários autenticados podem inserir e atualizar somente
os próprios dados. O compartilhamento descrito abaixo acrescenta apenas leitura
de medidas e hábitos por médicos explicitamente autorizados. Não há acesso anônimo.

O cadastro cria o perfil automaticamente. Usuários antigos sem perfil podem criá-lo no primeiro acesso por uma operação restrita ao próprio ID.

Em bancos já existentes, aplique `supabase/profile-demographics.sql` antes de
publicar o formulário com data de nascimento e sexo. O script adiciona apenas
duas colunas opcionais em `profiles`, com validação de data e opções de sexo.
Não preenche informações de pacientes nem altera permissões ou políticas RLS.
Os campos podem ser deixados em branco ou removidos pelo próprio usuário.

Para verificar o isolamento, execute `supabase/verify-patient-isolation.sql`. As contas e os registros sintéticos são criados dentro de uma transação e integralmente revertidos. O resultado esperado é `patient_isolation_passed`.

## Acesso médico por autorização

Depois de `schema.sql` e da atualização de dados pessoais, aplique uma vez
`supabase/doctor-sharing.sql`. Ele cria `doctor_profiles` e `patient_shares`,
ambas com RLS, e funções restritas ao usuário autenticado. As implementações com
privilégios elevados ficam em `endo_private`, fora do esquema exposto; os RPCs
públicos usam direitos do chamador e não aceitam um ID de paciente para autorizar
ou revogar acesso. Essa identidade sempre vem de `auth.uid()`.

Não exponha `endo_private` nas configurações da Data API. As permissões de
escrita do paciente não são ampliadas para médicos. O médico lê apenas o perfil
compartilhado (sem e-mail) e o histórico autorizado; não ganha acesso direto à
tabela completa de perfis. Cadastros profissionais são declarados, não verificados.

Execute `supabase/verify-doctor-sharing.sql` para conferir dois pacientes e dois
médicos, múltiplas autorizações, renovação, expiração, revogação, bloqueio de
escrita e isolamento. Os testes terminam em rollback e não deixam contas sintéticas.

Para permitir códigos personalizados, aplique depois
`supabase/doctor-code-customization.sql`. Apenas a coluna `share_code` fica
editável pelo próprio médico, com RLS e privilégio de coluna. Nome, CRM, ID e
datas continuam protegidos. Os códigos devem ter 6 a 24 letras maiúsculas ou
números. A interface normaliza o texto antes de enviar.

As reservas de códigos ficam na tabela privada
`endo_private.doctor_code_reservations`, sem acesso direto pelos clientes.
O trigger reserva os códigos novos e antigos, inclusive após exclusão da conta,
para impedir reutilização por outra identidade. Não altere essas reservas pelo
frontend. `supabase/verify-doctor-codes.sql` testa edição, colisões, reservas,
normalização, isolamento e preservação das autorizações, sempre com rollback.

## Outros profissionais de saúde

Depois dos scripts anteriores, aplique uma vez `supabase/health-professionals.sql`.
Ele adiciona profissão e conselho ao cadastro, com padrões Medicina e CRM para
cadastros existentes. Os nomes internos `crm`, `crm_state` e `doctor_id` são
mantidos por compatibilidade. O CRM continua numérico; outros registros aceitam
até 30 caracteres, com letras, números, ponto, barra, espaço e hífen.
Nenhum código ou autorização existente é alterado.

Nome, profissão, conselho e registro são imutáveis pela API após o cadastro;
só o código permanece editável. Os RPCs `endo_lookup_professional` e
`endo_my_professionals` incluem profissão e conselho sem diretório público.
Cada acesso depende de confirmação individual do paciente. O registro é
autodeclarado, sem validação automática pelo conselho.

Execute `supabase/verify-health-professionals.sql` para conferir dois médicos,
nutricionista e psicólogo, renovação sem duplicar, revogação e expiração
independentes, isolamento e proibição de escrita. As contas sintéticas são
integralmente revertidas. Resultado: `health_professionals_passed`. Execute
também os três scripts de verificação anteriores para conferir compatibilidade.

## URLs dos e-mails de autenticação

Em **Authentication > URL Configuration**, configure:

```text
Site URL:
https://endoplus.vercel.app

Redirect URLs:
https://endoplus.vercel.app/auth/callback
https://endoplus.vercel.app/redefinir-senha
https://endoplus.vercel.app
https://endo-plus.vercel.app/auth/callback
https://endo-plus.vercel.app/redefinir-senha
https://endo-plus.vercel.app
http://localhost:5173/auth/callback
http://localhost:5173/redefinir-senha
```

Mantenha a confirmação de e-mail ativa. O cadastro sem sessão exibe a orientação para confirmar o e-mail; ele não libera as telas internas. A recuperação envia o usuário à tela de nova senha, com mínimo de 8 caracteres e confirmação.

Para uso além de poucos testes, configure o provedor de envio de e-mail no Supabase e confira a entrega dos e-mails com a conta da clínica. O funcionamento dos links depende das URLs permitidas acima.

## Vercel

No projeto que atende `https://endoplus.vercel.app`, configure as variáveis públicas nos ambientes correspondentes e publique novamente:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
VITE_GOOGLE_AUTH_ENABLED=false
```

Use a chave publishable habilitada do projeto. A aplicação rejeita chaves privadas `sb_secret_` e JWTs com papel `service_role`. As regras RLS, e não a visibilidade da chave pública, protegem os registros.

## Google, opcional

Use `https://endoplus.vercel.app` nas origens JavaScript autorizadas do cliente
Google. O callback do Supabase permanece no mesmo projeto, sem mudar com o nome
do domínio público do app.

O botão só aparece quando `VITE_GOOGLE_AUTH_ENABLED=true`. Antes disso, ative o provedor Google no Supabase, cadastre o Client ID e o Client Secret diretamente no painel e configure o callback do projeto no Google Cloud:

```text
https://SEU-PROJECT-REF.supabase.co/auth/v1/callback
```

O retorno para o app é `/auth/callback`. O Client Secret nunca deve estar no frontend ou no repositório.

## Demonstração

Use o botão **Explorar demonstração**. Não crie uma conta pública com uma senha conhecida para demonstrar o produto. `supabase/seed-demo.sql` é um arquivo legado de desenvolvimento e não é necessário para este piloto.
