-- 002_tables.sql
-- Configuração estrutural do banco. Depende de 001_init.sql

-- ==========================================
-- 1. USERS, PROFILES, ROLES & PERMISSIONS
-- ==========================================

-- Roles (ex: ADMIN, MANUTENCAO, FACILITIES...)
CREATE TABLE IF NOT EXISTS public.roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Permissions baseadas em string (ex: 'fleet.vehicles.read')
CREATE TABLE IF NOT EXISTS public.permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    action VARCHAR(100) UNIQUE NOT NULL,
    module VARCHAR(50) NOT NULL,
    description TEXT
);

-- Relação n:n Roles <-> Permissions
CREATE TABLE IF NOT EXISTS public.role_permissions (
    role_id UUID REFERENCES public.roles(id) ON DELETE CASCADE,
    permission_id UUID REFERENCES public.permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

-- Extensão do auth.users do Supabase
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID PRIMARY KEY, -- FK para auth.users(id) será aplicada em constraints ou trigger
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    job_title VARCHAR(100),
    cost_center VARCHAR(100),
    is_admin BOOLEAN DEFAULT false,
    must_change_password BOOLEAN DEFAULT false,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Relação n:n Users <-> Roles
CREATE TABLE IF NOT EXISTS public.user_roles (
    user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    role_id UUID REFERENCES public.roles(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, role_id)
);


-- ==========================================
-- 2. FLEET MANAGEMENT (Frota)
-- ==========================================

CREATE TABLE IF NOT EXISTS public.vehicles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL, -- caminhão, carro, moto...
    plate VARCHAR(20) NOT NULL,
    renavam VARCHAR(50),
    chassis VARCHAR(100),
    brand VARCHAR(100),
    model VARCHAR(100),
    year INT,
    fuel_type VARCHAR(50),
    capacity VARCHAR(50),
    current_odometer NUMERIC(10, 2) DEFAULT 0,
    status VARCHAR(50) DEFAULT 'ativo', -- ativo, manutencao, inativo...
    cost_center VARCHAR(100),
    default_driver_id UUID, -- FK para drivers
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.drivers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    cpf VARCHAR(20),
    cnh_number VARCHAR(50),
    cnh_category VARCHAR(10),
    cnh_expiration DATE,
    cnh_restrictions TEXT,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Atualização da FK em vehicles:
ALTER TABLE public.vehicles ADD CONSTRAINT fk_vehicles_default_driver FOREIGN KEY (default_driver_id) REFERENCES public.drivers(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.vehicle_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL, -- CRLV, IPVA, Seguro...
    document_number VARCHAR(100),
    issuer VARCHAR(100),
    issue_date DATE,
    expiration_date DATE NOT NULL,
    attachment_path VARCHAR(500),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.driver_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    driver_id UUID REFERENCES public.drivers(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL, -- Toxicologico, Exame Periódico...
    clinic_name VARCHAR(150),
    issue_date DATE,
    expiration_date DATE NOT NULL,
    attachment_path VARCHAR(500),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.fines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE CASCADE,
    driver_id UUID REFERENCES public.drivers(id) ON DELETE SET NULL,
    infraction_date TIMESTAMP WITH TIME ZONE NOT NULL,
    location VARCHAR(255),
    description TEXT,
    amount NUMERIC(10, 2),
    status VARCHAR(50) DEFAULT 'pendente', -- pendente, paga, contestada
    attachment_path VARCHAR(500),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.tachograph_checks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE CASCADE,
    check_date DATE NOT NULL,
    expiration_date DATE NOT NULL,
    attachment_path VARCHAR(500),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.insurances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE CASCADE,
    insurer_name VARCHAR(150),
    policy_number VARCHAR(100),
    coverage_details TEXT,
    amount NUMERIC(10, 2),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    attachment_path VARCHAR(500),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.warranties (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE CASCADE,
    item_name VARCHAR(150),
    supplier VARCHAR(150),
    conditions TEXT,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    attachment_path VARCHAR(500),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- ==========================================
-- 3. FACILITIES & MACHINES
-- ==========================================

CREATE TABLE IF NOT EXISTS public.assets_machines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    model VARCHAR(100),
    serial_number VARCHAR(100),
    location VARCHAR(200),
    sector VARCHAR(100),
    usage_hours NUMERIC(10, 2) DEFAULT 0,
    status VARCHAR(50) DEFAULT 'ativo',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.assets_facilities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    category VARCHAR(100), -- ar condicionado, elevador...
    location VARCHAR(200),
    tag_qr_code VARCHAR(100),
    manufacturer VARCHAR(150),
    model VARCHAR(100),
    serial_number VARCHAR(100),
    installation_date DATE,
    criticality VARCHAR(50), -- alta, media, baixa
    status VARCHAR(50) DEFAULT 'ativo',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.extinguishers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    location VARCHAR(200) NOT NULL,
    type VARCHAR(50), -- AP, CO2, PQS...
    capacity VARCHAR(50),
    seal_number VARCHAR(100),
    inspection_expiration DATE NOT NULL,
    recharge_expiration DATE NOT NULL,
    attachment_path VARCHAR(500),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- ==========================================
-- 4. MAINTENANCE (OS - ORDENS DE SERVIÇO)
-- ==========================================

CREATE TABLE IF NOT EXISTS public.maintenance_technicians (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    contact VARCHAR(100),
    specialties TEXT,
    hourly_cost NUMERIC(10, 2) DEFAULT 0,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.work_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL, -- vehicle, machine, facility
    vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE CASCADE,
    machine_id UUID REFERENCES public.assets_machines(id) ON DELETE CASCADE,
    facility_id UUID REFERENCES public.assets_facilities(id) ON DELETE CASCADE,
    requester_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    technician_id UUID REFERENCES public.maintenance_technicians(id) ON DELETE SET NULL,
    priority VARCHAR(50) DEFAULT 'media', -- baixa, media, alta, urgente
    description TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'aberta', -- aberta, em_atendimento, pecas, concluida, cancelada
    checklist JSONB,
    opening_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    start_date TIMESTAMP WITH TIME ZONE,
    completion_date TIMESTAMP WITH TIME ZONE,
    time_spent_hours NUMERIC(10, 2) DEFAULT 0,
    labor_cost NUMERIC(10, 2) DEFAULT 0,
    parts_cost NUMERIC(10, 2) DEFAULT 0,
    third_party_cost NUMERIC(10, 2) DEFAULT 0,
    attachments JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- ==========================================
-- 5. INVENTORY (Peças e Estoque)
-- ==========================================

CREATE TABLE IF NOT EXISTS public.parts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    sku VARCHAR(100) UNIQUE,
    description VARCHAR(255) NOT NULL,
    unit VARCHAR(20) DEFAULT 'un',
    category VARCHAR(50), -- veiculo, facility
    min_stock NUMERIC(10, 2) DEFAULT 0,
    current_stock NUMERIC(10, 2) DEFAULT 0,
    average_cost NUMERIC(10, 2) DEFAULT 0,
    preferred_supplier VARCHAR(150),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.stock_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    part_id UUID REFERENCES public.parts(id) ON DELETE CASCADE,
    work_order_id UUID REFERENCES public.work_orders(id) ON DELETE SET NULL,
    type VARCHAR(20) NOT NULL, -- 'in', 'out', 'adj'
    quantity NUMERIC(10, 2) NOT NULL,
    unit_cost NUMERIC(10, 2) DEFAULT 0,
    date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    notes TEXT,
    created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.work_order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    work_order_id UUID REFERENCES public.work_orders(id) ON DELETE CASCADE,
    part_id UUID REFERENCES public.parts(id) ON DELETE RESTRICT,
    quantity NUMERIC(10, 2) NOT NULL,
    unit_cost NUMERIC(10, 2) NOT NULL,
    total_cost NUMERIC(10, 2) GENERATED ALWAYS AS (quantity * unit_cost) STORED,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- ==========================================
-- 6. FUEL & WASH (Abastecimento e Lavagem)
-- ==========================================

CREATE TABLE IF NOT EXISTS public.fuel_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE CASCADE,
    driver_id UUID REFERENCES public.drivers(id) ON DELETE SET NULL,
    date TIMESTAMP WITH TIME ZONE NOT NULL,
    station_name VARCHAR(150),
    fuel_type VARCHAR(50),
    liters NUMERIC(10, 2) NOT NULL,
    total_value NUMERIC(10, 2) NOT NULL,
    current_odometer NUMERIC(10, 2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.car_wash_schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE CASCADE,
    wash_type VARCHAR(50), -- simples, completa...
    scheduled_date TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(50) DEFAULT 'agendada', -- agendada, em_execucao, concluida, cancelada
    responsible VARCHAR(150),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- ==========================================
-- 7. CALENDAR, NOTIFICATIONS & AUTOMATIONS
-- ==========================================

CREATE TABLE IF NOT EXISTS public.calendar_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    type VARCHAR(50), -- preventiva, lavagem, os_programada, vencimento
    reference_id UUID, -- id generico pro ativo responsavel
    start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    end_date TIMESTAMP WITH TIME ZONE NOT NULL,
    responsible_user_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE, -- null = broadcast tenant
    title VARCHAR(150) NOT NULL,
    message TEXT NOT NULL,
    read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.automation_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    event VARCHAR(100) NOT NULL, -- ex: 'document_expiration'
    conditions JSONB,
    actions JSONB NOT NULL,
    frequency VARCHAR(50), -- 'daily', '15min'
    recipients JSONB,
    template_email TEXT,
    active BOOLEAN DEFAULT true,
    last_run TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
