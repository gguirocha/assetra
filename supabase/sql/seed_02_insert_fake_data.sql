-- ============================================================
-- SCRIPT 2: INSERIR DADOS FAKE PARA DEMONSTRAÇÃO
-- Usa SQL puro com UUIDs fixos (sem DO block)
-- ============================================================

-- Pegar tenant_id
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM public.tenants LIMIT 1) THEN RAISE EXCEPTION 'Nenhum tenant encontrado!'; END IF; END $$;

-- ====== MOTORISTAS ======
INSERT INTO public.drivers (id, tenant_id, name, cpf, cnh_number, cnh_category, cnh_expiration, active)
SELECT v.id, t.id, v.name, v.cpf, v.cnh, v.cat, v.exp::date, true
FROM (SELECT id FROM public.tenants LIMIT 1) t,
(VALUES
  ('a0000001-0000-0000-0000-000000000001'::uuid, 'Carlos Alberto Silva', '123.456.789-00', '12345678900', 'D', '2026-08-15'),
  ('a0000001-0000-0000-0000-000000000002'::uuid, 'José Ricardo Souza', '234.567.890-11', '23456789011', 'E', '2026-03-20'),
  ('a0000001-0000-0000-0000-000000000003'::uuid, 'Marcos Vinícius Oliveira', '345.678.901-22', '34567890122', 'D', '2025-12-01'),
  ('a0000001-0000-0000-0000-000000000004'::uuid, 'Rafael Mendes Costa', '456.789.012-33', '45678901233', 'C', '2027-06-30'),
  ('a0000001-0000-0000-0000-000000000005'::uuid, 'Anderson Pereira Lima', '567.890.123-44', '56789012344', 'E', '2026-11-10')
) AS v(id, name, cpf, cnh, cat, exp);

-- ====== VEÍCULOS ======
INSERT INTO public.vehicles (id, tenant_id, type, plate, brand, model, year, fuel_type, capacity, current_odometer, status, cost_center, default_driver_id)
SELECT v.id, t.id, v.tp, v.plate, v.brand, v.model, v.yr, v.fuel, v.cap, v.odo, v.st, v.cc, v.drv
FROM (SELECT id FROM public.tenants LIMIT 1) t,
(VALUES
  ('b0000001-0000-0000-0000-000000000001'::uuid,'caminhão','ABC-1234','Volvo','FH 540',2022,'diesel','40 ton',185430.0,'ativo','Logística','a0000001-0000-0000-0000-000000000001'::uuid),
  ('b0000001-0000-0000-0000-000000000002'::uuid,'caminhão','DEF-5678','Scania','R450',2021,'diesel','35 ton',210890.0,'ativo','Logística','a0000001-0000-0000-0000-000000000002'::uuid),
  ('b0000001-0000-0000-0000-000000000003'::uuid,'caminhão','GHI-9012','Mercedes','Actros 2651',2023,'diesel','45 ton',92700.0,'manutencao','Logística','a0000001-0000-0000-0000-000000000003'::uuid),
  ('b0000001-0000-0000-0000-000000000004'::uuid,'van','JKL-3456','Fiat','Ducato',2022,'diesel','16 m³',67200.0,'ativo','Entregas','a0000001-0000-0000-0000-000000000004'::uuid),
  ('b0000001-0000-0000-0000-000000000005'::uuid,'carro','MNO-7890','Toyota','Corolla',2024,'gasolina','5 pass',15800.0,'ativo','Administrativo',NULL),
  ('b0000001-0000-0000-0000-000000000006'::uuid,'caminhão','PQR-1122','DAF','XF 530',2020,'diesel','40 ton',320100.0,'ativo','Logística','a0000001-0000-0000-0000-000000000005'::uuid),
  ('b0000001-0000-0000-0000-000000000007'::uuid,'moto','STU-3344','Honda','CG 160',2023,'gasolina','-',28400.0,'ativo','Operações',NULL),
  ('b0000001-0000-0000-0000-000000000008'::uuid,'van','VWX-5566','Renault','Master',2021,'diesel','14 m³',98300.0,'inativo','Entregas',NULL)
) AS v(id,tp,plate,brand,model,yr,fuel,cap,odo,st,cc,drv);

-- ====== DOCUMENTOS VEÍCULO ======
INSERT INTO public.vehicle_documents (vehicle_id, type, document_number, issuer, issue_date, expiration_date) VALUES
('b0000001-0000-0000-0000-000000000001','CRLV','CRLV-2025-001','DETRAN-SP','2025-01-15','2026-01-15'),
('b0000001-0000-0000-0000-000000000001','Seguro','SEG-2025-001','Porto Seguro','2025-06-01','2026-06-01'),
('b0000001-0000-0000-0000-000000000002','CRLV','CRLV-2025-002','DETRAN-SP','2025-03-10','2026-03-10'),
('b0000001-0000-0000-0000-000000000002','IPVA','IPVA-2026-002','SEFAZ-SP','2026-01-01','2026-03-31'),
('b0000001-0000-0000-0000-000000000003','CRLV','CRLV-2024-003','DETRAN-SP','2024-11-20','2025-11-20'),
('b0000001-0000-0000-0000-000000000004','Seguro','SEG-2025-004','Bradesco Seguros','2025-09-01','2026-09-01'),
('b0000001-0000-0000-0000-000000000005','CRLV','CRLV-2025-005','DETRAN-SP','2025-07-01','2026-07-01'),
('b0000001-0000-0000-0000-000000000006','CRLV','CRLV-2025-006','DETRAN-SP','2025-02-15','2026-02-15'),
('b0000001-0000-0000-0000-000000000006','Seguro','SEG-2025-006','Tokio Marine','2025-04-01','2026-04-01');

