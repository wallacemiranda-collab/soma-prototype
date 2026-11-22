# Publicação da Fase 2

Em 22/11/2026, o responsável confirmou que concluiu a revisão da prévia e, em
autorização separada, aprovou publicar módulos clínicos, autorizações de ativação
e correções com histórico no site e banco oficiais, sem copiar dados fictícios.

## Publicação Concluída

- Oficial: [Endo +](https://endoplus.vercel.app), conferido após a publicação em 22/11/2026.
- Deployment: `dpl_3eE4z1sDEpqwpQSh1zHXCfkrqUvu`, READY, ambiente production, sem erro de alias.
- Fonte: commit local `678c0d52e2c588fdd568ba1bf7820682cd7db21e`, branch `codex/fase2-homologacao`.
- Pacote de 73 arquivos, SHA-256 `7aa06cbb01594bd6e43adb99951c55c16ec69d269720cc1cd0c9d2109699bce2`.
  Os 73 arquivos publicados foram comparados por SHA-1 com o pacote aprovado, sem diferenças.
- `endoplus.vercel.app`, `endo-plus.vercel.app` e `soma-prototype-nc87.vercel.app`
  estão associados à nova versão. Os dois endereços antigos continuam redirecionando
  para o oficial, preservando caminhos e parâmetros.

## Preparação e Banco

- Oficial anterior: `dpl_6KV4pMY1WmNboZCqLdiVyXtp152H`, commit `d7d2f135ae9c3d101dc3f425ec773f540a9a08c9`.
- Supabase oficial: `trlwhngxqfgksiponpzk`, PostgreSQL 17.6.1.166, ACTIVE_HEALTHY.
- Cinco tabelas públicas existentes com RLS, sem objetos clínicos da Fase 2 nem marcador de homologação.
- Registro privado da estrutura anterior salvo somente com metadados; não foi exportada nenhuma linha de paciente.
- Migração aditiva aplicada em uma transação: `phase2-clinical.sql` e `phase2-corrections.sql`.
  Versão `20261122144657`, nome `phase2_clinical_modules_and_record_audit`;
  SHA-256 do SQL combinado com guardas `f665b22e4eee27f704bab8f6ce8b235383dd4cad2570df3c910132ff06134bb7`.
  Não reaplicar `schema.sql`, scripts de cadastros ou o marcador de homologação na produção.
- Após a migração: 16 tabelas públicas com RLS. As 11 novas tabelas estavam vazias,
  sem copiar contas, autorizações ou registros fictícios. Vínculos antigos não receberam
  automaticamente autorização para ativar módulos.
- Os metadados das cinco tabelas anteriores, suas políticas e funções de compartilhamento
  foram comparados com o registro anterior, sem diferenças, excluindo somente o novo
  gatilho esperado de invalidação da autorização clínica.
- As novas tabelas negam leitura anônima e escrita direta pelo cliente autenticado.
  RPCs públicos são invoker; funções privilegiadas ficam privadas com search_path fixo.
  O gatilho não permite execução direta. Produção continua sem marcador de homologação.
- O empacotamento usa uma lista explícita de fontes, sem credenciais, testes ou scripts SQL.
  O build oficial força integração ligada, homologação/prévia desligadas e conserva a opção Google atual.
- Ajuste de navegação: login preserva os links diretos `/cuidados` e `/profissional/pacientes/:id/cuidados`.
  Não altera as verificações de autorização do servidor; dois testes específicos foram acrescentados.

## Compilação e Conferência

A primeira conferência usou um novo candidato isolado, `dpl_HgD2MPeMnvqNw2RqSfbUVHJvfAcV`,
compilado com as opções e o Supabase oficiais. Não era o artefato de homologação.
A tentativa de promoção direta retornou 422, pois esse candidato ainda tinha target null.
Foi então criada uma nova compilação production a partir do deployment candidato,
sem buscar outra revisão no GitHub (`withLatestCommit: false`). O build passou e
a Vercel associou os domínios oficiais à nova versão. Nenhuma proteção foi desativada.

As três opções persistidas somente em production são integração clínica ligada,
homologação desligada e prévia fictícia desligada. URL/chave pública e a opção Google
existentes foram preservadas. O aviso de bundle acima de 500 kB não impediu o build.

- 87 testes de regras/contratos/empacotamento e 23 itens de banco local passaram.
- Sete fluxos de integração simulada passaram.
- 32 fluxos de navegador passaram, incluindo os dois novos retornos de login para
  acompanhamentos. Execuções iniciais excederam limites locais da suíte e de uma
  expectativa. A execução completa passou com mais tempo, sem mudar as asserções,
  a configuração padrão do projeto ou o código do aplicativo para acomodar o teste.
- No candidato e no endereço oficial, três cenários de release passaram em cada um
  (quatro itens com agrupador): login/rotas privadas, demo isolada e interface clínica
  habilitada com identidade simulada somente no navegador. Todo tráfego Supabase
  desses testes foi interceptado; não houve autenticação ou leitura clínica real em produção.
- Seis testes públicos passaram: páginas, login obrigatório, demo, duas entradas e
  redirecionamentos dos domínios antigos. Nenhuma gravação de paciente foi enviada.
- Três consultas reais anônimas da Data API, sem sessão de paciente e com limite zero
  nas tabelas, foram recusadas com 401/42501: módulos, auditoria e RPC de resumo.
- O auditor de segurança não trouxe alerta novo; o de saúde retornou vazio.
  A consulta agregada de logs de execução não retornou erros/fatais da nova versão.
  O frontend é estático; isso não substitui a conferência de erros no navegador,
  também realizada pelos testes.

A revisão clínica e nos aparelhos foi confirmada pelo responsável, seguida de
autorização específica para publicar. Testes automatizados não substituem essa revisão.

## Encerramento da Revisão

As cinco contas sintéticas da revisão foram removidas somente da homologação,
com guarda do projeto, UUIDs e prefixo exatos. Foram confirmados zero contas,
sessões, perfis, códigos, vínculos, medidas, hábitos, permissões, módulos, versões,
registros clínicos e auditorias desses usuários. O banco e os usuários oficiais
não participaram dessa limpeza. A estrutura da homologação permanece disponível.
Os arquivos locais de senhas da revisão foram removidos após a confirmação da limpeza.

O link do candidato foi revogado. O link antigo de revisão já não existia ao tentar
revogá-lo; uma requisição limpa confirmou redirecionamento para autenticação da
Vercel, sem abrir a prévia. Nenhum link novo ou acesso público foi criado.

## Retorno e Sincronização

Se a conferência do novo site falhar, o frontend pode voltar à versão anterior.
Não remover as tabelas novas: migração aditiva mantém os contratos antigos, e dados
clínicos que vierem a ser gravados precisam permanecer preservados.

O envio ao GitHub continua pendente: o Git local não recebeu autenticação e a
integração recusou escrita com 403. Não foram extraídas credenciais nem contornada
essa restrição. A publicação foi realizada diretamente na Vercel com as fontes locais.
É necessário enviar a branch e integrá-la ao main antes de uma próxima publicação
automática desse main antigo, para não substituir esta versão por código anterior.
Os testes e este registro de entrega ficam em commit local posterior ao da fonte publicada.

A entrega desta fase não conclui cobrança, adequações de privacidade, verificação
profissional ou demais requisitos comerciais. O aviso preexistente sobre proteção
contra senhas vazadas permanece pendente; nenhum plano pago será contratado sem autorização.
Veja a [orientação de segurança de senhas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
