<p align="center">
  <img src="https://img.shields.io/badge/Assetra-v1.0.0-00E5FF?style=for-the-badge&logo=truck&logoColor=white" alt="Version" />
  <img src="https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=next.js" alt="Next.js" />
  <img src="https://img.shields.io/badge/Supabase-Backend-3ECF8E?style=for-the-badge&logo=supabase" alt="Supabase" />
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white" alt="Tailwind" />
</p>

<h1 align="center">🚛 Assetra</h1>
<h3 align="center">Sistema Integrado de Gestão de Frotas e Manutenção</h3>

<p align="center">
  Plataforma completa para gerenciamento de frotas, manutenção veicular, predial e de máquinas,<br/>
  controle de estoque, abastecimento, lava-jato, e administração de equipes.
</p>

<p align="center">
  <strong>© 2026 Guilherme Rocha — BlackGear Solutions</strong>
</p>

---

## 📋 Índice

- [Visão Geral](#-visão-geral)
- [Funcionalidades](#-funcionalidades)
- [Stack Tecnológico](#-stack-tecnológico)
- [Arquitetura](#-arquitetura)
- [Pré-requisitos](#-pré-requisitos)
- [Instalação e Setup](#-instalação-e-setup)
- [Banco de Dados](#-banco-de-dados)
- [Estrutura do Projeto](#-estrutura-do-projeto)
- [Módulos do Sistema](#-módulos-do-sistema)
- [Configuração SMTP](#-configuração-smtp)
- [Deploy em Produção](#-deploy-em-produção)
- [Licença](#-licença)

---

## 🎯 Visão Geral

**Assetra** é um sistema ERP especializado para gestão de frotas e manutenção industrial, desenvolvido com tecnologias modernas de alta performance. O sistema oferece controle completo sobre veículos, motoristas, ordens de serviço, estoque de peças, abastecimento, lava-jato, manutenção predial, máquinas e automações — tudo em uma interface dark premium com dashboards interativos e indicadores de performance em tempo real.

### Destaques

- 🎨 **Interface Premium** — Design dark mode com glassmorphism, gradientes e micro-animações
- 📊 **Dashboard Inteligente** — KPIs em tempo real com gráficos interativos (Recharts)
- 🔐 **Multi-tenant** — Suporte a múltiplas empresas com isolamento de dados (RLS)
- 👥 **RBAC Completo** — Gestão de roles e permissões granulares por módulo
- 🤖 **Motor de Automações** — Regras configuráveis (evento + condição + ação)
- 📧 **Notificações** — In-app + e-mail via SMTP customizado
- 📅 **Calendário Integrado** — Visualização mensal/semanal/diária com drag & drop
- 📝 **Auditoria** — Logs detalhados com histórico antes/depois (JSON diff)

---

## ✨ Funcionalidades

### 🚛 Gestão de Frota
| Funcionalidade | Descrição |
|---|---|
| Veículos | Cadastro completo (placa, modelo, ano, chassi, RENAVAM, km) |
| Motoristas | Gestão com CNH, exames periódicos e habilitações |
| Documentos | Controle de CRLV, seguros, tacógrafo com alertas de vencimento |
| Dashboards | KPIs de disponibilidade, custo por km, documentos vencendo |

### 🔧 Manutenção Veicular
| Funcionalidade | Descrição |
|---|---|
| Ordens de Serviço | CRUD completo com workflow (aberta → em andamento → concluída) |
| Planos Preventivos | Configuração por km ou intervalo de tempo |
| Equipe Técnica | Gestão de técnicos com especialidades |
| Portal do Técnico | Visão dedicada para técnicos executarem OS |
| Solicitações | Canal para motoristas solicitarem manutenção |
| SLA | Controle de tempo com alertas configuráveis |

### ⚙️ Manutenção de Máquinas
| Funcionalidade | Descrição |
|---|---|
| Ativos Industriais | Cadastro de máquinas e equipamentos |
| OS de Máquinas | Ordens de serviço específicas |
| Preventivas | Planos de manutenção periódica |

### 🏢 Manutenção Predial (Facilities)
| Funcionalidade | Descrição |
|---|---|
| Ativos Prediais | Cadastro de infraestrutura |
| Extintores | Controle de inspeção e validade |
| OS Prediais | Ordens de serviço para facilities |
| Preventivas | Planos de manutenção predial |

### 📦 Estoque e Fornecedores
| Funcionalidade | Descrição |
|---|---|
| Itens em Estoque | Controle de peças com estoque mínimo/máximo |
| Entrada Manual | Registro de entradas com NF e fornecedor |
| Movimentações | Histórico de entradas/saídas com rastreabilidade |
| Fornecedores | Cadastro completo com CNPJ e contatos |
| Alertas | Notificação automática de estoque baixo |

### ⛽ Abastecimentos
| Funcionalidade | Descrição |
|---|---|
| Registros | Lançamento de abastecimentos com motorista vinculado |
| Por Veículo | Dashboard individual com histórico e KPIs de consumo |
| KPIs | Custo mensal, consumo médio (km/L), custo por km |

### 🫧 Lava-Jato
| Funcionalidade | Descrição |
|---|---|
| Agenda de Lavagem | Programação e registro de lavagens |
| Regras Automáticas | Frequência configurável por veículo/grupo |

### 📅 Calendário
| Funcionalidade | Descrição |
|---|---|
| Visões | Mês, semana e dia |
| Eventos Automáticos | OS, preventivas, vencimentos, lavagens |
| Drag & Drop | Reagendamento visual de compromissos |
| Filtros | Por tipo de evento com legenda colorida |

### 👤 Portal do Usuário e Administração
| Funcionalidade | Descrição |
|---|---|
| Gestão de Usuários | CRUD completo com e-mail de convite automático |
| Roles e Permissões | Matriz de permissões por módulo (29 permissões, 7 roles padrão) |
| Auditoria | Logs com filtros por módulo/ação, diff antes/depois |
| Notificações | Centro de notificações in-app com filtros |
| Automações | Motor de regras (8 templates pré-configurados) |
| Sistema | Configuração SMTP, SLA, parâmetros globais |

### 📊 Dashboard Principal
- OS abertas por status e prioridade
- OS atrasadas SLA
- Manutenções preventivas próximas
- Documentos vencendo (CNH/CRLV/Seguros/Exames/Tacógrafo)
- Estoque abaixo do mínimo
- Custo mensal de abastecimento e consumo médio
- Filtro por período (mês corrente por padrão)
- KPIs de todos os módulos centralizados

---

## 🛠 Stack Tecnológico

| Camada | Tecnologia | Versão |
|---|---|---|
| **Frontend** | Next.js (App Router) | 16.x |
| **UI Library** | React | 19.x |
| **Linguagem** | TypeScript | 5.x |
| **Estilização** | Tailwind CSS | 4.x |
| **Gráficos** | Recharts | 3.x |
| **Ícones** | Lucide React | 0.577+ |
| **Formulários** | React Hook Form + Zod | 7.x / 4.x |
| **Backend/DB** | Supabase (PostgreSQL) | Cloud |
| **Autenticação** | Supabase Auth | Built-in |
| **E-mail** | Nodemailer | 8.x |
| **Gerenciador** | pnpm (monorepo) | 9.x |

---

## 🏗 Arquitetura

```
┌─────────────────────────────────────────────┐
│                  FRONTEND                    │
│         Next.js 16 (App Router)             │
│     React 19 + TypeScript + Tailwind 4      │
├─────────────────────────────────────────────┤
│              API ROUTES                      │
│     /api/email (Nodemailer SMTP)            │
├─────────────────────────────────────────────┤
│              SUPABASE                        │
│  ┌──────────┬──────────┬──────────────────┐ │
│  │   Auth   │   RLS    │   PostgreSQL     │ │
│  │  (JWT)   │ Policies │   (17 schemas)   │ │
│  └──────────┴──────────┴──────────────────┘ │
│  ┌──────────┬──────────┐                    │
│  │ Storage  │ Realtime │                    │
│  │ (Buckets)│ (Events) │                    │
│  └──────────┴──────────┘                    │
└─────────────────────────────────────────────┘
```

**Modelo de Segurança:**
- Multi-tenant com `tenant_id` em todas as tabelas
- Row Level Security (RLS) em todas as tabelas
- Isolamento completo de dados por organização
- RBAC (Role-Based Access Control) com permissões granulares

---

## 📦 Pré-requisitos

- **Node.js** ≥ 18.x
- **pnpm** ≥ 9.x (`npm install -g pnpm`)
- **Conta Supabase** — [supabase.com](https://supabase.com)
- **Conta Gmail** (ou outro SMTP) para envio de e-mails

---

## 🚀 Instalação e Setup

### 1. Clone o repositório

```bash
git clone https://github.com/SEU_USUARIO/assetra.git
cd assetra
```

### 2. Instale as dependências

```bash
pnpm install
```

### 3. Configure as variáveis de ambiente

```bash
cp .env.example .env
```

Edite o arquivo `.env` com suas credenciais:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...

# Opcional: Service Role Key (para funcionalidades admin)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...
```

### 4. Configure o Banco de Dados

Execute os scripts SQL na ordem no **SQL Editor** do Supabase:

```
001_init.sql                    → Extensões e funções base
002_tables.sql                  → Todas as tabelas
003_indexes_constraints.sql     → Índices e constraints
004_functions_triggers.sql      → Funções e triggers
005_rls_policies.sql            → Políticas de RLS
006_seed_admin_and_roles.sql    → Seed de admin e roles base
007_fix_rls_recursion.sql       → Fix de recursão RLS
008_storage_buckets.sql         → Buckets de storage
009_maintenance_module.sql      → Módulo de manutenção
009_schema_updates.sql          → Atualizações de schema
010_fix_missing_schemas_and_rls.sql → Correções
010_preventive_plans_alter.sql  → Alterações em preventivas
011_team_management.sql         → Gestão de equipe
012_os_portals.sql              → Portais de OS
013_car_wash.sql                → Módulo lava-jato
014_inventory_suppliers.sql     → Estoque e fornecedores
015_stock_reservation.sql       → Reserva de estoque
016_fuel_management.sql         → Gestão de abastecimento
017_user_portal.sql             → Portal do usuário e admin
```

### 5. (Opcional) Dados de exemplo

```
seed_02_insert_fake_data.sql    → Inserir dados fictícios
seed_03_cleanup_fake_data.sql   → Limpar dados fictícios
```

### 6. Inicie o servidor de desenvolvimento

```bash
pnpm dev
```

Acesse: **http://localhost:3000**

---

## 🗄 Banco de Dados

### Diagrama de Entidades (Resumo)

```
tenants ──┬── user_profiles ──── user_roles ──── roles
          │                                       │
          │                                  role_permissions ── permissions
          │
          ├── vehicles ──── vehicle_documents
          │            └─── fuel_records
          │
          ├── drivers ──── driver_documents
          │
          ├── work_orders ──── work_order_parts
          │               └─── work_order_history
          │
          ├── preventive_plans
          │
          ├── inventory_parts ──── inventory_movements
          │
          ├── suppliers
          │
          ├── car_wash_schedules ──── car_wash_rules
          │
          ├── facility_assets ──── fire_extinguishers
          │
          ├── machine_assets
          │
          ├── calendar_events
          │
          ├── notifications
          │
          ├── automation_rules
          │
          ├── audit_logs
          │
          └── system_settings
```

### Tabelas Principais

| Tabela | Descrição | Registros Típicos |
|---|---|---|
| `tenants` | Organizações/empresas | Multi-tenant |
| `user_profiles` | Perfis de usuários | RBAC |
| `vehicles` | Frota de veículos | Placa, modelo, km |
| `drivers` | Motoristas | CNH, exames |
| `work_orders` | Ordens de serviço | Status, SLA, custos |
| `inventory_parts` | Peças e materiais | Estoque min/max |
| `fuel_records` | Registros de abastecimento | Litros, custo |
| `automation_rules` | Regras de automação | Evento + ação |
| `audit_logs` | Logs de auditoria | Quem, o quê, quando |

---

## 📁 Estrutura do Projeto

```
assetra/
├── apps/
│   └── web/                          # Aplicação Next.js
│       ├── src/
│       │   ├── app/
│       │   │   ├── (auth)/           # Páginas de autenticação
│       │   │   │   └── login/        # Login
│       │   │   ├── (dashboard)/      # Páginas protegidas
│       │   │   │   ├── page.tsx      # Dashboard principal
│       │   │   │   ├── fleet/        # 🚛 Gestão de Frota
│       │   │   │   ├── maintenance/  # 🔧 Manutenção Veicular
│       │   │   │   ├── maintenance-machines/ # ⚙️ Máquinas
│       │   │   │   ├── facilities/   # 🏢 Manutenção Predial
│       │   │   │   ├── inventory/    # 📦 Estoque e Fornecedores
│       │   │   │   ├── fuel/         # ⛽ Abastecimentos
│       │   │   │   ├── car-wash/     # 🫧 Lava-Jato
│       │   │   │   ├── calendar/     # 📅 Calendário
│       │   │   │   └── settings/     # ⚙️ Configurações
│       │   │   │       ├── page.tsx          # Usuários
│       │   │   │       ├── roles/            # Roles e Permissões
│       │   │   │       ├── audit/            # Auditoria
│       │   │   │       ├── notifications/    # Notificações
│       │   │   │       ├── automations/      # Automações
│       │   │   │       └── system/           # Sistema (SMTP/SLA)
│       │   │   └── api/
│       │   │       └── email/        # API de envio de e-mails
│       │   ├── components/
│       │   │   ├── layout/           # Sidebar, Header
│       │   │   └── ui/               # Componentes reutilizáveis
│       │   ├── contexts/             # AuthContext
│       │   ├── lib/                  # Supabase client, utils, version
│       │   └── types/                # Type declarations
│       ├── package.json
│       └── tsconfig.json
├── supabase/
│   └── sql/                          # Scripts SQL (001 → 017)
│       ├── 001_init.sql              # Setup inicial
│       ├── 002_tables.sql            # Todas as tabelas
│       ├── ...
│       ├── 017_user_portal.sql       # Portal do usuário
│       ├── seed_01_cleanup.sql       # Limpeza
│       ├── seed_02_insert_fake_data.sql  # Dados fictícios
│       └── seed_03_cleanup_fake_data.sql # Limpar fictícios
├── .env.example                      # Template de variáveis
├── .gitignore
├── docker-compose.yml
├── package.json                      # Root monorepo
├── pnpm-workspace.yaml
└── README.md                         # Este arquivo
```

---

## 📧 Configuração SMTP

O sistema envia e-mails para:
- **Convite de novo usuário** (com senha temporária)
- **Redefinição de senha**
- **Notificações automáticas** (estoque, vencimentos, SLA)
- **Teste de configuração**

### Configuração via Interface

1. Acesse **Configurações → Sistema (SMTP/SLA)**
2. Preencha os campos de configuração SMTP
3. Clique em **Testar** para validar

### Exemplo para Gmail

| Campo | Valor |
|---|---|
| Servidor SMTP | `smtp.gmail.com` |
| Porta | `587` |
| Usuário | `seuemail@gmail.com` |
| Senha | Usar **Senha de App** ([gerar aqui](https://myaccount.google.com/apppasswords)) |
| E-mail remetente | `seuemail@gmail.com` |

> ⚠️ **Gmail**: Use Senhas de App, não a senha normal da conta.

---

## 🚢 Deploy em Produção

### Vercel (Recomendado)

```bash
# 1. Instale a CLI da Vercel
npm i -g vercel

# 2. Faça deploy
cd apps/web
vercel

# 3. Configure variáveis de ambiente no painel
# NEXT_PUBLIC_SUPABASE_URL
# NEXT_PUBLIC_SUPABASE_ANON_KEY
```

### Docker

```bash
docker-compose up -d
```

### VPS / EC2

```bash
# Build de produção
pnpm build

# Iniciar
pnpm start
```

---

## 📄 Licença

Este projeto é proprietário e de uso restrito.

```
© 2026 Guilherme Rocha — BlackGear Solutions
Todos os direitos reservados.

Assetra v1.0.0
Sistema Integrado de Gestão de Frotas e Manutenção
```

---

<p align="center">
  <sub>Desenvolvido com ❤️ por <strong>BlackGear Solutions</strong></sub><br/>
  <sub>Assetra v1.0.0 — Sistema de Gestão de Frotas e Manutenção</sub>
</p>
