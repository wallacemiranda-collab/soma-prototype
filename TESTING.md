# Testes do Endo +

Use Node.js 22 ou 24 e instale as dependências com `pnpm install`.

## Regras e consultas

```bash
pnpm test
```

Executa os testes de valores, datas, campos opcionais, configuração pública, autenticação sem backend, consultas por usuário e tratamento de erros. Não acessa o Supabase.

## Interface com backend simulado

```bash
pnpm exec playwright install chromium
pnpm test:e2e
```

A suíte inicia um Vite temporário na porta 4174, usa o domínio fictício `https://endo-tests.invalid` e intercepta todas as chamadas desse backend. Não usa contas, chaves ou registros de pacientes reais. As contas sintéticas são independentes em cada teste.

Cobre registro e edição de medidas, campos vazios e limites, recarga, separação por data, hábitos, erros de gravação e carregamento, perfil, troca de conta, logout, confirmação de cadastro, recuperação de senha e navegação em 320 px.

Inclui data de nascimento e sexo opcionais: persistência entre Meu registro e
Perfil, remoção dos valores, bloqueio de datas futuras, preservação dos
objetivos existentes e recuperação após falhas de gravação. Se o perfil for
salvo e a medida falhar, a interface informa a gravação parcial e permite
repetir o envio sem duplicar o registro.

Os testes de compartilhamento cobrem as duas entradas, cadastro profissional,
busca por código, autorização explícita, vários médicos, consulta somente
leitura, bloqueio de URL sem autorização, revogação com limpeza da tela médica,
falhas de gravação e consulta/edição de histórico anterior a um ano.

Também é possível usar uma instalação local do Chrome, sem baixar o Chromium:

```bash
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" pnpm test:e2e
```

O resumo sai no terminal; capturas e rastros de falha ficam em `test-results/`, fora do Git. Não habilite gravação de sessões reais de pacientes nesses testes. O servidor temporário é encerrado ao final da execução.

## Site publicado

```bash
pnpm test:public
```

Confere `https://endoplus.vercel.app`, páginas públicas, proteção de rotas, navegação da demonstração e retorno ao início após abrir um formulário protegido. Usa `node:test` e controla diretamente um navegador isolado, sem o executor de workers da suíte local. Não cadastra usuários, não envia e-mails e não salva dados no Supabase. O resumo sai no terminal e o navegador é fechado ao final.

`tests/domains.test.js` confere que os redirecionamentos de produção são
restritos aos dois domínios antigos, mantêm os caminhos e não afetam o endereço
oficial nem deployments de preview. No site publicado, confira também o status
308 e o cabeçalho Location de um caminho com parâmetros nos domínios antigos.

Para conferir apenas os redirecionamentos HTTP publicados, sem navegador:

```bash
node --test tests/public/domains.test.js
```

Essa verificação também faz parte de `pnpm test:public`. Ela é ignorada quando
`ENDO_PUBLIC_URL` aponta explicitamente para outro deployment, para não misturar
a checagem de um preview com alterações de domínio em produção.

Para conferir outro deployment explicitamente:

```bash
ENDO_PUBLIC_URL=https://seu-deployment.vercel.app pnpm test:public
```

## Banco real e isolamento

Execute o arquivo inteiro `supabase/verify-patient-isolation.sql` pelo SQL Editor ou pela integração Supabase do projeto correto.

O teste cria duas contas sintéticas dentro de uma transação. Verifica permissões, leitura e alteração somente dos próprios registros, bloqueio de troca de proprietário, atualização sem duplicar o registro diário, hábitos, perfil e limites numéricos. Finaliza com `ROLLBACK`, removendo todas as contas e anotações usadas no teste. O resultado esperado é `patient_isolation_passed`.

Em bancos existentes, aplique `supabase/profile-demographics.sql` antes do
teste. A verificação também cobre a leitura e alteração dos novos campos,
rejeição de nascimento futuro e sexo inválido, e remoção dos dados opcionais.

Esse teste verifica as regras do Postgres sob o papel `authenticated`; ele não representa um login real no navegador. Da mesma forma, a persistência da suíte de interface é feita no backend simulado. Nenhum desses testes substitui a validação completa de navegador e Supabase juntos com uma conta técnica dedicada.

Execute também `supabase/verify-doctor-sharing.sql` após aplicar
`supabase/doctor-sharing.sql`. São quatro contas sintéticas com rollback integral.
A verificação inclui a impossibilidade de criar autorizações pelo acesso direto
às tabelas, perfil compartilhado sem e-mail, isolamento, múltiplos médicos,
renovação, proibição de escrita médica e bloqueio após revogação/expiração.

Após `supabase/doctor-code-customization.sql`, execute também
`supabase/verify-doctor-codes.sql`. Ele testa o privilégio de editar somente o
próprio código, códigos ativos/retirados indisponíveis para outros médicos,
consulta pelo novo código e autorizações preservadas. A suíte de navegador
confere salvar, cancelar, recarregar, falhas de rede, duplicidade, código
personalizado na busca do paciente e layout em 320 px, com backend simulado.

## Compilação

```bash
pnpm run build
```

O build deve terminar com código zero. Um aviso de tamanho de bundle não equivale a erro de compilação, mas deve ser acompanhado antes de aumentar a distribuição do produto.
