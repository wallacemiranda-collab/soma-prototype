# Publicação da Fase 2

Em 22/11/2026, o responsável confirmou que concluiu a revisão da prévia e, em
autorização separada, aprovou publicar módulos clínicos, autorizações de ativação
e correções com histórico no site e banco oficiais, sem copiar dados fictícios.

## Preparação

- Oficial anterior: `dpl_6KV4pMY1WmNboZCqLdiVyXtp152H`, commit `d7d2f135ae9c3d101dc3f425ec773f540a9a08c9`.
- Supabase oficial: `trlwhngxqfgksiponpzk`, PostgreSQL 17.6.1.166, ACTIVE_HEALTHY.
- Cinco tabelas públicas existentes com RLS, sem objetos clínicos da Fase 2 nem marcador de homologação.
- Registro privado da estrutura anterior salvo somente com metadados; não foi exportada nenhuma linha de paciente.
- Migração planejada somente aditiva: `phase2-clinical.sql` e `phase2-corrections.sql`, em uma transação.
  Não reaplicar `schema.sql`, scripts de cadastros ou o marcador de homologação na produção.
- O empacotamento usa uma lista explícita de fontes, sem credenciais, testes ou scripts SQL.
  O build oficial força integração ligada, homologação/prévia desligadas e conserva a opção Google atual.
- Ajuste de navegação: login preserva os links diretos `/cuidados` e `/profissional/pacientes/:id/cuidados`.
  Não altera as verificações de autorização do servidor; dois testes específicos foram acrescentados.

## Liberação e retorno

A nova compilação será preparada em endereço isolado com configuração de produção,
sem contas fictícias nem testes de escrita no banco oficial. O endereço oficial
somente será trocado depois da checagem. O artefato de homologação não será promovido.
Os IDs, hashes e resultados finais serão registrados após a conclusão.

Se a conferência do novo site falhar, o frontend pode voltar à versão anterior.
Não remover as tabelas novas: migração aditiva mantém os contratos antigos, e dados
clínicos que vierem a ser gravados precisam permanecer preservados.

A entrega desta fase não conclui cobrança, adequações de privacidade, verificação
profissional ou demais requisitos comerciais. O aviso preexistente sobre proteção
contra senhas vazadas permanece pendente; nenhum plano pago será contratado sem autorização.