-- ====== DOCUMENTOS MOTORISTA ======
INSERT INTO public.driver_documents (driver_id, type, clinic_name, issue_date, expiration_date) VALUES
('a0000001-0000-0000-0000-000000000001','Toxicológico','Clínica Saúde Total','2025-06-15','2028-06-15'),
('a0000001-0000-0000-0000-000000000001','Exame Periódico','MedTrabalho SP','2025-09-01','2026-09-01'),
('a0000001-0000-0000-0000-000000000002','Toxicológico','Lab Análises','2024-12-01','2027-12-01'),
('a0000001-0000-0000-0000-000000000003','Exame Periódico','MedTrabalho SP','2025-03-15','2026-03-15'),
('a0000001-0000-0000-0000-000000000004','Toxicológico','Clínica Saúde Total','2025-08-20','2028-08-20'),
('a0000001-0000-0000-0000-000000000005','Exame Periódico','MedTrabalho SP','2025-11-10','2026-05-10');

-- ====== TACÓGRAFOS ======
INSERT INTO public.tachograph_checks (vehicle_id, check_date, expiration_date) VALUES
('b0000001-0000-0000-0000-000000000001','2025-07-01','2026-07-01'),
('b0000001-0000-0000-0000-000000000002','2025-09-15','2026-09-15'),
('b0000001-0000-0000-0000-000000000003','2025-01-20','2026-01-20'),
('b0000001-0000-0000-0000-000000000006','2025-05-01','2026-05-01');

-- ====== SEGUROS ======
INSERT INTO public.insurances (vehicle_id, insurer_name, policy_number, coverage_details, amount, start_date, end_date) VALUES
('b0000001-0000-0000-0000-000000000001','Porto Seguro','PS-2025-4421','Cobertura total + terceiros',18500,'2025-06-01','2026-06-01'),
('b0000001-0000-0000-0000-000000000002','Bradesco Seguros','BS-2025-7788','Cobertura total',16200,'2025-08-01','2026-08-01'),
('b0000001-0000-0000-0000-000000000003','Tokio Marine','TM-2025-9933','Cobertura parcial + APP',14800,'2025-03-01','2026-03-01'),
('b0000001-0000-0000-0000-000000000005','Mapfre','MP-2025-1122','Completo premium',5200,'2025-10-01','2026-10-01');

-- ====== MULTAS ======
INSERT INTO public.fines (vehicle_id, driver_id, infraction_date, location, description, amount, status) VALUES
('b0000001-0000-0000-0000-000000000001','a0000001-0000-0000-0000-000000000001','2025-11-15 14:30-03','Rod. Anhanguera km 45','Excesso de velocidade',130.16,'paga'),
('b0000001-0000-0000-0000-000000000002','a0000001-0000-0000-0000-000000000002','2026-01-08 09:45-03','Av. Paulista, SP','Estacionamento irregular',195.23,'pendente'),
('b0000001-0000-0000-0000-000000000004','a0000001-0000-0000-0000-000000000004','2026-02-20 16:00-03','Rod. Castelo Branco','Excesso de velocidade',293.47,'pendente');

-- ====== MÁQUINAS ======
INSERT INTO public.assets_machines (id, tenant_id, name, model, serial_number, location, sector, usage_hours, status)
SELECT v.id, t.id, v.nm, v.md, v.sn, v.loc, v.sec, v.hrs, v.st FROM (SELECT id FROM public.tenants LIMIT 1) t,
(VALUES
  ('c0000001-0000-0000-0000-000000000001'::uuid,'Empilhadeira Elétrica #1','Toyota 8FBMT25','EM-2021-001','Galpão A','Armazém',4200.0,'ativo'),
  ('c0000001-0000-0000-0000-000000000002'::uuid,'Compressor Industrial','Atlas Copco GA37','CP-2020-002','Oficina','Manutenção',8500.0,'ativo'),
  ('c0000001-0000-0000-0000-000000000003'::uuid,'Paleteira Manual Hidráulica','Paletrans TM2220','PH-2022-003','Galpão B','Armazém',1200.0,'manutencao')
) AS v(id,nm,md,sn,loc,sec,hrs,st);

-- ====== PREDIAL ======
INSERT INTO public.assets_facilities (id, tenant_id, name, category, location, manufacturer, model, installation_date, criticality, status)
SELECT v.id, t.id, v.nm, v.cat, v.loc, v.mfr, v.md, v.dt::date, v.crit, v.st FROM (SELECT id FROM public.tenants LIMIT 1) t,
(VALUES
  ('d0000001-0000-0000-0000-000000000001'::uuid,'Ar Condicionado - Escritório','ar condicionado','Bloco A - 2° andar','Daikin','SkyAir FHQ','2022-03-15','alta','ativo'),
  ('d0000001-0000-0000-0000-000000000002'::uuid,'Elevador de Carga','elevador','Galpão A','Otis','Gen2 Freight','2019-08-01','alta','ativo'),
  ('d0000001-0000-0000-0000-000000000003'::uuid,'Sistema de CFTV','segurança','Perímetro total','Hikvision','DS-7600','2023-01-20','media','ativo')
) AS v(id,nm,cat,loc,mfr,md,dt,crit,st);

