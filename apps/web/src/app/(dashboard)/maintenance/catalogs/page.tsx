"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Plus, Search, Edit2, Trash2, Tag, Wrench, Settings } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

// Define schemas
const typeSchema = z.object({
    name: z.string().min(1, 'Nome é obrigatório'),
    description: z.string().optional(),
    is_preventive: z.boolean().default(false),
    active: z.boolean().default(true),
});

const serviceSchema = z.object({
    name: z.string().min(1, 'Nome é obrigatório'),
    description: z.string().optional(),
    sla_hours: z.coerce.number().min(0, 'SLA deve ser positivo').default(24),
    active: z.boolean().default(true),
});

type TypeFormValues = z.infer<typeof typeSchema>;
type ServiceFormValues = z.infer<typeof serviceSchema>;

export default function MaintenanceCatalogsPage() {
    const { session } = useAuth();
    const [activeTab, setActiveTab] = useState<'types' | 'services'>('types');
    const [searchTerm, setSearchTerm] = useState('');

    // State for Types
    const [types, setTypes] = useState<any[]>([]);
    const [loadingTypes, setLoadingTypes] = useState(false);
    const [isTypeModalOpen, setIsTypeModalOpen] = useState(false);
    const [editingTypeId, setEditingTypeId] = useState<string | null>(null);

    // State for Services
    const [services, setServices] = useState<any[]>([]);
    const [loadingServices, setLoadingServices] = useState(false);
    const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
    const [editingServiceId, setEditingServiceId] = useState<string | null>(null);

    // Form for Types
    const typeForm = useForm<TypeFormValues>({
        resolver: zodResolver(typeSchema) as any,
        defaultValues: { is_preventive: false, active: true }
    });

    // Form for Services
    const serviceForm = useForm<ServiceFormValues>({
        resolver: zodResolver(serviceSchema) as any,
        defaultValues: { sla_hours: 24, active: true }
    });

    // Fetching data
    const fetchTypes = async () => {
        setLoadingTypes(true);
        const { data, error } = await supabase.from('maintenance_types').select('*').order('name');
        if (!error && data) setTypes(data);
        setLoadingTypes(false);
    };

    const fetchServices = async () => {
        setLoadingServices(true);
        const { data, error } = await supabase.from('maintenance_services').select('*').order('name');
        if (!error && data) setServices(data);
        setLoadingServices(false);
    };

    useEffect(() => {
        fetchTypes();
        fetchServices();
    }, []);

    // Submit Handlers
    const onTypeSubmit = async (data: TypeFormValues) => {
        try {
            if (editingTypeId) {
                const { error } = await supabase.from('maintenance_types').update(data).eq('id', editingTypeId);
                if (error) throw error;
            } else {
                let tenant_id = null;
                if (session?.user) {
                    const { data: prof } = await supabase.from('user_profiles').select('tenant_id').eq('id', session.user.id).single();
                    tenant_id = prof?.tenant_id;
                }
                const { error } = await supabase.from('maintenance_types').insert([{ ...data, tenant_id }]);
                if (error) throw error;
            }
            setIsTypeModalOpen(false);
            setEditingTypeId(null);
            typeForm.reset();
            fetchTypes();
        } catch (err: any) {
            alert('Erro: ' + err.message);
        }
    };

    const onServiceSubmit = async (data: ServiceFormValues) => {
        try {
            if (editingServiceId) {
                const { error } = await supabase.from('maintenance_services').update(data).eq('id', editingServiceId);
                if (error) throw error;
            } else {
                let tenant_id = null;
                if (session?.user) {
                    const { data: prof } = await supabase.from('user_profiles').select('tenant_id').eq('id', session.user.id).single();
                    tenant_id = prof?.tenant_id;
                }
                const { error } = await supabase.from('maintenance_services').insert([{ ...data, tenant_id }]);
                if (error) throw error;
            }
            setIsServiceModalOpen(false);
            setEditingServiceId(null);
            serviceForm.reset();
            fetchServices();
        } catch (err: any) {
            alert('Erro: ' + err.message);
        }
    };

    // Delete handlers
    const handleDeleteType = async (id: string) => {
        if (!confirm('Excluir este tipo?')) return;
        const { error } = await supabase.from('maintenance_types').delete().eq('id', id);
        if (error) alert('Erro ao excluir: ' + error.message);
        else fetchTypes();
    };

    const handleDeleteService = async (id: string) => {
        if (!confirm('Excluir este serviço?')) return;
        const { error } = await supabase.from('maintenance_services').delete().eq('id', id);
        if (error) alert('Erro ao excluir: ' + error.message);
        else fetchServices();
    };

    // Open Modals
    const openNewType = () => {
        setEditingTypeId(null);
        typeForm.reset({ is_preventive: false, active: true });
        setIsTypeModalOpen(true);
    };

    const openEditType = (type: any) => {
        setEditingTypeId(type.id);
        typeForm.reset({
            name: type.name,
            description: type.description || '',
            is_preventive: type.is_preventive,
            active: type.active
        });
        setIsTypeModalOpen(true);
    };

    const openNewService = () => {
        setEditingServiceId(null);
        serviceForm.reset({ sla_hours: 24, active: true });
        setIsServiceModalOpen(true);
    };

    const openEditService = (service: any) => {
        setEditingServiceId(service.id);
        serviceForm.reset({
            name: service.name,
            description: service.description || '',
            sla_hours: service.sla_hours,
            active: service.active
        });
        setIsServiceModalOpen(true);
    };

    const filteredTypes = types.filter(t => t.name.toLowerCase().includes(searchTerm.toLowerCase()));
    const filteredServices = services.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()));

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-white tracking-tight">Catálogos de Manutenção</h1>
                    <p className="text-slate-400 mt-1">Gerencie os tipos e serviços usados nas Ordens de Serviço.</p>
                </div>
            </div>

            {/* Custom Tabs */}
            <div className="flex space-x-4 border-b border-white/10 pb-2">
                <button
                    onClick={() => setActiveTab('types')}
                    className={`pb-2 px-4 font-medium transition-colors border-b-2 flex items-center space-x-2 ${activeTab === 'types' ? 'border-[#00E5FF] text-[#00E5FF]' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
                >
                    <Tag className="w-4 h-4" />
                    <span>Tipos de Manutenção</span>
                </button>
                <button
                    onClick={() => setActiveTab('services')}
                    className={`pb-2 px-4 font-medium transition-colors border-b-2 flex items-center space-x-2 ${activeTab === 'services' ? 'border-[#00E5FF] text-[#00E5FF]' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
                >
                    <Wrench className="w-4 h-4" />
                    <span>Serviços & SLA</span>
                </button>
            </div>

            <Card className="glass-card bg-[#0f0f14]/50 border-white/5">
                <CardHeader className="flex flex-row items-center justify-between border-b border-white/5 pb-4">
                    <CardTitle className="text-lg font-semibold text-white">
                        {activeTab === 'types' ? 'Tipos Registrados' : 'Serviços Registrados'}
                    </CardTitle>
                    <div className="flex items-center space-x-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                            <Input
                                placeholder="Buscar..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-9 w-64 bg-black/20 border-white/10 text-white placeholder:text-slate-500"
                            />
                        </div>
                        {activeTab === 'types' ? (
                            <Button onClick={openNewType} className="bg-[#5B5CFF] hover:bg-[#5B5CFF]/80 text-white">
                                <Plus className="w-4 h-4 mr-2" /> Novo Tipo
                            </Button>
                        ) : (
                            <Button onClick={openNewService} className="bg-[#5B5CFF] hover:bg-[#5B5CFF]/80 text-white">
                                <Plus className="w-4 h-4 mr-2" /> Novo Serviço
                            </Button>
                        )}
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    {activeTab === 'types' && (
                        <Table>
                            <TableHeader className="bg-black/40">
                                <TableRow className="border-white/5 hover:bg-transparent">
                                    <TableHead className="text-slate-400">Nome</TableHead>
                                    <TableHead className="text-slate-400">Descrição</TableHead>
                                    <TableHead className="text-slate-400">Preventiva?</TableHead>
                                    <TableHead className="text-slate-400">Status</TableHead>
                                    <TableHead className="text-right text-slate-400">Ações</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loadingTypes ? (
                                    <TableRow><td colSpan={5} className="text-center py-8 text-slate-400">Carregando...</td></TableRow>
                                ) : filteredTypes.length === 0 ? (
                                    <TableRow><td colSpan={5} className="text-center py-8 text-slate-400">Nenhum tipo encontrado.</td></TableRow>
                                ) : (
                                    filteredTypes.map((type) => (
                                        <TableRow key={type.id} className="border-white/5 hover:bg-white/[0.02] hover:shadow-[inset_4px_0_0_0_#00E5FF] transition-all">
                                            <TableCell className="font-medium text-white">{type.name}</TableCell>
                                            <TableCell className="text-slate-400">{type.description || '-'}</TableCell>
                                            <TableCell>
                                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${type.is_preventive ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'bg-slate-500/20 text-slate-400 border border-slate-500/30'}`}>
                                                    {type.is_preventive ? 'Sim' : 'Não'}
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${type.active ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}>
                                                    {type.active ? 'Ativo' : 'Inativo'}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="ghost" size="sm" onClick={() => openEditType(type)} className="text-slate-400 hover:text-white hover:bg-white/10">
                                                    <Edit2 className="w-4 h-4" />
                                                </Button>
                                                <Button variant="ghost" size="sm" onClick={() => handleDeleteType(type.id)} className="text-red-400 hover:text-red-300 hover:bg-red-400/10">
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    )}

                    {activeTab === 'services' && (
                        <Table>
                            <TableHeader className="bg-black/40">
                                <TableRow className="border-white/5 hover:bg-transparent">
                                    <TableHead className="text-slate-400">Serviço</TableHead>
                                    <TableHead className="text-slate-400">Descrição</TableHead>
                                    <TableHead className="text-slate-400">SLA (Horas)</TableHead>
                                    <TableHead className="text-slate-400">Status</TableHead>
                                    <TableHead className="text-right text-slate-400">Ações</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loadingServices ? (
                                    <TableRow><td colSpan={5} className="text-center py-8 text-slate-400">Carregando...</td></TableRow>
                                ) : filteredServices.length === 0 ? (
                                    <TableRow><td colSpan={5} className="text-center py-8 text-slate-400">Nenhum serviço encontrado.</td></TableRow>
                                ) : (
                                    filteredServices.map((service) => (
                                        <TableRow key={service.id} className="border-white/5 hover:bg-white/[0.02] hover:shadow-[inset_4px_0_0_0_#00E5FF] transition-all">
                                            <TableCell className="font-medium text-white">{service.name}</TableCell>
                                            <TableCell className="text-slate-400">{service.description || '-'}</TableCell>
                                            <TableCell>
                                                <span className="text-[#00E5FF] font-mono">{service.sla_hours}h</span>
                                            </TableCell>
                                            <TableCell>
                                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${service.active ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}>
                                                    {service.active ? 'Ativo' : 'Inativo'}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="ghost" size="sm" onClick={() => openEditService(service)} className="text-slate-400 hover:text-white hover:bg-white/10">
                                                    <Edit2 className="w-4 h-4" />
                                                </Button>
                                                <Button variant="ghost" size="sm" onClick={() => handleDeleteService(service.id)} className="text-red-400 hover:text-red-300 hover:bg-red-400/10">
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* Modal for Types */}
            <Modal isOpen={isTypeModalOpen} onClose={() => setIsTypeModalOpen(false)} title={editingTypeId ? 'Editar Tipo de Manutenção' : 'Novo Tipo de Manutenção'}>
                <form onSubmit={typeForm.handleSubmit(onTypeSubmit)} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-300">Nome</label>
                        <Input {...typeForm.register('name')} placeholder="Ex: Preventiva" className="mt-1 bg-black/20 border-white/10 text-white" />
                        {typeForm.formState.errors.name && <p className="text-red-400 text-xs mt-1">{typeForm.formState.errors.name.message}</p>}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-300">Descrição</label>
                        <Input {...typeForm.register('description')} placeholder="Ex: Manutenção agendada e recorrente" className="mt-1 bg-black/20 border-white/10 text-white" />
                    </div>

                    <div className="flex items-center space-x-2 mt-4">
                        <input type="checkbox" id="is_preventive" {...typeForm.register('is_preventive')} className="rounded border-slate-700 bg-slate-900 text-[#00E5FF] focus:ring-[#00E5FF]" />
                        <label htmlFor="is_preventive" className="text-sm font-medium text-slate-300">É preventiva?</label>
                    </div>

                    <div className="flex items-center space-x-2 mt-2">
                        <input type="checkbox" id="type_active" {...typeForm.register('active')} className="rounded border-slate-700 bg-slate-900 text-[#00E5FF] focus:ring-[#00E5FF]" />
                        <label htmlFor="type_active" className="text-sm font-medium text-slate-300">Ativo</label>
                    </div>

                    <div className="flex justify-end space-x-3 pt-4 border-t border-white/10">
                        <Button type="button" variant="ghost" onClick={() => setIsTypeModalOpen(false)} className="border border-white/10 text-slate-300 hover:bg-white/5">
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={typeForm.formState.isSubmitting} className="bg-gradient-to-r from-[#5B5CFF] to-[#00E5FF] text-white border-0">
                            {typeForm.formState.isSubmitting ? 'Salvando...' : 'Salvar'}
                        </Button>
                    </div>
                </form>
            </Modal>

            {/* Modal for Services */}
            <Modal isOpen={isServiceModalOpen} onClose={() => setIsServiceModalOpen(false)} title={editingServiceId ? 'Editar Serviço' : 'Novo Serviço'}>
                <form onSubmit={serviceForm.handleSubmit(onServiceSubmit)} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-300">Nome do Serviço</label>
                        <Input {...serviceForm.register('name')} placeholder="Ex: Troca de Óleo" className="mt-1 bg-black/20 border-white/10 text-white" />
                        {serviceForm.formState.errors.name && <p className="text-red-400 text-xs mt-1">{serviceForm.formState.errors.name.message}</p>}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-300">Descrição</label>
                        <Input {...serviceForm.register('description')} placeholder="Opcional" className="mt-1 bg-black/20 border-white/10 text-white" />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-300">SLA Padrão (Horas)</label>
                        <Input type="number" step="0.5" {...serviceForm.register('sla_hours')} className="mt-1 bg-black/20 border-white/10 text-white" />
                        {serviceForm.formState.errors.sla_hours && <p className="text-red-400 text-xs mt-1">{serviceForm.formState.errors.sla_hours.message}</p>}
                        <p className="text-xs text-slate-500 mt-1">Tempo estimado para resolução deste serviço.</p>
                    </div>

                    <div className="flex items-center space-x-2 mt-4">
                        <input type="checkbox" id="service_active" {...serviceForm.register('active')} className="rounded border-slate-700 bg-slate-900 text-[#00E5FF] focus:ring-[#00E5FF]" />
                        <label htmlFor="service_active" className="text-sm font-medium text-slate-300">Ativo</label>
                    </div>

                    <div className="flex justify-end space-x-3 pt-4 border-t border-white/10">
                        <Button type="button" variant="ghost" onClick={() => setIsServiceModalOpen(false)} className="border border-white/10 text-slate-300 hover:bg-white/5">
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={serviceForm.formState.isSubmitting} className="bg-gradient-to-r from-[#5B5CFF] to-[#00E5FF] text-white border-0">
                            {serviceForm.formState.isSubmitting ? 'Salvando...' : 'Salvar'}
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
