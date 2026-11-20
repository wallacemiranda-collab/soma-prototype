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

Também é possível usar uma instalação local do Chrome, sem baixar o Chromium:

```bash
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" pnpm test:e2e
```

O resumo sai no terminal; capturas e rastros de falha ficam em `test-results/`, fora do Git. Não habilite gravação de sessões reais de pacientes nesses testes. O servidor temporário é encerrado ao final da execução.

## Site publicado

```bash
pnpm test:public
```

Confere `https://endo-plus.vercel.app`, páginas públicas, proteção de rotas, navegação da demonstração e retorno ao início após abrir um formulário protegido. Usa `node:test` e controla diretamente um navegador isolado, sem o executor de workers da suíte local. Não cadastra usuários, não envia e-mails e não salva dados no Supabase. O resumo sai no terminal e o navegador é fechado ao final.

Para conferir outro deployment explicitamente:

```bash
ENDO_PUBLIC_URL=https://seu-deployment.vercel.app pnpm test:public
```

## Banco real e isolamento

Execute o arquivo inteiro `supabase/verify-patient-isolation.sql` pelo SQL Editor ou pela integração Supabase do projeto correto.

O teste cria duas contas sintéticas dentro de uma transação. Verifica permissões, leitura e alteração somente dos próprios registros, bloqueio de troca de proprietário, atualização sem duplicar o registro diário, hábitos, perfil e limites numéricos. Finaliza com `ROLLBACK`, removendo todas as contas e anotações usadas no teste. O resultado esperado é `patient_isolation_passed`.

Esse teste verifica as regras do Postgres sob o papel `authenticated`; ele não representa um login real no navegador. Da mesma forma, a persistência da suíte de interface é feita no backend simulado. Nenhum desses testes substitui a validação completa de navegador e Supabase juntos com uma conta técnica dedicada.

## Compilação

```bash
pnpm run build
```

O build deve terminar com código zero. Um aviso de tamanho de bundle não equivale a erro de compilação, mas deve ser acompanhado antes de aumentar a distribuição do produto.