-- ====== EXTINTORES ======
INSERT INTO public.extinguishers (tenant_id, location, type, capacity, seal_number, inspection_expiration, recharge_expiration)
SELECT t.id, v.loc, v.tp, v.cap, v.seal, v.insp::date, v.rech::date FROM (SELECT id FROM public.tenants LIMIT 1) t,
(VALUES
  ('Escritório - Recepção','AP','10L','SEAL-001','2026-06-15','2027-06-15'),
  ('Galpão A - Entrada','PQS','6kg','SEAL-002','2026-04-30','2027-04-30'),
  ('Oficina - Elétrica','CO2','6kg','SEAL-003','2025-12-01','2026-12-01'),
  ('Galpão B - Corredor','AP','10L','SEAL-004','2026-08-20','2027-08-20')
) AS v(loc,tp,cap,seal,insp,rech);

-- ====== TÉCNICOS ======
INSERT INTO public.maintenance_technicians (id, tenant_id, name, contact, specialties, hourly_cost, active)
SELECT v.id, t.id, v.nm, v.ct, v.sp, v.hc, true FROM (SELECT id FROM public.tenants LIMIT 1) t,
(VALUES
  ('e0000001-0000-0000-0000-000000000001'::uuid,'Fernando Almeida','(11) 99887-6655','Mecânica diesel, suspensão, freios',85.0),
  ('e0000001-0000-0000-0000-000000000002'::uuid,'Roberto Santos','(11) 99776-5544','Elétrica automotiva, injeção eletrônica',95.0),
  ('e0000001-0000-0000-0000-000000000003'::uuid,'Paulo César Duarte','(11) 99665-4433','Ar condicionado, refrigeração, predial',75.0)
) AS v(id,nm,ct,sp,hc);

-- ====== FORNECEDORES ======
INSERT INTO public.suppliers (id, tenant_id, name, cnpj, contact_name, phone, email, address, active)
SELECT v.id, t.id, v.nm, v.cnpj, v.cn, v.ph, v.em, v.addr, true FROM (SELECT id FROM public.tenants LIMIT 1) t,
(VALUES
  ('f0000001-0000-0000-0000-000000000001'::uuid,'AutoPeças Nacional Ltda','12.345.678/0001-90','Sérgio Matos','(11) 3344-5566','sergio@autopecas.com.br','Rua das Indústrias, 500 - Guarulhos/SP'),
  ('f0000001-0000-0000-0000-000000000002'::uuid,'Lubrificantes Premium SA','23.456.789/0001-01','Fernanda Lima','(11) 3456-7890','fernanda@lubripremium.com.br','Av. Industrial, 1200 - Osasco/SP'),
  ('f0000001-0000-0000-0000-000000000003'::uuid,'Hidráulica e Cia','34.567.890/0001-12','João Pedro','(11) 2233-4455','joao@hidraulicacia.com.br','Rua Nogueira, 88 - Barueri/SP')
) AS v(id,nm,cnpj,cn,ph,em,addr);

-- ====== PEÇAS ======
INSERT INTO public.parts (id, tenant_id, sku, description, unit, category, min_stock, current_stock, average_cost, preferred_supplier, supplier_id, reserved_stock)
SELECT v.id, t.id, v.sku, v.desc_, v.un, v.cat, v.mins, v.cur, v.avg, v.pref, v.sid, v.res FROM (SELECT id FROM public.tenants LIMIT 1) t,
(VALUES
  ('10000001-0000-0000-0000-000000000001'::uuid,'OLE-15W40-20L','Óleo Motor 15W40 - 20L','un','veiculo',5.0,12.0,285.0,'Lubrificantes Premium SA','f0000001-0000-0000-0000-000000000002'::uuid,2.0),
  ('10000001-0000-0000-0000-000000000002'::uuid,'FIL-COMB-001','Filtro Combustível Parker','un','veiculo',10.0,8.0,42.5,'AutoPeças Nacional','f0000001-0000-0000-0000-000000000001'::uuid,0.0),
  ('10000001-0000-0000-0000-000000000003'::uuid,'FIL-OLEO-002','Filtro Óleo Tecfil','un','veiculo',10.0,15.0,35.0,'AutoPeças Nacional','f0000001-0000-0000-0000-000000000001'::uuid,1.0),
  ('10000001-0000-0000-0000-000000000004'::uuid,'PAST-FREIO-003','Pastilha de Freio Frasle','jogo','veiculo',4.0,3.0,189.9,'AutoPeças Nacional','f0000001-0000-0000-0000-000000000001'::uuid,0.0),
  ('10000001-0000-0000-0000-000000000005'::uuid,'CORR-ALT-004','Correia Alternador Gates','un','veiculo',3.0,6.0,78.5,'AutoPeças Nacional','f0000001-0000-0000-0000-000000000001'::uuid,0.0),
  ('10000001-0000-0000-0000-000000000006'::uuid,'LAMP-LED-005','Lâmpada LED 20W','un','facility',20.0,45.0,12.9,NULL,NULL,0.0),
  ('10000001-0000-0000-0000-000000000007'::uuid,'FIL-AC-006','Filtro Ar Condicionado','un','facility',5.0,4.0,55.0,NULL,NULL,0.0),
  ('10000001-0000-0000-0000-000000000008'::uuid,'OLEO-HIDR-007','Óleo Hidráulico 68 - 20L','un','veiculo',3.0,2.0,195.0,'Hidráulica e Cia','f0000001-0000-0000-0000-000000000003'::uuid,0.0)
) AS v(id,sku,desc_,un,cat,mins,cur,avg,pref,sid,res);

