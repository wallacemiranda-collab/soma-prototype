# Endo +

Aplicativo mobile-first para o piloto com pacientes da Clínica Endócrinos, em React, Vite, Tailwind CSS e Supabase.

Endereço público: [Endo +](https://endoplus.vercel.app/).

Os endereços antigos `soma-prototype-nc87.vercel.app` e `endo-plus.vercel.app`
redirecionam para o endereço oficial, preservando o caminho e os parâmetros.
A mudança de domínio não altera contas nem registros; o navegador pode pedir
um novo login porque as sessões são armazenadas separadamente por domínio.

## Fluxo do paciente

- Cadastro por e-mail, confirmação e login com senha.
- Recuperação de acesso e definição de uma nova senha pelo link enviado por e-mail.
- Perfil e objetivos pessoais editáveis.
- Data de nascimento e sexo opcionais em Meu registro e Perfil, salvos na conta.
- Registros de peso, cintura, sono, atividade, água e bem-estar, com uma anotação por data.
- Hábitos marcados por dia, compartilhados entre Início e Hábitos.
- Histórico por período, com gráfico das medidas registradas.
- Educação com links reais para o canal do Dr. Wallace Miranda.
- Sessão persistente, telas protegidas e logout.
- Entradas de paciente e profissional de saúde, com a mesma autenticação e áreas distintas.
- Cadastro profissional declarado (nome, profissão, conselho, registro e UF), com código próprio.
- Paciente autoriza vários médicos e outros profissionais por 7, 30 ou 90 dias, ou até revogar.
- Cada profissional consulta somente os pacientes que autorizaram seu acesso, sem editar registros.
- Todo o histórico é carregado em páginas, inclusive registros com mais de um ano.

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

Veja [TESTING.md](TESTING.md) para os testes de navegador, a checagem do site publicado e os limites de cada verificação. As suítes de interface usam contas sintéticas e não alteram os dados dos pacientes.

O login Google fica oculto até o provedor estar configurado e `VITE_GOOGLE_AUTH_ENABLED=true`. Cobranças e consultas médicas não fazem parte desta etapa do piloto.

## Equipe de saúde

Na entrada **Sou profissional de saúde**, o profissional conclui seu cadastro e fornece o código
ao paciente. O paciente abre **Minha equipe de saúde** ou **Compartilhar evolução**, busca esse código,
confere nome, profissão, conselho e registro declarados, escolhe o prazo e confirma a autorização.
Pode repetir a operação para adicionar outros médicos, nutricionistas, psicólogos
e outros profissionais, sem substituir acessos existentes. Renovar ou revogar
uma autorização não altera as demais.
Nenhum paciente é associado automaticamente. O e-mail da conta não é incluído
no perfil compartilhado. A seleção de entrada serve apenas à navegação; não é
uma permissão administrativa nem usa `user_metadata` para autorizar leituras.

Cada profissional pode personalizar seu código com 6 a 24 letras e números (por exemplo,
`DRWALLACE`). A busca ignora maiúsculas/minúsculas, espaços e hífens. O código
precisa estar disponível; códigos anteriores ficam reservados ao titular para
evitar que outro profissional assuma um identificador antigo. As autorizações
existentes continuam vinculadas ao UUID da conta, sem mudar com o código.

O registro tem validação de formato, não consulta automática ao conselho. Não
apresente o cadastro como identidade profissional verificada. Nome, profissão, conselho e registro ficam
imutáveis pela API após o cadastro. A revisão de identidade e um processo de
correção administrativa ainda precisam ser definidos para a operação comercial.

A revogação bloqueia novas leituras no banco imediatamente. A tela profissional
reconfere a autorização ao receber foco e a cada 30 segundos, limpando os dados
se o acesso não puder ser confirmado. Isso não apaga cópias obtidas anteriormente.
Esta entrega não constitui prontuário certificado, teleconsulta, diagnóstico,
cobrança integrada ou conclusão das adequações jurídicas e operacionais.

A área é `/profissional`; os links antigos em `/medico` continuam funcionando.
Os nomes internos `doctor_profiles`, `doctor_id` e os métodos `*Doctor*` foram
mantidos por compatibilidade com as identidades e autorizações já existentes.
Os novos RPCs de consulta incluem a profissão e o conselho, sem e-mail ou selo de verificação.

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
