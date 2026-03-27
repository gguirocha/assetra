import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

async function getSmtpConfig(supabase: any) {
    const { data } = await supabase.from('system_settings').select('key, value').eq('category', 'smtp');
    const config: Record<string, string> = {};
    if (data) data.forEach((s: any) => { config[s.key] = s.value || ''; });
    return config;
}

async function sendNotificationEmail(smtpConfig: Record<string, string>, to: string, title: string, message: string) {
    if (!smtpConfig.smtp_host || !smtpConfig.smtp_user || !smtpConfig.smtp_pass) return false;
    try {
        const transporter = nodemailer.createTransport({
            host: smtpConfig.smtp_host,
            port: parseInt(smtpConfig.smtp_port || '587'),
            secure: parseInt(smtpConfig.smtp_port || '587') === 465,
            auth: { user: smtpConfig.smtp_user, pass: smtpConfig.smtp_pass },
        });
        const fromAddress = `"${smtpConfig.smtp_from_name || 'Assetra'}" <${smtpConfig.smtp_from || smtpConfig.smtp_user}>`;
        await transporter.sendMail({
            from: fromAddress, to, subject: `🔔 ${title} - Assetra`,
            html: `
                <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 500px; margin: 0 auto; background: #1a1a2e; color: #e0e0e0; border-radius: 12px; overflow: hidden;">
                    <div style="background: linear-gradient(135deg, #5B5CFF, #00E5FF); padding: 24px; text-align: center;">
                        <h1 style="color: white; margin: 0; font-size: 20px;">🔔 ${title}</h1>
                    </div>
                    <div style="padding: 24px;">
                        <p style="color: #a0a0b0;">${message}</p>
                    </div>
                    <div style="padding: 16px 24px; background: #12121a; text-align: center; font-size: 11px; color: #555;">
                        Assetra - Gestão de Frotas e Manutenção
                    </div>
                </div>
            `,
        });
        return true;
    } catch (err) {
        console.error('SMTP send failed:', err);
        return false;
    }
}

// Resolve notification recipients based on rule.recipients config
async function resolveRecipients(
    supabase: any,
    tenantId: string,
    recipientsConfig: any
): Promise<{ id: string; name: string; is_admin: boolean }[]> {
    // recipientsConfig format: { type: 'all' | 'users' | 'roles' | 'emails', values: string[] }
    if (!recipientsConfig || !recipientsConfig.type || recipientsConfig.type === 'all') {
        // Default: all users in tenant
        const { data } = await supabase.from('user_profiles')
            .select('id, name, is_admin')
            .eq('tenant_id', tenantId);
        return data || [];
    }

    if (recipientsConfig.type === 'users') {
        // Specific user IDs
        const { data } = await supabase.from('user_profiles')
            .select('id, name, is_admin')
            .in('id', recipientsConfig.values || []);
        return data || [];
    }

    if (recipientsConfig.type === 'roles') {
        // Users with specific roles
        const { data: userRoles } = await supabase.from('user_roles')
            .select('user_id')
            .in('role_id', recipientsConfig.values || []);

        if (!userRoles || userRoles.length === 0) return [];
        const userIds = [...new Set(userRoles.map((ur: any) => ur.user_id))];

        const { data } = await supabase.from('user_profiles')
            .select('id, name, is_admin')
            .in('id', userIds);
        return data || [];
    }

    // Fallback: all users
    const { data } = await supabase.from('user_profiles')
        .select('id, name, is_admin')
        .eq('tenant_id', tenantId);
    return data || [];
}