-- ====== TIPOS MANUTENÇÃO ======
INSERT INTO public.maintenance_types (tenant_id, name, description, is_preventive)
SELECT t.id, v.nm, v.desc_, v.prev FROM (SELECT id FROM public.tenants LIMIT 1) t,
(VALUES ('Preventiva','Manutenção preventiva programada',true),('Corretiva','Manutenção corretiva após falha',false),('Preditiva','Baseada em monitoramento',true)) AS v(nm,desc_,prev);

-- ====== SERVIÇOS MANUTENÇÃO ======
INSERT INTO public.maintenance_services (tenant_id, name, description, sla_hours)
SELECT t.id, v.nm, v.desc_, v.sla FROM (SELECT id FROM public.tenants LIMIT 1) t,
(VALUES ('Troca de Óleo e Filtros','Troca preventiva de óleo e filtros',4.0),('Revisão de Freios','Inspeção e substituição de freios',8.0),('Alinhamento e Balanceamento','Alinhamento e balanceamento',3.0),('Reparo Elétrico','Diagnóstico e reparo elétrico',12.0),('Manutenção AC','Limpeza e recarga de AC',6.0)) AS v(nm,desc_,sla);

-- ====== OS CONCLUÍDAS ======
INSERT INTO public.work_orders (id, tenant_id, type, vehicle_id, machine_id, facility_id, technician_id, priority, description, status, opening_date, start_date, completion_date, time_spent_hours, labor_cost, parts_cost)
SELECT v.id, t.id, v.tp, v.vid, v.mid, v.fid, v.tid, v.pri, v.desc_, v.st, v.od::timestamptz, v.sd::timestamptz, v.cd::timestamptz, v.hrs, v.lc, v.pc FROM (SELECT id FROM public.tenants LIMIT 1) t,
(VALUES
  ('20000001-0000-0000-0000-000000000001'::uuid,'vehicle','b0000001-0000-0000-0000-000000000001'::uuid,NULL::uuid,NULL::uuid,'e0000001-0000-0000-0000-000000000001'::uuid,'media','Troca de óleo e filtros - revisão 180.000km','concluida','2025-11-10 08:00-03','2025-11-10 09:00-03','2025-11-10 13:00-03',4.0,340.0,362.5),
  ('20000001-0000-0000-0000-000000000002'::uuid,'vehicle','b0000001-0000-0000-0000-000000000002'::uuid,NULL::uuid,NULL::uuid,'e0000001-0000-0000-0000-000000000001'::uuid,'alta','Pastilhas de freio desgastadas','concluida','2025-11-25 07:30-03','2025-11-25 08:30-03','2025-11-25 16:00-03',7.5,637.5,379.8),
  ('20000001-0000-0000-0000-000000000003'::uuid,'vehicle','b0000001-0000-0000-0000-000000000004'::uuid,NULL::uuid,NULL::uuid,'e0000001-0000-0000-0000-000000000002'::uuid,'baixa','Revisão elétrica - luzes do painel','concluida','2025-12-05 09:00-03','2025-12-05 10:00-03','2025-12-05 14:00-03',4.0,380.0,0.0),
  ('20000001-0000-0000-0000-000000000004'::uuid,'machine',NULL::uuid,'c0000001-0000-0000-0000-000000000001'::uuid,NULL::uuid,'e0000001-0000-0000-0000-000000000001'::uuid,'media','Troca de óleo hidráulico empilhadeira','concluida','2025-12-15 08:00-03','2025-12-15 09:00-03','2025-12-15 12:00-03',3.0,255.0,195.0),
  ('20000001-0000-0000-0000-000000000005'::uuid,'facility',NULL::uuid,NULL::uuid,'d0000001-0000-0000-0000-000000000001'::uuid,'e0000001-0000-0000-0000-000000000003'::uuid,'alta','AC do escritório sem resfriar','concluida','2026-01-08 07:00-03','2026-01-08 08:00-03','2026-01-08 15:00-03',7.0,525.0,55.0),
  ('20000001-0000-0000-0000-000000000006'::uuid,'vehicle','b0000001-0000-0000-0000-000000000006'::uuid,NULL::uuid,NULL::uuid,'e0000001-0000-0000-0000-000000000001'::uuid,'media','Troca de óleo motor DAF XF','concluida','2026-01-20 08:00-03','2026-01-20 09:00-03','2026-01-20 12:30-03',3.5,297.5,320.0),
  ('20000001-0000-0000-0000-000000000007'::uuid,'vehicle','b0000001-0000-0000-0000-000000000003'::uuid,NULL::uuid,NULL::uuid,'e0000001-0000-0000-0000-000000000002'::uuid,'urgente','Falha no sistema de injeção','concluida','2026-02-03 15:00-03','2026-02-03 16:30-03','2026-02-04 18:00-03',12.0,1140.0,450.0),
  ('20000001-0000-0000-0000-000000000008'::uuid,'machine',NULL::uuid,'c0000001-0000-0000-0000-000000000002'::uuid,NULL::uuid,'e0000001-0000-0000-0000-000000000001'::uuid,'media','Troca correia e filtro compressor','concluida','2026-02-15 08:00-03','2026-02-15 09:00-03','2026-02-15 14:00-03',5.0,425.0,235.0)
) AS v(id,tp,vid,mid,fid,tid,pri,desc_,st,od,sd,cd,hrs,lc,pc);

