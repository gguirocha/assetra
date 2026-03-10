"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Truck, Wrench, Package, Calendar, Settings, ShieldAlert, ChevronDown, ChevronRight, Droplets, Fuel } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';

export function Sidebar() {
    const pathname = usePathname();
    const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({});

    // Initialize menus as open if a child is active
    useEffect(() => {
        if (pathname.startsWith('/fleet')) {
            setOpenMenus(prev => ({ ...prev, 'Gestão de Frota': true }));
        }
        if (pathname.startsWith('/maintenance-machines')) {
            setOpenMenus(prev => ({ ...prev, 'Manutenção de Máquinas': true }));
        }
        if (pathname.startsWith('/facilities')) {
            setOpenMenus(prev => ({ ...prev, 'Manutenção Predial (Facilities)': true }));
        }
        if (pathname.startsWith('/car-wash')) {
            setOpenMenus(prev => ({ ...prev, 'Lava-Jato': true }));
        }
        if (pathname.startsWith('/inventory')) {
            setOpenMenus(prev => ({ ...prev, 'Estoque e Fornecedores': true }));
        }
        if (pathname.startsWith('/fuel')) {
            setOpenMenus(prev => ({ ...prev, 'Abastecimentos': true }));
        }
    }, [pathname]);

    const menuItems = [
        { name: 'Dashboard', icon: Home, href: '/' },
        {
            name: 'Gestão de Frota',
            icon: Truck,
            href: '/fleet',
            subItems: [
                { name: 'Veículos', href: '/fleet/vehicles' },
                { name: 'Documentos', href: '/fleet/documents' },
                { name: 'Motoristas & CNH', href: '/fleet/drivers' },
                { name: 'Multas', href: '/fleet/fines' },
                { name: 'Tacógrafos', href: '/fleet/tachographs' },
                { name: 'Garantias', href: '/fleet/warranties' },
                { name: 'Exames Médicos', href: '/fleet/driver-exams' },
                { name: 'Seguros', href: '/fleet/insurances' },
            ]
        },
        {
            name: 'Manutenção',
            icon: Wrench,
            href: '/maintenance',
            subItems: [
                { name: 'Catálogos', href: '/maintenance/catalogs' },
                { name: 'Planos Preventivos', href: '/maintenance/preventive-plans' },
                { name: 'Ordens de Serviço', href: '/maintenance/orders' },
                { name: 'Equipe de Manutenção', href: '/maintenance/team' },
                { name: 'Portal do Técnico', href: '/maintenance/my-orders' },
                { name: 'Minhas Solicitações', href: '/maintenance/my-requests' },
            ]
        },
        {
            name: 'Manutenção de Máquinas',
            icon: Wrench,
            href: '/maintenance-machines',
            subItems: [
                { name: 'Máquinas Cadastradas', href: '/maintenance-machines/assets' },
                { name: 'Ordens de Serviço (OS)', href: '/maintenance-machines/orders' },
                { name: 'Planos Preventivos', href: '/maintenance-machines/preventive-plans' },
            ]
        },
        {
            name: 'Manutenção Predial',
            icon: ShieldAlert,
            href: '/facilities',
            subItems: [
                { name: 'Ativos Prediais', href: '/facilities/assets' },
                { name: 'Extintores', href: '/facilities/extinguishers' },
                { name: 'Ordens de Serviço (OS)', href: '/facilities/orders' },
                { name: 'Planos Preventivos', href: '/facilities/preventive-plans' },
            ]
        },
        {
            name: 'Estoque e Fornecedores',
            icon: Package,
            href: '/inventory',
            subItems: [
                { name: 'Itens em Estoque', href: '/inventory' },
                { name: 'Entrada Manual', href: '/inventory/entry' },
                { name: 'Movimentações', href: '/inventory/movements' },
                { name: 'Fornecedores', href: '/inventory/suppliers' },
            ]
        },
        {
            name: 'Abastecimentos',
            icon: Fuel,
            href: '/fuel',
            subItems: [
                { name: 'Registros', href: '/fuel' },
                { name: 'Por Veículo', href: '/fuel/vehicle' },
            ]
        },
        {
            name: 'Lava-Jato',
            icon: Droplets,
            href: '/car-wash',
            subItems: [
                { name: 'Agenda de Lavagem', href: '/car-wash' },
                { name: 'Regras Automáticas', href: '/car-wash/rules' },
            ]
        },
        { name: 'Agenda', icon: Calendar, href: '/calendar' },
        {
            name: 'Configurações',
            icon: Settings,
            href: '/settings',
            subItems: [
                { name: 'Usuários', href: '/settings' },
                { name: 'Roles e Permissões', href: '/settings/roles' },
                { name: 'Auditoria', href: '/settings/audit' },
                { name: 'Notificações', href: '/settings/notifications' },
                { name: 'Automações', href: '/settings/automations' },
                { name: 'Sistema (SMTP/SLA)', href: '/settings/system' },
            ]
        },
    ];

    const toggleMenu = (name: string) => {
        setOpenMenus(prev => ({ ...prev, [name]: !prev[name] }));
    };

    return (
        <aside className="w-64 bg-[#0a0a0f]/80 backdrop-blur-xl border-r border-white/5 text-slate-400 h-screen flex flex-col shrink-0 transition-all z-20">
            <div className="h-28 flex items-center justify-center border-b border-white/5 py-4">
                <img src="/logo.png" alt="Assetra Logo" className="h-20 w-auto object-contain drop-shadow-[0_0_15px_rgba(0,229,255,0.4)]" />
            </div>
            <nav className="flex-1 overflow-y-auto py-4">
                <ul className="space-y-1">
                    {menuItems.map((item) => {
                        const hasSubItems = !!item.subItems;
                        const isChildActive = hasSubItems && item.subItems!.some(sub => pathname === sub.href);
                        const isActive = pathname === item.href || isChildActive;
                        const isOpen = openMenus[item.name];

                        return (
                            <li key={item.name} className="flex flex-col">
                                {hasSubItems ? (
                                    <button
                                        onClick={() => toggleMenu(item.name)}
                                        className={cn(
                                            'flex items-center justify-between px-4 py-3 mx-2 rounded-lg transition-all w-[calc(100%-1rem)]',
                                            isActive || isOpen ? 'bg-white/5 text-white glow-primary-strong border border-white/10' : 'hover:bg-white/5 hover:text-white'
                                        )}
                                    >
                                        <div className="flex items-center">
                                            <item.icon className="w-5 h-5 mr-3" />
                                            {item.name}
                                        </div>
                                        {isOpen ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                                    </button>
                                ) : (
                                    <Link
                                        href={item.href}
                                        className={cn(
                                            'flex items-center px-4 py-3 mx-2 rounded-lg transition-all',
                                            isActive ? 'bg-[#5B5CFF] text-white glow-primary font-medium' : 'hover:bg-white/5 hover:text-white'
                                        )}
                                    >
                                        <item.icon className="w-5 h-5 mr-3" />
                                        {item.name}
                                    </Link>
                                )}

                                {hasSubItems && isOpen && (
                                    <ul className="mt-1 space-y-1 pl-10 pr-2">
                                        {item.subItems!.map((sub) => (
                                            <li key={sub.name}>
                                                <Link
                                                    href={sub.href}
                                                    className={cn(
                                                        "block px-3 py-2 text-sm rounded-lg transition-all",
                                                        pathname === sub.href
                                                            ? "text-white bg-white/10 border border-[#00E5FF]/30 glow-secondary"
                                                            : "text-slate-500 hover:text-white hover:bg-white/5"
                                                    )}
                                                >
                                                    {sub.name}
                                                </Link>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </li>
                        );
                    })}
                </ul>
            </nav>
            <div className="p-4 border-t border-white/5 text-center">
                <p className="text-[10px] text-slate-600">
                    <span className="text-[#00E5FF]/40 font-semibold">Assetra</span> <span className="text-slate-700">v1.0.0</span>
                </p>
                <p className="text-[9px] text-slate-700 mt-0.5">
                    © {new Date().getFullYear()} Guilherme Rocha<br />
                    BlackGear Solutions
                </p>
            </div>
        </aside>
    );
}
