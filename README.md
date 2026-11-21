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
- Data de nascimento, sexo e altura opcionais somente no Perfil.
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
- Sono e movimento registrados com duração positiva marcam o hábito da mesma data, sem apagar escolhas manuais.
- Evolução com gráficos de peso e cintura, IMC e cintura/altura usando a altura vinculada à anotação.

Nenhum registro de paciente usa `localStorage` como banco. Em contas reais, dados são gravados no Supabase e as políticas RLS restringem leituras e escritas ao próprio usuário. As consultas também incluem filtros explícitos por usuário autenticado.

A demonstração é aberta pelo botão **Explorar demonstração**, sem cadastro.
Seu estado fictício fica no `sessionStorage` da aba e sobrevive a recarga e URLs
diretas. É possível experimentar medidas, hábitos e altura, sem chamadas de
gravação ao Supabase. Nome, nascimento, sexo e objetivos da conta não são
editáveis na simulação; não informe dados reais. Sair da demonstração limpa
seu cache. Tokens e identidades reais não são guardados nesse cache. Se o
navegador bloquear o armazenamento, a simulação funciona apenas em memória.
Sem Supabase configurado, o login real fica indisponível: não há autenticação
simulada silenciosa.

## Fase 1 aprovada

Em 21/11/2026, o responsável confirmou a validação clínica do IMC, da relação
cintura/altura e dos limites de altura, a conferência da prévia em iPhone/Safari
e Android/Chrome e autorizou a publicação. Essa conferência em aparelhos foi
informada pelo responsável, separadamente dos testes automatizados em Chrome.
`supabase/phase1-height.sql` foi aplicado ao banco de produção, sem preencher
medidas antigas. Não aponte testes de gravação para contas de pacientes.

Altura é opcional, em centímetros. A faixa de entrada de 30 a 300 cm é uma
barreira técnica de digitação, não uma faixa clínica de normalidade. Mudanças
nas fórmulas ou nesses limites exigem nova revisão clínica. Ao salvar medidas de hoje, a altura atual
do perfil é copiada para a anotação. Em datas anteriores, somente uma altura
já registrada é mantida; não há preenchimento retroativo. Alterar ou limpar
a altura do perfil não modifica as referências das anotações já salvas.

Os cálculos são funções puras em `src/lib/anthropometry.js`, sem categorias de
risco ou diagnóstico automático. Testes reproduzem os exemplos publicados:

- IMC: 70 kg e 175 cm resultam em 22,9 kg/m², conforme a [OMS, TRS 894, seção 2.3](https://iris.who.int/bitstream/handle/10665/42330/WHO_TRS_894.pdf?sequence=1).
- Cintura/altura: 96,5 cm / 170 cm resulta em 0,57, conforme a [NICE NG246](https://www.nice.org.uk/guidance/ng246/chapter/Identifying-and-assessing-overweight-obesity-and-central-adiposity).

Para revisar, inicie a aplicação local e abra **Explorar demonstração**. Visite
Educação pela URL e recarregue; a simulação deve continuar. Em Perfil, altere
uma altura fictícia; em Meu registro, salve medidas fictícias de hoje e confira
as métricas e o gráfico de cintura em Evolução. Registros antigos sem altura
devem indicar que não há cálculo. Esse roteiro também serve para futuras revisões.

## Desenvolvimento

A prévia isolada da Fase 2 está descrita em [PHASE2_REVIEW.md](PHASE2_REVIEW.md).
Ela exige ativação explícita, funciona somente na demonstração e não modifica
o banco nem os acessos da versão oficial.

A preparação da conexão a contas está em [PHASE2_INTEGRATION.md](PHASE2_INTEGRATION.md).
Ela permanece desabilitada por padrão e não foi aplicada ao Supabase remoto.

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