-- ====== OS ABERTAS (Março 2026) ======
INSERT INTO public.work_orders (id, tenant_id, type, vehicle_id, machine_id, facility_id, technician_id, priority, description, status, opening_date, start_date)
SELECT v.id, t.id, v.tp, v.vid, v.mid, v.fid, v.tid, v.pri, v.desc_, v.st, v.od::timestamptz, v.sd FROM (SELECT id FROM public.tenants LIMIT 1) t,
(VALUES
  ('20000001-0000-0000-0000-000000000009'::uuid,'vehicle','b0000001-0000-0000-0000-000000000001'::uuid,NULL::uuid,NULL::uuid,'e0000001-0000-0000-0000-000000000001'::uuid,'media','Revisão preventiva de freios 185k','em_atendimento','2026-03-05 08:00-03','2026-03-06 09:00-03'::timestamptz),
  ('20000001-0000-0000-0000-000000000010'::uuid,'vehicle','b0000001-0000-0000-0000-000000000005'::uuid,NULL::uuid,NULL::uuid,'e0000001-0000-0000-0000-000000000002'::uuid,'baixa','Alinhamento e balanceamento Corolla','aberta','2026-03-08 10:00-03',NULL::timestamptz),
  ('20000001-0000-0000-0000-000000000011'::uuid,'vehicle','b0000001-0000-0000-0000-000000000002'::uuid,NULL::uuid,NULL::uuid,'e0000001-0000-0000-0000-000000000001'::uuid,'alta','Vazamento de óleo no diferencial','aberta','2026-03-09 07:30-03',NULL::timestamptz),
  ('20000001-0000-0000-0000-000000000012'::uuid,'machine',NULL::uuid,'c0000001-0000-0000-0000-000000000003'::uuid,NULL::uuid,'e0000001-0000-0000-0000-000000000001'::uuid,'urgente','Paleteira com vazamento hidráulico','em_atendimento','2026-03-10 06:00-03','2026-03-10 07:00-03'::timestamptz),
  ('20000001-0000-0000-0000-000000000013'::uuid,'facility',NULL::uuid,NULL::uuid,'d0000001-0000-0000-0000-000000000002'::uuid,'e0000001-0000-0000-0000-000000000003'::uuid,'alta','Elevador de carga com ruído anormal','aberta','2026-03-10 08:00-03',NULL::timestamptz),
  ('20000001-0000-0000-0000-000000000014'::uuid,'vehicle','b0000001-0000-0000-0000-000000000007'::uuid,NULL::uuid,NULL::uuid,'e0000001-0000-0000-0000-000000000002'::uuid,'media','Troca de pneu moto CG 160','pecas','2026-03-07 11:00-03',NULL::timestamptz),
  ('20000001-0000-0000-0000-000000000015'::uuid,'facility',NULL::uuid,NULL::uuid,'d0000001-0000-0000-0000-000000000003'::uuid,'e0000001-0000-0000-0000-000000000003'::uuid,'baixa','Câmera 4 CFTV com imagem distorcida','aberta','2026-03-10 09:00-03',NULL::timestamptz)
) AS v(id,tp,vid,mid,fid,tid,pri,desc_,st,od,sd);

-- ====== PEÇAS EM OS ======
INSERT INTO public.work_order_items (work_order_id, part_id, quantity, unit_cost, status) VALUES
('20000001-0000-0000-0000-000000000001','10000001-0000-0000-0000-000000000001',1,285,'used'),
('20000001-0000-0000-0000-000000000001','10000001-0000-0000-0000-000000000003',1,35,'used'),
('20000001-0000-0000-0000-000000000001','10000001-0000-0000-0000-000000000002',1,42.5,'used'),
('20000001-0000-0000-0000-000000000002','10000001-0000-0000-0000-000000000004',2,189.9,'used'),
('20000001-0000-0000-0000-000000000004','10000001-0000-0000-0000-000000000008',1,195,'used'),
('20000001-0000-0000-0000-000000000005','10000001-0000-0000-0000-000000000007',1,55,'used'),
('20000001-0000-0000-0000-000000000006','10000001-0000-0000-0000-000000000001',1,285,'used'),
('20000001-0000-0000-0000-000000000006','10000001-0000-0000-0000-000000000003',1,35,'used'),
('20000001-0000-0000-0000-000000000007','10000001-0000-0000-0000-000000000002',2,42.5,'used'),
('20000001-0000-0000-0000-000000000007','10000001-0000-0000-0000-000000000005',1,78.5,'used'),
('20000001-0000-0000-0000-000000000008','10000001-0000-0000-0000-000000000005',1,78.5,'used'),
('20000001-0000-0000-0000-000000000009','10000001-0000-0000-0000-000000000004',1,189.9,'reserved'),
('20000001-0000-0000-0000-000000000009','10000001-0000-0000-0000-000000000001',1,285,'reserved');

