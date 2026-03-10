import { createClient } from '@supabase/supabase-js';
import { sendEmail } from './email.service';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, serviceRoleKey);

// Target specific day thresholds
const ALERT_DAYS = [30, 15, 7];

interface ExpiringItem {
    type: string;
    description: string;
    endDate: string;
    daysDiff: number;
    tenantId: string;
}

export async function checkAndSendExpirationAlerts() {
    console.log('[Expiration Service] Starting checks...');
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const allExpiringItems: ExpiringItem[] = [];

    // Helper query function for different tables relying on vehicle context (tenant_id from vehicles)
    const fetchVehicleLinkedItems = async (table: string, dateCol: string, itemType: string, descBuilder: (row: any) => string) => {
        const { data, error } = await supabase
            .from(table)
            .select(`*, vehicles!inner(tenant_id, plate)`)
            .gte(dateCol, today.toISOString().split('T')[0]); // Only look at future/today items or we could also include expired ones, but let's focus on future alerts

        if (error) {
            console.error(`Error fetching ${table}:`, error);
            return;
        }

        for (const row of data || []) {
            const expDate = new Date(row[dateCol]);
            expDate.setHours(0, 0, 0, 0);
            const diffTime = expDate.getTime() - today.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (ALERT_DAYS.includes(diffDays)) {
                allExpiringItems.push({
                    type: itemType,
                    description: descBuilder(row),
                    endDate: row[dateCol],
                    daysDiff: diffDays,
                    tenantId: row.vehicles.tenant_id
                });
            }
        }
    };

    // Helper query function for drivers linked items
    const fetchDriverLinkedItems = async (table: string, dateCol: string, itemType: string, descBuilder: (row: any) => string) => {
        const { data, error } = await supabase
            .from(table)
            .select(`*, drivers!inner(tenant_id, name)`)
            .gte(dateCol, today.toISOString().split('T')[0]);

        if (error) {
            console.error(`Error fetching ${table}:`, error);
            return;
        }

        for (const row of data || []) {
            const expDate = new Date(row[dateCol]);
            expDate.setHours(0, 0, 0, 0);
            const diffTime = expDate.getTime() - today.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (ALERT_DAYS.includes(diffDays)) {
                allExpiringItems.push({
                    type: itemType,
                    description: descBuilder(row),
                    endDate: row[dateCol],
                    daysDiff: diffDays,
                    tenantId: row.drivers.tenant_id
                });
            }
        }
    };

    // 1. Vehicle Documents
    await fetchVehicleLinkedItems('vehicle_documents', 'expiration_date', 'Documento de Veículo', row => `${row.type} do veículo placa ${row.vehicles.plate.toUpperCase()}`);

    // 2. Tachographs
    await fetchVehicleLinkedItems('tachograph_checks', 'expiration_date', 'Aferição de Tacógrafo', row => `Aferição do veículo placa ${row.vehicles.plate.toUpperCase()}`);

    // 3. Warranties
    await fetchVehicleLinkedItems('warranties', 'end_date', 'Garantia', row => `Garantia de ${row.item_name} (Veículo: ${row.vehicles.plate.toUpperCase()})`);

    // 4. Insurances
    await fetchVehicleLinkedItems('insurances', 'end_date', 'Seguro/Apólice', row => `Seguro ${row.insurer_name} (Veículo: ${row.vehicles.plate.toUpperCase()})`);

    // 5. Driver Exams
    await fetchDriverLinkedItems('driver_documents', 'expiration_date', 'Exame Médico', row => `Exame ${row.type} do motorista ${row.drivers.name}`);

    // 6. CNH (Drivers Table itself)
    const { data: driversData, error: dError } = await supabase.from('drivers').select('*').gte('cnh_expiration', today.toISOString().split('T')[0]);
    if (!dError && driversData) {
        for (const row of driversData) {
            if (!row.cnh_expiration) continue;
            const expDate = new Date(row.cnh_expiration);
            expDate.setHours(0, 0, 0, 0);
            const diffTime = expDate.getTime() - today.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (ALERT_DAYS.includes(diffDays)) {
                allExpiringItems.push({
                    type: 'CNH',
                    description: `CNH do motorista ${row.name}`,
                    endDate: row.cnh_expiration,
                    daysDiff: diffDays,
                    tenantId: row.tenant_id
                });
            }
        }
    }

    if (allExpiringItems.length === 0) {
        console.log('[Expiration Service] No alerts found for today thresholds.');
        return;
    }

    // Group items by tenant
    const groupedByTenant: Record<string, ExpiringItem[]> = {};
    for (const item of allExpiringItems) {
        if (!groupedByTenant[item.tenantId]) groupedByTenant[item.tenantId] = [];
        groupedByTenant[item.tenantId].push(item);
    }

    // For each tenant, fetch Admins to send emails
    for (const [tenantId, items] of Object.entries(groupedByTenant)) {
        // Fetch users in this tenant with ADMIN role (or any role who should receive this - for now let's send to all users of that tenant or specific emails)
        // Usually, user profiles have an email and a tenant_id. Let's select all 'ADMIN' or 'GESTOR_FROTA' in that tenant.
        // If we don't have roles perfectly mapped per user, we just send to all profiles in that tenant.
        const { data: usersData, error: uError } = await supabase
            .from('user_profiles')
            .select('id, auth_id, user_roles!inner(role_name)')
            .eq('tenant_id', tenantId);

        if (uError || !usersData || usersData.length === 0) continue;

        // the 'email' is in auth.users, but we might not have direct access from user_profiles unless joined. 
        // We can use Supabase admin auth api to get user emails, or use the email from user_profiles if it exists. 
        // Wait, did we store email in user_profiles? Let's check schema.

        let recipientEmails: string[] = [];

        // Let's get email from auth.users using admin api
        for (const u of usersData) {
            const { data: authUser } = await supabase.auth.admin.getUserById(u.id);
            if (authUser?.user?.email) {
                recipientEmails.push(authUser.user.email);
            }
        }

        if (recipientEmails.length > 0) {
            // Remove duplicates
            recipientEmails = [...new Set(recipientEmails)];

            // Build Email content
            const htmlContent = `
                <h2>Alertas de Vencimentos - Assetra Frota</h2>
                <p>O sistema identificou os seguintes itens próximos do vencimento em sua frota:</p>
                <ul>
                    ${items.map(i => `<li><strong>${i.daysDiff} dias:</strong> ${i.type} - ${i.description} (Vencimento: ${new Date(i.endDate).toLocaleDateString('pt-BR', { timeZone: 'UTC' })})</li>`).join('')}
                </ul>
                <br/>
                <p>Acesse o sistema para tomar as medidas necessárias.</p>
                <p>Atenciosamente,<br/>Equipe Assetra</p>
            `;

            for (const email of recipientEmails) {
                await sendEmail(email, 'Assetra - Alertas de Vencimento da Frota', htmlContent);
            }
        }
    }
}