// Automation engine
export async function POST(req: NextRequest) {
    try {
        const body = await req.json().catch(() => ({}));
        const ruleId = body.ruleId; // Optional: run only a specific rule

        const supabase = createClient(supabaseUrl, supabaseServiceKey, {
            auth: { autoRefreshToken: false, persistSession: false }
        });

        // 1. Get rules
        let query = supabase.from('automation_rules').select('*');
        if (ruleId) {
            query = query.eq('id', ruleId);
        } else {
            query = query.eq('active', true);
        }
        const { data: rules, error: rulesError } = await query;

        if (rulesError || !rules) {
            return NextResponse.json({ error: 'Falha ao carregar regras.' }, { status: 500 });
        }

        const smtpConfig = await getSmtpConfig(supabase);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        let totalNotifications = 0;
        let totalEmails = 0;
        let totalCalendar = 0;
        let totalOS = 0;

        for (const rule of rules) {
            const conditions = rule.conditions || {};
            const actions = Array.isArray(rule.actions) ? rule.actions : [];
            const daysBefore = conditions.days_before || 30;
            const thresholdDate = new Date(today);
            thresholdDate.setDate(thresholdDate.getDate() + daysBefore);

            let alertItems: { title: string; message: string; tenantId: string; sourceType?: string; sourceId?: string }[] = [];

            // == EVENT HANDLERS ==
            switch (rule.event) {
                case 'cnh_expiring': {
                    const { data } = await supabase.from('drivers').select('*')
                        .lte('cnh_expiration', thresholdDate.toISOString().split('T')[0])
                        .gte('cnh_expiration', today.toISOString().split('T')[0]);
                    for (const d of data || []) {
                        const diff = Math.ceil((new Date(d.cnh_expiration).getTime() - today.getTime()) / 86400000);
                        alertItems.push({
                            title: actions[0]?.title || `CNH vencendo em ${diff} dias`,
                            message: (actions[0]?.message || `A CNH do motorista {driver_name} vence em {days} dias`)
                                .replace('{driver_name}', d.name).replace('{days}', String(diff)),
                            tenantId: d.tenant_id,
                            sourceType: 'vencimento',
                            sourceId: d.id,
                        });
                    }
                    break;
                }
                case 'document_expiring': {
                    // Types handled by dedicated events — exclude them here to avoid overlap
                    const excludedTypes = ['seguro', 'apólice', 'apolice', 'insurance', 'tacógrafo', 'tacografo', 'tachograph'];

                    const { data } = await supabase.from('vehicle_documents').select('*, vehicles!inner(plate, tenant_id)')
                        .lte('expiration_date', thresholdDate.toISOString().split('T')[0])
                        .gte('expiration_date', today.toISOString().split('T')[0]);
                    for (const d of data || []) {
                        // Skip documents whose type matches a dedicated event handler
                        const docType = (d.type || '').toLowerCase();
                        if (excludedTypes.some(ex => docType.includes(ex))) continue;

                        const diff = Math.ceil((new Date(d.expiration_date).getTime() - today.getTime()) / 86400000);
                        alertItems.push({
                            title: actions[0]?.title || `${d.type || 'Documento'} vencendo em ${diff} dias`,
                            message: (actions[0]?.message || `{doc_type} do veículo {plate} vence em {days} dias`)
                                .replace('{doc_type}', d.type || 'Documento')
                                .replace('{plate}', d.vehicles?.plate || '').replace('{days}', String(diff)),
                            tenantId: d.vehicles?.tenant_id,
                            sourceType: 'vencimento',
                            sourceId: d.id,
                        });
                    }
                    break;
                }
                case 'insurance_expiring': {
                    const { data } = await supabase.from('insurances').select('*, vehicles!inner(plate, tenant_id)')
                        .lte('end_date', thresholdDate.toISOString().split('T')[0])
                        .gte('end_date', today.toISOString().split('T')[0]);
                    for (const d of data || []) {
                        const diff = Math.ceil((new Date(d.end_date).getTime() - today.getTime()) / 86400000);
                        alertItems.push({
                            title: actions[0]?.title || `Seguro vencendo em ${diff} dias`,
                            message: (actions[0]?.message || `O seguro do veículo {plate} vence em {days} dias`)
                                .replace('{plate}', d.vehicles?.plate || '').replace('{days}', String(diff)),
                            tenantId: d.vehicles?.tenant_id,
                            sourceType: 'vencimento',
                            sourceId: d.id,
                        });
                    }
                    break;
                }
                case 'exam_expiring': {
                    const { data } = await supabase.from('driver_documents').select('*, drivers!inner(name, tenant_id)')
                        .lte('expiration_date', thresholdDate.toISOString().split('T')[0])
                        .gte('expiration_date', today.toISOString().split('T')[0]);
                    for (const d of data || []) {
                        const diff = Math.ceil((new Date(d.expiration_date).getTime() - today.getTime()) / 86400000);
                        alertItems.push({
                            title: actions[0]?.title || `Exame vencendo em ${diff} dias`,
                            message: (actions[0]?.message || `O exame {exam_type} do motorista {driver_name} vence em {days} dias`)
                                .replace('{exam_type}', d.type || 'Periódico')
                                .replace('{driver_name}', d.drivers?.name || '').replace('{days}', String(diff)),
                            tenantId: d.drivers?.tenant_id,
                            sourceType: 'vencimento',
                            sourceId: d.id,
                        });
                    }
                    break;
                }
                case 'low_stock': {
                    const { data } = await supabase.from('parts').select('*');
                    for (const p of data || []) {
                        if (p.min_stock != null && p.current_stock != null && p.current_stock <= p.min_stock) {
                            alertItems.push({
                                title: actions[0]?.title || 'Estoque baixo',
                                message: (actions[0]?.message || `O item {part_name} está com estoque abaixo do mínimo ({current}/{min})`)
                                    .replace('{part_name}', p.name || p.description)
                                    .replace('{current}', String(p.current_stock))
                                    .replace('{min}', String(p.min_stock)),
                                tenantId: p.tenant_id,
                                sourceType: 'estoque',
                                sourceId: p.id,
                            });
                        }
                    }
                    break;
                }
                case 'os_sla_exceeded': {
                    const { data } = await supabase.from('work_orders').select('*')
                        .in('status', ['open', 'in_progress', 'aberta', 'em_andamento', 'em_atendimento']);
                    for (const wo of data || []) {
                        if (wo.sla_deadline) {
                            const deadline = new Date(wo.sla_deadline);
                            if (deadline < today) {
                                const hoursOver = Math.round((today.getTime() - deadline.getTime()) / 3600000);
                                alertItems.push({
                                    title: actions[0]?.title || 'OS atrasada',
                                    message: (actions[0]?.message || `A OS #{wo_id} excedeu o SLA em {hours}h`)
                                        .replace('{wo_id}', wo.code || wo.id?.slice(0, 8))
                                        .replace('{hours}', String(hoursOver)),
                                    tenantId: wo.tenant_id,
                                    sourceType: 'os_programada',
                                    sourceId: wo.id,
                                });
                            }
                        }
                    }
                    break;
                }
                case 'preventive_due': {
                    const { data } = await supabase.from('calendar_events').select('*')
                        .eq('type', 'preventive')
                        .lte('start_date', thresholdDate.toISOString().split('T')[0])
                        .gte('start_date', today.toISOString().split('T')[0]);
                    for (const ev of data || []) {
                        alertItems.push({
                            title: actions[0]?.title || 'Preventiva próxima',
                            message: (actions[0]?.message || `Manutenção preventiva de {asset_name} programada para {date}`)
                                .replace('{asset_name}', ev.title || 'Ativo')
                                .replace('{date}', new Date(ev.start_date).toLocaleDateString('pt-BR')),
                            tenantId: ev.tenant_id,
                            sourceType: 'preventiva',
                            sourceId: ev.reference_id || ev.id,
                        });
                    }
                    break;
                }
                case 'wash_overdue': {
                    const { data } = await supabase.from('car_wash_schedules').select('*, vehicles!inner(plate, tenant_id)')
                        .in('status', ['pending', 'agendada'])
                        .lt('scheduled_date', today.toISOString().split('T')[0]);
                    for (const w of data || []) {
                        const daysOver = Math.ceil((today.getTime() - new Date(w.scheduled_date).getTime()) / 86400000);
                        alertItems.push({
                            title: actions[0]?.title || 'Lavagem atrasada',
                            message: (actions[0]?.message || `O veículo {plate} está com lavagem atrasada há {days} dias`)
                                .replace('{plate}', w.vehicles?.plate || '')
                                .replace('{days}', String(daysOver)),
                            tenantId: w.vehicles?.tenant_id,
                            sourceType: 'lavagem',
                            sourceId: w.vehicle_id,
                        });
                    }
                    break;
                }
                case 'tachograph_expiring': {
                    const { data } = await supabase.from('tachograph_checks').select('*, vehicles!inner(plate, tenant_id)')
                        .lte('expiration_date', thresholdDate.toISOString().split('T')[0])
                        .gte('expiration_date', today.toISOString().split('T')[0]);
                    for (const t of data || []) {
                        const diff = Math.ceil((new Date(t.expiration_date).getTime() - today.getTime()) / 86400000);
                        alertItems.push({
                            title: actions[0]?.title || `Tacógrafo vencendo em ${diff} dias`,
                            message: `Aferição do tacógrafo do veículo ${t.vehicles?.plate} vence em ${diff} dias`,
                            tenantId: t.vehicles?.tenant_id,
                            sourceType: 'vencimento',
                            sourceId: t.id,
                        });
                    }
                    break;
                }
            }

            // == EXECUTE ACTIONS for each alert ==
            for (const alert of alertItems) {
                if (!alert.tenantId) continue;

                // Resolve recipients based on rule config
                const allRecipients = await resolveRecipients(supabase, alert.tenantId, rule.recipients);

                for (const action of actions) {
                    // == IN-APP NOTIFICATION ==
                    if (action.type === 'notification') {
                        for (const user of allRecipients) {
                            try {
                                await supabase.from('notifications').insert({
                                    tenant_id: alert.tenantId,
                                    user_id: user.id,
                                    title: alert.title,
                                    message: alert.message,
                                    read: false,
                                });
                                totalNotifications++;
                            } catch { /* skip duplicates */ }
                        }
                    }

                    // == EMAIL ==
                    if (action.type === 'email') {
                        // If recipients config has specific emails, send to those
                        if (rule.recipients?.type === 'emails' && rule.recipients?.values?.length) {
                            for (const email of rule.recipients.values) {
                                const sent = await sendNotificationEmail(smtpConfig, email, alert.title, alert.message);
                                if (sent) totalEmails++;
                                else console.warn(`[Automation] Failed to send email to ${email}`);
                            }
                        } else {
                            // Send to ALL resolved recipients (lookup email from auth.users)
                            for (const user of allRecipients) {
                                try {
                                    const { data: authUser, error: authErr } = await supabase.auth.admin.getUserById(user.id);
                                    if (authErr) {
                                        console.error(`[Automation] getUserById error for ${user.id}:`, authErr.message);
                                        continue;
                                    }
                                    const email = authUser?.user?.email;
                                    if (email) {
                                        const sent = await sendNotificationEmail(smtpConfig, email, alert.title, alert.message);
                                        if (sent) totalEmails++;
                                        else console.warn(`[Automation] SMTP send returned false for ${email}`);
                                    } else {
                                        console.warn(`[Automation] No email found for user ${user.id} (${user.name})`);
                                    }
                                } catch (err: any) {
                                    console.error(`[Automation] Email error for user ${user.id}:`, err.message);
                                }
                            }
                        }
                    }

                    // == CALENDAR EVENT ==
                    if (action.type === 'calendar_event') {
                        try {
                            const eventDate = new Date();
                            eventDate.setDate(eventDate.getDate() + 1); // Schedule for tomorrow
                            await supabase.from('calendar_events').insert({
                                tenant_id: alert.tenantId,
                                title: `⚠️ ${alert.title}`,
                                type: alert.sourceType || 'vencimento',
                                reference_id: alert.sourceId || null,
                                start_date: eventDate.toISOString(),
                                end_date: eventDate.toISOString(),
                            });
                            totalCalendar++;
                        } catch (err) {
                            console.error('Calendar event creation failed:', err);
                        }
                    }

                    // == AUTO CREATE WORK ORDER ==
                    if (action.type === 'create_os') {
                        try {
                            await supabase.from('work_orders').insert({
                                tenant_id: alert.tenantId,
                                type: 'vehicle',
                                priority: 'media',
                                description: `[Automação] ${alert.title}\n\n${alert.message}`,
                                status: 'aberta',
                            });
                            totalOS++;
                        } catch (err) {
                            console.error('Work order creation failed:', err);
                        }
                    }
                }
            }

            // Update last_run timestamp
            await supabase.from('automation_rules').update({ last_run: new Date().toISOString() }).eq('id', rule.id);
        }

        const parts = [];
        if (totalNotifications > 0) parts.push(`${totalNotifications} notificações`);
        if (totalEmails > 0) parts.push(`${totalEmails} emails`);
        if (totalCalendar > 0) parts.push(`${totalCalendar} eventos no calendário`);
        if (totalOS > 0) parts.push(`${totalOS} OS abertas`);

        return NextResponse.json({
            success: true,
            message: parts.length > 0
                ? `Automações executadas: ${parts.join(', ')}.`
                : `Automações executadas: nenhum alerta encontrado para as condições atuais.`,
            notifications: totalNotifications,
            emails: totalEmails,
            calendar: totalCalendar,
            workOrders: totalOS,
        });

    } catch (error: any) {
        console.error('Automation run error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function GET() {
    return NextResponse.json({ status: 'ok', message: 'POST to run automations' });
}