-- ====== MOVIMENTAÇÕES ESTOQUE ======
INSERT INTO public.stock_movements (part_id, work_order_id, type, quantity, unit_cost, date, notes, tenant_id)
SELECT v.pid, v.woid, v.tp, v.qty, v.uc, v.dt::timestamptz, v.notes, t.id FROM (SELECT id FROM public.tenants LIMIT 1) t,
(VALUES
  ('10000001-0000-0000-0000-000000000001'::uuid,NULL::uuid,'in',20.0,280.0,'2025-10-05 10:00-03','Compra NF 12345'),
  ('10000001-0000-0000-0000-000000000002'::uuid,NULL::uuid,'in',20.0,40.0,'2025-10-05 10:00-03','Compra NF 12345'),
  ('10000001-0000-0000-0000-000000000003'::uuid,NULL::uuid,'in',20.0,33.0,'2025-10-05 10:00-03','Compra NF 12345'),
  ('10000001-0000-0000-0000-000000000004'::uuid,NULL::uuid,'in',10.0,185.0,'2025-10-10 14:00-03','Compra NF 12350'),
  ('10000001-0000-0000-0000-000000000005'::uuid,NULL::uuid,'in',10.0,75.0,'2025-10-10 14:00-03','Compra NF 12350'),
  ('10000001-0000-0000-0000-000000000006'::uuid,NULL::uuid,'in',50.0,12.0,'2025-11-01 09:00-03','Compra NF 12400'),
  ('10000001-0000-0000-0000-000000000007'::uuid,NULL::uuid,'in',8.0,52.0,'2025-11-01 09:00-03','Compra NF 12400'),
  ('10000001-0000-0000-0000-000000000008'::uuid,NULL::uuid,'in',5.0,190.0,'2025-11-15 11:00-03','Compra NF 12420'),
  ('10000001-0000-0000-0000-000000000001'::uuid,'20000001-0000-0000-0000-000000000001'::uuid,'out',1.0,285.0,'2025-11-10 13:00-03','Saída OS - Óleo Volvo FH'),
  ('10000001-0000-0000-0000-000000000003'::uuid,'20000001-0000-0000-0000-000000000001'::uuid,'out',1.0,35.0,'2025-11-10 13:00-03','Saída OS'),
  ('10000001-0000-0000-0000-000000000002'::uuid,'20000001-0000-0000-0000-000000000001'::uuid,'out',1.0,42.5,'2025-11-10 13:00-03','Saída OS'),
  ('10000001-0000-0000-0000-000000000004'::uuid,'20000001-0000-0000-0000-000000000002'::uuid,'out',2.0,189.9,'2025-11-25 16:00-03','Saída OS - Pastilha Scania'),
  ('10000001-0000-0000-0000-000000000008'::uuid,'20000001-0000-0000-0000-000000000004'::uuid,'out',1.0,195.0,'2025-12-15 12:00-03','Saída OS - Óleo hidráulico'),
  ('10000001-0000-0000-0000-000000000007'::uuid,'20000001-0000-0000-0000-000000000005'::uuid,'out',1.0,55.0,'2026-01-08 15:00-03','Saída OS - Filtro AC'),
  ('10000001-0000-0000-0000-000000000001'::uuid,'20000001-0000-0000-0000-000000000006'::uuid,'out',1.0,285.0,'2026-01-20 12:30-03','Saída OS - Óleo DAF'),
  ('10000001-0000-0000-0000-000000000003'::uuid,'20000001-0000-0000-0000-000000000006'::uuid,'out',1.0,35.0,'2026-01-20 12:30-03','Saída OS'),
  ('10000001-0000-0000-0000-000000000002'::uuid,'20000001-0000-0000-0000-000000000007'::uuid,'out',2.0,42.5,'2026-02-04 18:00-03','Saída OS - Filtros Actros'),
  ('10000001-0000-0000-0000-000000000005'::uuid,'20000001-0000-0000-0000-000000000007'::uuid,'out',1.0,78.5,'2026-02-04 18:00-03','Saída OS - Correia'),
  ('10000001-0000-0000-0000-000000000005'::uuid,'20000001-0000-0000-0000-000000000008'::uuid,'out',1.0,78.5,'2026-02-15 14:00-03','Saída OS - Correia compressor'),
  ('10000001-0000-0000-0000-000000000002'::uuid,NULL::uuid,'in',5.0,45.0,'2026-03-01 10:00-03','Reposição NF 12550'),
  ('10000001-0000-0000-0000-000000000004'::uuid,NULL::uuid,'in',3.0,195.0,'2026-03-01 10:00-03','Reposição NF 12550')
) AS v(pid,woid,tp,qty,uc,dt,notes);

