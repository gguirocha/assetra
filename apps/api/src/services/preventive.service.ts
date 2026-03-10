import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

export async function checkAndGeneratePreventiveOrders() {
    console.log('Iniciando verificação de Planos Preventivos...');

    try {
        // 1. Fetch all active preventive plans
        const { data: plans, error } = await supabaseAdmin
            .from('preventive_plans')
            .select(`
                *,
                maintenance_services ( name, description )
            `)
            .eq('active', true);

        if (error) throw error;
        if (!plans || plans.length === 0) {
            console.log('Nenhum plano preventivo ativo encontrado.');
            return;
        }

        const today = new Date();
        const generatedOrders = [];

        for (const plan of plans) {
            let shouldTrigger = false;
            let currentUsages = null;

            // Resolve target asset and its current usage (km or hours)
            let assetType: 'vehicle' | 'machine' | 'facility' | null = null;
            let assetId = null;
            let currentOdoOrHours = 0;

            if (plan.vehicle_id) {
                assetType = 'vehicle';
                assetId = plan.vehicle_id;
                const { data } = await supabaseAdmin.from('vehicles').select('current_odometer').eq('id', assetId).single();
                if (data) currentOdoOrHours = data.current_odometer || 0;
            } else if (plan.machine_id) {
                assetType = 'machine';
                assetId = plan.machine_id;
                const { data } = await supabaseAdmin.from('assets_machines').select('usage_hours').eq('id', assetId).single();
                if (data) currentOdoOrHours = data.usage_hours || 0;
            } else if (plan.facility_id) {
                assetType = 'facility';
                assetId = plan.facility_id;
                // Facilities generally don't have usage meters in this schema, rely on days
            }

            // Check triggers
            if (plan.trigger_type === 'days' || plan.trigger_type === 'both') {
                if (plan.trigger_days) {
                    const lastDate = plan.last_triggered_date ? new Date(plan.last_triggered_date) : new Date(plan.created_at);
                    const diffTime = today.getTime() - lastDate.getTime();
                    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

                    if (diffDays >= plan.trigger_days) {
                        shouldTrigger = true;
                    }
                }
            }

            if (!shouldTrigger && (plan.trigger_type === 'km' || plan.trigger_type === 'both' || plan.trigger_type === 'hours')) {
                if (plan.trigger_km && currentOdoOrHours > 0) {
                    const lastUsage = plan.last_triggered_km || 0;
                    if (currentOdoOrHours >= (lastUsage + plan.trigger_km)) {
                        shouldTrigger = true;
                        currentUsages = currentOdoOrHours;
                    }
                }
            }

            if (shouldTrigger && assetType && assetId) {
                console.log(`Disparando OS preventiva para o Plano ID: ${plan.id} (${assetType})`);

                // Create Work Order
                const orderData: any = {
                    tenant_id: plan.tenant_id,
                    type: assetType,
                    priority: 'media',
                    status: 'aberta',
                    description: `[PREVENTIVA AUTOMÁTICA] ${plan.title}\n\nServiço: ${plan.maintenance_services?.name || 'N/A'}\n${plan.maintenance_services?.description || ''}`,
                    opening_date: new Date().toISOString()
                };

                if (assetType === 'vehicle') orderData.vehicle_id = assetId;
                if (assetType === 'machine') orderData.machine_id = assetId;
                if (assetType === 'facility') orderData.facility_id = assetId;

                const { data: newOrder, error: orderError } = await supabaseAdmin.from('work_orders').insert([orderData]).select().single();

                if (orderError) {
                    console.error('Erro ao criar OS preventiva:', orderError);
                } else {
                    generatedOrders.push(newOrder);

                    // Update Plan last_triggered info
                    const updateData: any = {
                        last_triggered_date: new Date().toISOString().split('T')[0]
                    };
                    if (currentUsages !== null) {
                        updateData.last_triggered_km = currentUsages;
                    }

                    await supabaseAdmin.from('preventive_plans').update(updateData).eq('id', plan.id);
                }
            }
        }

        console.log(`Verificação concluída. ${generatedOrders.length} Ordens de Serviço Preventivas geradas.`);
    } catch (error) {
        console.error('Erro na rotina de Planos Preventivos:', error);
    }
}
