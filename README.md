# SOMA Mobile Prototype

Protótipo navegável mobile-first da SOMA, plataforma de medicina metabólica longitudinal, criado com React, Vite, Tailwind CSS, Framer Motion e base preparada para Supabase.

O app ainda funciona em modo demo quando as variáveis do Supabase não estão configuradas. Ao adicionar as credenciais, o login passa a usar Supabase Auth.

## Telas e fluxo

- `Splash` apresenta a marca e direciona para o login.
- `Login` aceita os dados demonstrativos e leva para a Home.
- `Home` conecta evolução metabólica, hábitos e um insight clínico discreto.
- `Evolução` exibe tendência longitudinal, indicadores de cuidado e timeline.
- `Hábitos` acompanha sono, alimentação, movimento e saúde emocional.
- `Educação` filtra vídeos e artigos metabólicos confiáveis.
- `Perfil` reúne objetivos metabólicos, preferências e saída da conta.

Após o login, uma bottom navigation fixa conecta os cinco destinos principais.

## Componentes-chave

- `MetabolicCard`, `HabitRing`, `AIInsightCard` e `EvolutionGraph`.
- Paleta premium com Deep Medical Teal, Midnight Navy e Soft Clinical White.
- Transições discretas entre telas, voltadas a uma experiência calma e respirável.

## Executar

Pré-requisitos: Node.js 18+ e pnpm.

```bash
pnpm install
pnpm run dev
```

Para gerar a versão de produção:

```bash
pnpm run build
pnpm run preview
```

O projeto usa Rollup WebAssembly no pipeline do Vite para manter a build compatível
com ambientes macOS que restringem o carregamento de módulos nativos.

## Supabase

1. Crie um projeto no Supabase.
2. Copie `.env.example` para `.env.local`.
3. Preencha:

```bash
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anon-publica
```

4. No Supabase, abra `SQL Editor` e execute o conteúdo de:

```text
supabase/schema.sql
```

5. Na Vercel, adicione as mesmas variáveis em:

```text
Project Settings > Environment Variables
```

6. Faça um novo deploy.

Tabelas iniciais:

- `profiles`
- `metabolic_entries`
- `habit_logs`

Todas já vêm com RLS habilitado e políticas para o usuário acessar apenas os próprios dados.

## Estrutura

```text
src/
  components/  Componentes de interface e navegação
  data/        Conteúdo demonstrativo
  screens/     Splash, Login, Home, Evolution, Habits, Education e Profile
  App.jsx      Rotas da aplicação
  index.css    Tema Tailwind e estilos globais
```