-- ====== ABASTECIMENTOS ======
INSERT INTO public.fuelings (tenant_id, vehicle_id, driver_id, date, station, fuel_type, liters, price_per_liter, odometer_km, previous_odometer_km, is_full_tank)
SELECT t.id, v.vid, v.did, v.dt::timestamptz, v.st, v.ft, v.lit, v.ppl, v.odo, v.podo, v.full_ FROM (SELECT id FROM public.tenants LIMIT 1) t,
(VALUES
  ('b0000001-0000-0000-0000-000000000001'::uuid,'a0000001-0000-0000-0000-000000000001'::uuid,'2025-12-02 06:30-03','Posto Shell Anhanguera','diesel_s10',350.0,5.89,170200.0,0.0,true),
  ('b0000001-0000-0000-0000-000000000001'::uuid,'a0000001-0000-0000-0000-000000000001'::uuid,'2025-12-18 07:00-03','Posto Ipiranga Campinas','diesel_s10',320.0,5.79,173800.0,170200.0,true),
  ('b0000001-0000-0000-0000-000000000001'::uuid,'a0000001-0000-0000-0000-000000000001'::uuid,'2026-01-05 06:45-03','Posto BR Bandeirantes','diesel_s10',340.0,5.95,177500.0,173800.0,true),
  ('b0000001-0000-0000-0000-000000000001'::uuid,'a0000001-0000-0000-0000-000000000001'::uuid,'2026-01-22 07:15-03','Posto Shell Anhanguera','diesel_s10',355.0,5.85,181200.0,177500.0,true),
  ('b0000001-0000-0000-0000-000000000001'::uuid,'a0000001-0000-0000-0000-000000000001'::uuid,'2026-02-08 06:30-03','Posto Ipiranga Ribeirão','diesel_s10',330.0,5.99,184700.0,181200.0,true),
  ('b0000001-0000-0000-0000-000000000001'::uuid,'a0000001-0000-0000-0000-000000000001'::uuid,'2026-03-01 07:00-03','Posto BR Guarulhos','diesel_s10',345.0,5.92,188300.0,184700.0,true),
  ('b0000001-0000-0000-0000-000000000002'::uuid,'a0000001-0000-0000-0000-000000000002'::uuid,'2025-12-05 07:00-03','Posto Shell SP','diesel',310.0,5.49,196500.0,0.0,true),
  ('b0000001-0000-0000-0000-000000000002'::uuid,'a0000001-0000-0000-0000-000000000002'::uuid,'2025-12-22 06:30-03','Posto Ale Sorocaba','diesel',290.0,5.55,200100.0,196500.0,true),
  ('b0000001-0000-0000-0000-000000000002'::uuid,'a0000001-0000-0000-0000-000000000002'::uuid,'2026-01-10 07:30-03','Posto BR Jundiaí','diesel',305.0,5.65,203800.0,200100.0,true),
  ('b0000001-0000-0000-0000-000000000002'::uuid,'a0000001-0000-0000-0000-000000000002'::uuid,'2026-02-05 06:45-03','Posto Shell SP','diesel',320.0,5.52,207900.0,203800.0,true),
  ('b0000001-0000-0000-0000-000000000002'::uuid,'a0000001-0000-0000-0000-000000000002'::uuid,'2026-03-03 07:00-03','Posto Ipiranga Campinas','diesel',315.0,5.59,211500.0,207900.0,true),
  ('b0000001-0000-0000-0000-000000000004'::uuid,'a0000001-0000-0000-0000-000000000004'::uuid,'2025-12-10 08:00-03','Posto Shell Centro','diesel',80.0,6.15,60500.0,0.0,true),
  ('b0000001-0000-0000-0000-000000000004'::uuid,'a0000001-0000-0000-0000-000000000004'::uuid,'2026-01-15 08:30-03','Posto BR Tatuapé','diesel',75.0,6.09,63200.0,60500.0,true),
  ('b0000001-0000-0000-0000-000000000004'::uuid,'a0000001-0000-0000-0000-000000000004'::uuid,'2026-02-12 09:00-03','Posto Shell Centro','diesel',82.0,6.25,66100.0,63200.0,true),
  ('b0000001-0000-0000-0000-000000000004'::uuid,'a0000001-0000-0000-0000-000000000004'::uuid,'2026-03-08 08:15-03','Posto Ipiranga Mooca','diesel',78.0,6.19,68700.0,66100.0,true),
  ('b0000001-0000-0000-0000-000000000005'::uuid,NULL,'2025-12-20 12:00-03','Posto Shell Paulista','gasolina_aditivada',42.0,6.45,13200.0,0.0,true),
  ('b0000001-0000-0000-0000-000000000005'::uuid,NULL,'2026-01-28 11:30-03','Posto BR Pinheiros','gasolina_aditivada',40.0,6.39,14600.0,13200.0,true),
  ('b0000001-0000-0000-0000-000000000005'::uuid,NULL,'2026-03-05 12:00-03','Posto Shell Paulista','gasolina_aditivada',38.0,6.55,15900.0,14600.0,true),
  ('b0000001-0000-0000-0000-000000000006'::uuid,'a0000001-0000-0000-0000-000000000005'::uuid,'2025-12-08 06:00-03','Posto BR Regis Bittencourt','diesel_s10',380.0,5.75,310000.0,0.0,true),
  ('b0000001-0000-0000-0000-000000000006'::uuid,'a0000001-0000-0000-0000-000000000005'::uuid,'2026-01-12 06:30-03','Posto Shell Curitiba','diesel_s10',390.0,5.82,314200.0,310000.0,true),
  ('b0000001-0000-0000-0000-000000000006'::uuid,'a0000001-0000-0000-0000-000000000005'::uuid,'2026-02-18 07:00-03','Posto Ipiranga Registro','diesel_s10',370.0,5.90,318000.0,314200.0,true),
  ('b0000001-0000-0000-0000-000000000006'::uuid,'a0000001-0000-0000-0000-000000000005'::uuid,'2026-03-09 06:15-03','Posto BR Regis Bittencourt','diesel_s10',385.0,5.95,321800.0,318000.0,true),
  ('b0000001-0000-0000-0000-000000000001'::uuid,'a0000001-0000-0000-0000-000000000001'::uuid,'2026-02-20 07:00-03','Posto Shell Anhanguera','arla',50.0,3.50,185430.0,184700.0,false)
) AS v(vid,did,dt,st,ft,lit,ppl,odo,podo,full_);

