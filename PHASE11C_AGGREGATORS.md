# Endo + — Fase 11C: agregadores e parcerias

**Estado:** pesquisa documental em fontes oficiais, consultada em 26/11/2026. Isto não é confirmação comercial para a Endócrinos, autorização de API nem recomendação para contratar. A disponibilidade de um aparelho numa lista global não demonstra suporte ao modelo e à conta brasileira.

## Comparativo

| Opção | Evidência oficial de dispositivos/API | Brasil e acesso | Preço, região, segurança e contrato |
|---|---|---|---|
| **Validic Inform** | Lista global inclui CGM Abbott e outros wearables; a documentação informa API e fluxo de aprovações de fabricantes. | A própria Validic marca Abbott como dependente de relação direta/aprovação e **“Supported in the US only”**. Não serve como integração CGM Abbott para o Brasil com a evidência disponível. Validic Free Developer mostra até 5 usuários e retenção de 90 dias, mas é plano de exploração, não confirmação de preço comercial. | Enterprise negocia usuários, integrações, retenção e SLA; há informação de certificação ISO 27001 na página do programa, mas preço por usuário, região específica de hospedagem e DPA/LGPD precisam constar de proposta/contrato. |
| **Glooko** | Catálogo lista diversos CGMs e bombas; API clínica para integração existe. | A Glooko diz que produto, aprovação regulatória e integrações variam por país. Sua página de credenciais da API restringe acesso comercial a clientes dos EUA, Canadá e União Europeia; o Brasil não está nessa lista. O catálogo, sozinho, não confirma disponibilidade brasileira. | Sem preço público por paciente ativo. A política menciona transferências internacionais e salvaguardas, mas a região a contratar precisa de confirmação. Há materiais oficiais de SOC 3 e certificação HITRUST; solicitar escopo vigente, DPA, suboperadores, SLA e local de armazenamento para o produto/contrato específico. |
| **Tidepool** | Lista suporta Abbott Libre, Dexcom, Tandem, Omnipod, Medtronic e outros. Há documentação de visualização e upload; não equivale a uma API comercial licenciável para o Endo+. | A política oficial informa que os apps/plataforma são destinados ao uso nos EUA e que os dados ficam armazenados nos EUA. O suporte da conexão Dexcom informa disponibilidade apenas nos EUA. Não considerar para pacientes no Brasil sem mudança contratual oficial por escrito. | Não há preço público por usuário/end-user na documentação consultada. Hospedagem nos EUA explicitada pela política. Confirmar DPA, cobertura LGPD, suboperadores, segurança e termos comerciais antes de qualquer transferência. |
| **Garmin Connect Health API** | API oficial para passos, atividade, sono, frequência cardíaca, stress e outros indicadores; acesso ao ambiente de avaliação após aprovação. | O programa exige aprovação. As fontes públicas consultadas não confirmam disponibilidade do programa especificamente no Brasil nem informam pausa de novas inscrições; perguntar formalmente à Garmin. | A Garmin descreve termos empresariais personalizados; não publica tarifa por usuário ativo. Hospedagem, certificações aplicáveis, DPA, suboperadores e SLA precisam de negociação e resposta por escrito. |
| **Abbott / LibreView direto** | Abbott documenta exportação CSV de glicose e compartilhamento de dados no LibreView. | Não localizei uma API pública aberta de LibreView para terceiros nem evidência oficial de uma integração direta aprovada para Endo+ no Brasil. Não usar endpoints/API não oficiais. | Priorizar CSV autorizado pelo paciente enquanto se solicita à Abbott uma resposta escrita sobre parceria, países, requisitos, dados, custos, hospedagem e contrato. |

## Recomendação

1. **Agora:** concluir importação de CSV do paciente com armazenamento privado e RLS próprios; até o CSV real anonimizado ser validado, manter a compatibilidade marcada como experimental.
2. **Wearables gerais:** avançar primeiro com o estudo nativo HealthKit/Health Connect da Fase 11B, com permissão por tipo e processamento mínimo. Isso reduz dependência de credenciais de fabricante.
3. **CGM e bombas:** enviar pedidos comerciais paralelos a Abbott, Garmin, Glooko e Validic com a lista exata de modelos usados pela clínica no Brasil. Só priorizar fornecedor que confirme por escrito Brasil, cada modelo, autorização do fabricante, fluxo de consentimento, preço, local de dados, segurança, DPA/LGPD, retenção e exclusão.
4. **Não integrar Tidepool no Brasil no cenário documental atual** porque o próprio fornecedor declara uso e armazenamento nos EUA e apps destinados a esse mercado.

Não é possível estimar custo por usuário ativo de forma responsável com as fontes públicas disponíveis. Validic, Glooko e Garmin precisam apresentar cotação/termos para os volumes Endo+; Tidepool exige esclarecimento de disponibilidade e modelo comercial, além da questão territorial.

## Perguntas que devem constar do pedido comercial

- A integração e cada modelo estão autorizados e disponíveis no Brasil? Quem pede e mantém a autorização do fabricante?
- Quais dados, latência, frequência de atualização e histórico são entregues? Qual a cobertura por modelo/versão de app?
- Onde ficam os dados e backups, quais suboperadores os processam e como exportar/excluir dados após encerrar o contrato?
- Quais certificações têm escopo vigente para o produto contratado? Há relatório SOC 2/3 ou HITRUST e resumo de auditoria disponível?
- O contrato inclui DPA para LGPD, incidente/violação, SLA, portabilidade, retenção, auditoria e apoio a direitos do titular?
- Qual a cobrança por usuários ativos, dispositivo, leitura, volume, ambiente, implantação e suporte? Há mínimos anuais, taxa de setup ou custo para homologação?

## Fontes oficiais

- [Validic: dispositivos suportados](https://validic.com/features/supported-devices/), [processo de aprovação](https://help.validic.com/space/VCS/5873926147/Validic%2BInform%2B%E2%80%94%2BApprovals%2B%26%2BApplication%2BProcess), [dados CGM de alta frequência](https://developer.validic.com/docs/high-frequency-data), [planos públicos](https://validic.com/inform-signup/)
- [Glooko: compatibilidade e ressalva por país](https://glooko.com/compatibility/), [FAQ de disponibilidade regional](https://glooko.com/faqs/), [limite geográfico da API](https://developers.glooko.com/docs/directintegrations/registration), [privacidade](https://glooko.com/privacy/), [SOC 3](https://glooko.com/wp-content/uploads/2025/04/SOC-3-for-Glooko-Inc.-and-Glooko-AB.pdf)
- [Tidepool: dispositivos](https://www.tidepool.org/devices), [política de privacidade e território/hospedagem](https://developer.tidepool.org/privacy-policy/), [limite da conexão Dexcom fora dos EUA](https://support.tidepool.org/hc/en-us/articles/21415013012756-Dexcom-Connection-Frequently-Asked-Questions-FAQs)
- [Garmin Health API](https://developer.garmin.com/gc-developer-program/enterprise/health-api/) e [níveis de acesso/termos empresariais](https://developer.garmin.com/gc-developer-program/overview/)
- [Abbott: baixar os dados brutos do LibreView](https://www.freestyle.abbott/en-us/support/faq/apps/downloading-glucose-data-from-the-freestyle-libre-3-app.html)
