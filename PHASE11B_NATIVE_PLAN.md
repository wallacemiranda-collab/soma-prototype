# Endo + — Fase 11B: plano para integrações nativas

**Estado:** estudo; nenhuma plataforma nativa, permissão ou plugin foi instalado nesta branch.

## Caminho recomendado

Empacotar o React + Vite existente com **Capacitor** é o primeiro caminho a avaliar. Reaproveita telas e lógica já testadas e permite módulos nativos pequenos em Swift/Kotlin. A contrapartida é manter projetos, permissões, builds, testes e revisão separados para iOS e Android. Flutter oferece uma experiência mais uniforme no código nativo, mas exigiria reescrever boa parte do front-end existente e manter uma segunda interface.

O site/PWA atual não lê HealthKit nem Health Connect diretamente. A camada que solicitar permissões precisa ser o aplicativo nativo e pedir somente cada tipo de dado quando a pessoa usar aquela função.

## Plugins candidatos

- [`@capgo/capacitor-health`](https://github.com/Cap-go/capacitor-health): plugin comunitário cross-platform para HealthKit e Health Connect. O repositório informa versão principal alinhada à versão do Capacitor e licença MPL-2.0. Fazer auditoria de manutenção, dependências, licença, permissões efetivamente pedidas e comportamento de leitura antes de fixar uma versão. Não usar operações de escrita nesta primeira integração.
- [`@perfood/capacitor-healthkit`](https://github.com/perfood/capacitor-healthkit): candidato somente iOS; o próprio projeto indica que seu caminho principal mudou para a linha `v2`, publicada como alpha. Não escolher para produção sem validar estabilidade e compatibilidade.
- [`capacitor-health-connect`](https://github.com/ubie-oss/capacitor-health-connect): candidato Android específico. Validar atividade recente, versão de Capacitor, manutenção, permissões e publicação antes de adotá-lo.
- Alternativa mais controlável: plugin nativo mínimo mantido pelo Endo+, usando os frameworks oficiais diretamente. A equipe assume manutenção de Swift/Kotlin e testes por versão de sistema.

Os plugins acima são comunitários, não APIs oficiais da Apple/Google nem garantia de conformidade.

## Tipos e limites

| Fonte | Tipos candidatos, sempre com autorização individual |
|---|---|
| HealthKit | passos, distância, sono, frequência cardíaca, peso e composição corporal; glicose somente quando uma fonte compatível a gravar no Apple Saúde |
| Health Connect | passos/atividade, distância, sono, frequência cardíaca, peso, composição corporal e glicose, conforme tipos disponíveis e permissões aprovadas |

HealthKit aplica autorização granular e pode ocultar se uma permissão de leitura foi negada. Health Connect exige declarar os tipos no manifesto e, para leitura em segundo plano ou histórica, permissões adicionais. Sincronização de fundo não deve ser prometida como imediata ou contínua.

## Privacidade e lojas

- Consentimento no sistema operacional por tipo, explicação clara no contexto, opção no Endo+ para revogar e apagar cópias sincronizadas.
- Não enviar dados de HealthKit para terceiros sem consentimento expresso; não usar dados de saúde para publicidade ou venda. Publicar política de privacidade com coleta, uso, compartilhamento, retenção e exclusão.
- No Google Play, preencher Data Safety e a declaração de apps de saúde; declarar apenas os tipos Health Connect usados e justificar cada permissão. Isso se aplica também a faixas de teste publicadas.
- A Apple informa que 50% das submissões têm como meta revisão em menos de 24h e 90% em menos de 48h; recursos novos, saúde e documentação podem demorar mais. O Google diz que análises geralmente levam até 7 dias, podendo exceder isso; contas pessoais novas criadas após 13/11/2023 precisam de teste fechado com pelo menos 12 participantes continuamente inscritos por 14 dias antes de solicitar produção.
- Prazos são planejamento, não promessa de aprovação.

## Custos publicados e orçamento de manutenção

- Apple Developer Program: **US$ 99 por ano**, ou moeda local se disponível.
- Google Play Console: **US$ 25 uma vez** para conta de distribuição completa. Há plano limitado sem taxa, restrito a até 20 dispositivos e grupos de confiança.
- Não há tarifa pública confiável que determine horas de desenvolvimento, manutenção de plugins, dispositivos de teste, suporte, localização, backend, revisão clínica ou monitoramento. Estimar isso por proposta técnica depois de escolher os tipos de dados; não converter taxas em reais sem cotação do dia.

## Sequência sugerida

1. Entregar o CSV da Fase 11A e validar consentimento, exclusão e controles no backend.
2. Prototipar somente leitura em Capacitor, começando por passos, sono e peso; testar em iPhone/Safari nativo e Android/Health Connect.
3. Submeter declaração de saúde e políticas das lojas, revisar permissão por permissão e manter a versão web utilizável sem as APIs nativas.
4. Considerar glicose só se uma fonte documentada gravar a leitura na plataforma e a validação clínica/regulatória estiver concluída.

## Fontes oficiais

- [Capacitor para iOS](https://capacitorjs.com/docs/ios) e [guia de plugins](https://capacitorjs.com/docs/plugins)
- [Apple HealthKit: tipos de dados](https://developer.apple.com/documentation/healthkit/data-types), [configuração](https://developer.apple.com/documentation/healthkit/setting-up-healthkit), [autorização granular](https://developer.apple.com/documentation/healthkit/authorizing-access-to-health-data) e [privacidade](https://developer.apple.com/documentation/healthkit/protecting-user-privacy)
- [Health Connect: arquitetura/permissões](https://developer.android.com/health-and-fitness/health-connect/architecture), [tipos](https://developer.android.com/health-and-fitness/health-connect/data-types) e [publicação](https://developer.android.com/health-and-fitness/health-connect/publish)
- [Política de saúde da Apple](https://developer.apple.com/app-store/review/guidelines/), [taxa Apple](https://developer.apple.com/help/account/membership/program-enrollment/), [tempo de revisão Apple](https://developer.apple.com/help/app-review/after-submitting-for-review/review-status/)
- [Declaração de saúde Google Play](https://support.google.com/googleplay/android-developer/answer/14738291), [taxa Google Play](https://support.google.com/googleplay/android-developer/answer/6112435) e [teste de contas pessoais novas](https://support.google.com/googleplay/android-developer/answer/14151465)
