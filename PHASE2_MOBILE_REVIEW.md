# Prévia protegida para revisão no celular

Preparada em 21/11/2026, sem publicar a Fase 2 no site oficial.

## Publicação

- Preview Vercel: `dpl_B5AiXqJ3ZcCgPRvgsszJamfSDnYy`, estado READY, `target: null`, sem aliases.
- Host: `soma-prototype-nc87-gixdsyz70-wallace-miranda-s-projects.vercel.app`.
- Projeto/team existentes, sem contratação de plano ou adicional.
- Fonte: snapshot local da branch `codex/fase2-homologacao`, base `3d10579886e05b1506b125fa4d720de051f89b86`, com alterações ainda não commitadas.
- SHA-256 do pacote: `d872b7d104acc6cb568974bfe25d0ebd07b7b8ea901d7322577eb3d4ab11255b`.
- Pacote explícito de 74 arquivos. Não inclui `.env`, credenciais, testes, scripts do banco,
  pastas internas ou `bianca-jogo/`. Inclui `pnpm-workspace.yaml`, preservando a política
  existente que autoriza somente o build do esbuild; nenhuma liberação geral de scripts.
- A primeira montagem falhou por não incluir essa configuração; o empacotamento foi corrigido
  e o segundo build passou. Dependências e lockfile não foram alterados.

O comando e os cabeçalhos de build existem somente no `vercel.json` do pacote enviado.
O arquivo normal do repositório, as variáveis globais, proteção do projeto e domínios
oficiais não foram alterados. Não promover esta prévia diretamente para produção.

O oficial continua READY em `dpl_6KV4pMY1WmNboZCqLdiVyXtp152H`, commit
`d7d2f135ae9c3d101dc3f425ec773f540a9a08c9`, com `endoplus.vercel.app` e os aliases anteriores.

## Isolamento

- `VITE_HOMOLOGATION_ENABLED=true` exige o endereço exato do Supabase de testes
  `ctcsolobseerqnddahun` e uma chave pública moderna; rejeita produção e outros destinos.
- Antes de montar a autenticação, a tela confirma o marcador do servidor. Falha,
  tempo excedido ou marcador incorreto bloqueiam os formulários, sem demo como fallback.
- Aviso permanente de homologação em todas as telas, título identificado como prévia,
  meta robots, cabeçalho `X-Robots-Tag` e `robots.txt` impedindo indexação solicitada.
- Cadastro, recuperação, alteração de senha e Google são bloqueados nesta interface.
  Login aceita apenas as identidades fictícias geradas. Isso não altera as configurações
  do Auth do Supabase: as permissões reais continuam dependendo do servidor e das RLS.
- A proteção Vercel continua ativa. A consulta sem autorização foi redirecionada (302).
  Foi gerado um link de revisão com validade solicitada de 24 horas, sem desativar proteção.
  O link com seu token não deve ser salvo no repositório nem encaminhado a pacientes.

## Acessos e dados

Há cinco contas fictícias dedicadas a esta revisão: paciente, médico, nutricionista
e duas contas auxiliares para isolamento. Todas usam `@example.invalid`. O arquivo
de acessos foi gerado fora do repositório/webroot, em pasta privada, com permissão 0600.
Ele é entregue localmente ao responsável, sem senhas em código, logs ou pacote publicado.

O paciente fictício tem quatro módulos ativos e exemplos dos sete tipos de registro,
além de quatro medidas metabólicas e um exemplo de correção preservado no histórico.
Registros profissionais, metas, doses, intervalos e demais valores são fictícios,
não uma prescrição ou orientação terapêutica. Nenhum e-mail foi enviado.

As contas dedicadas ficam disponíveis durante a revisão humana, diferentemente das
contas temporárias das suítes anteriores, que foram removidas. Ao encerrar a revisão,
usar `tests/staging/provision.mjs cleanup-sql` com o arquivo privado desta execução,
somente na homologação; confirmar remoção de sessões, contas, registros e auditorias.
Não apagar o arquivo de controle antes da limpeza. Não há rotina de limpeza futura agendada.

## Conferência automatizada

- 86 testes de regras/contratos passaram, incluindo destino de homologação, identidades
  fictícias e lista explícita de arquivos do pacote.
- Os 30 fluxos anteriores passaram com a opção de homologação desligada.
- No endereço publicado, quatro cenários passaram: login real recusado sem chamada Auth,
  correção do paciente em 320 px com recarga, médico com histórico somente leitura e
  paciente sem autorização bloqueado. Nenhuma chamada à produção ou envio de e-mail permitido.
- Um quinto cenário no endereço publicado simulou marcador errado e confirmou o bloqueio
  antes de montar o formulário de login. A simulação não alterou o servidor.
- O build remoto passou com a integração de homologação ligada. A compilação normal
  desligada também foi conferida. Permanece o aviso de tamanho do bundle.

Os testes publicados encerram suas sessões e o navegador; não registram vídeo,
traces, capturas ou senhas. Os exemplos e a correção de revisão permanecem fictícios.

## Revisão Humana

Usar o link temporário e o arquivo de acessos fornecidos no chat:

1. Em iPhone/Safari, entrar como paciente, abrir os acompanhamentos e testar registro,
   correção com motivo, recarga, histórico original e desconsideração confirmada.
2. Conferir teclado de números/data/hora, botões, rolagem e navegação inferior.
3. Repetir em Android/Chrome e conferir as telas de Evolução, Hábitos, Educação e Perfil.
4. Sair da conta antes de entrar como médico, ou usar outra janela anônima.
   Conferir o paciente autorizado, os módulos e o histórico sem botões de edição.
5. Registrar aparelho/navegador, passos e resultado de qualquer problema.

Não marcar a revisão clínica ou dos aparelhos como aprovada apenas com um “feito”:
pedir confirmação específica. Não há autorização de publicação oficial nesta etapa.
As pendências de privacidade, verificação profissional, segurança de senhas, controles
operacionais e liberação comercial permanecem documentadas nas fases anteriores.