-- ====== LAVA-JATO ======
INSERT INTO public.car_wash_schedules (tenant_id, vehicle_id, wash_type, scheduled_date, status, responsible, completion_date)
SELECT t.id, v.vid, v.wt, v.sd::timestamptz, v.st, v.resp, v.cd FROM (SELECT id FROM public.tenants LIMIT 1) t,
(VALUES
  ('b0000001-0000-0000-0000-000000000001'::uuid,'completa','2025-12-01 08:00-03','concluida','Equipe Lava-Jato','2025-12-01 10:00-03'::timestamptz),
  ('b0000001-0000-0000-0000-000000000002'::uuid,'completa','2025-12-01 10:30-03','concluida','Equipe Lava-Jato','2025-12-01 12:30-03'::timestamptz),
  ('b0000001-0000-0000-0000-000000000004'::uuid,'simples','2025-12-08 08:00-03','concluida','Equipe Lava-Jato','2025-12-08 09:00-03'::timestamptz),
  ('b0000001-0000-0000-0000-000000000001'::uuid,'completa','2025-12-15 08:00-03','concluida','Equipe Lava-Jato','2025-12-15 10:00-03'::timestamptz),
  ('b0000001-0000-0000-0000-000000000006'::uuid,'completa','2025-12-15 10:30-03','concluida','Equipe Lava-Jato','2025-12-15 12:30-03'::timestamptz),
  ('b0000001-0000-0000-0000-000000000005'::uuid,'simples','2026-01-05 08:00-03','concluida','Equipe Lava-Jato','2026-01-05 09:00-03'::timestamptz),
  ('b0000001-0000-0000-0000-000000000001'::uuid,'completa','2026-01-10 08:00-03','concluida','Equipe Lava-Jato','2026-01-10 10:00-03'::timestamptz),
  ('b0000001-0000-0000-0000-000000000002'::uuid,'completa','2026-01-15 08:00-03','concluida','Equipe Lava-Jato','2026-01-15 10:00-03'::timestamptz),
  ('b0000001-0000-0000-0000-000000000004'::uuid,'completa','2026-02-01 08:00-03','concluida','Equipe Lava-Jato','2026-02-01 10:00-03'::timestamptz),
  ('b0000001-0000-0000-0000-000000000006'::uuid,'completa','2026-02-01 10:30-03','concluida','Equipe Lava-Jato','2026-02-01 12:30-03'::timestamptz),
  ('b0000001-0000-0000-0000-000000000001'::uuid,'completa','2026-02-15 08:00-03','concluida','Equipe Lava-Jato','2026-02-15 10:00-03'::timestamptz),
  ('b0000001-0000-0000-0000-000000000007'::uuid,'simples','2026-02-20 08:00-03','concluida','Equipe Lava-Jato','2026-02-20 08:30-03'::timestamptz),
  ('b0000001-0000-0000-0000-000000000002'::uuid,'completa','2026-03-01 08:00-03','concluida','Equipe Lava-Jato','2026-03-01 10:00-03'::timestamptz),
  ('b0000001-0000-0000-0000-000000000001'::uuid,'completa','2026-03-10 08:00-03','em_execucao','Equipe Lava-Jato',NULL::timestamptz),
  ('b0000001-0000-0000-0000-000000000004'::uuid,'simples','2026-03-12 08:00-03','agendada','Equipe Lava-Jato',NULL::timestamptz),
  ('b0000001-0000-0000-0000-000000000006'::uuid,'completa','2026-03-12 10:00-03','agendada','Equipe Lava-Jato',NULL::timestamptz),
  ('b0000001-0000-0000-0000-000000000005'::uuid,'simples','2026-03-15 08:00-03','agendada','Equipe Lava-Jato',NULL::timestamptz),
  ('b0000001-0000-0000-0000-000000000003'::uuid,'completa','2026-02-10 08:00-03','cancelada','Equipe Lava-Jato',NULL::timestamptz)
) AS v(vid,wt,sd,st,resp,cd);

-- ====== REGRAS LAVA-JATO ======
INSERT INTO public.car_wash_rules (tenant_id, name, vehicle_type, frequency_days, delay_alert_days, active)
SELECT t.id, v.nm, v.vt, v.fd, v.da, true FROM (SELECT id FROM public.tenants LIMIT 1) t,
(VALUES ('Caminhões ativos - 15 dias','caminhão',15,3),('Vans de entrega - 10 dias','van',10,2),('Veículos admin - 30 dias','carro',30,5)) AS v(nm,vt,fd,da);

SELECT '✅ Seed data inserido com sucesso!' AS resultado;
