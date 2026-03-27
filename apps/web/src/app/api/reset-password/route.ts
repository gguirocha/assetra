import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

async function getSmtpConfig() {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data } = await supabase
        .from('system_settings')
        .select('key, value')
        .eq('category', 'smtp');

    const config: Record<string, string> = {};
    if (data) {
        data.forEach((s: any) => { config[s.key] = s.value || ''; });
    }
    return config;
}

export async function POST(req: NextRequest) {
    try {
        const { email } = await req.json();

        if (!email) {
            return NextResponse.json({ error: 'E-mail é obrigatório.' }, { status: 400 });
        }

        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
            auth: { autoRefreshToken: false, persistSession: false }
        });

        // 1. Generate recovery link via Admin API (NO rate limits!)
        const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
            type: 'recovery',
            email,
            options: {
                redirectTo: `${req.nextUrl.origin}/update-password`,
            }
        });

        if (linkError) {
            // If user not found, return generic message (don't reveal user existence)
            if (linkError.message?.includes('not found') || linkError.message?.includes('User not found')) {
                return NextResponse.json({ success: true, message: 'Se o e-mail existir, um link será enviado.' });
            }
            throw linkError;
        }

        // 2. Extract the recovery URL from the generated link
        const recoveryUrl = linkData?.properties?.action_link;

        if (!recoveryUrl) {
            throw new Error('Falha ao gerar link de recuperação.');
        }

        // 3. Look up user name for the email
        let userName = email.split('@')[0];
        try {
            const { data: profile } = await supabaseAdmin
                .from('user_profiles')
                .select('name')
                .eq('email', email)
                .limit(1)
                .single();
            if (profile?.name) userName = profile.name;
        } catch {
            // Non-critical
        }

        // 4. Send via our SMTP (bypasses Supabase email rate limits completely)
        const smtpConfig = await getSmtpConfig();

        if (!smtpConfig.smtp_host || !smtpConfig.smtp_user || !smtpConfig.smtp_pass) {
            return NextResponse.json({ error: 'SMTP não configurado. Contate o administrador.' }, { status: 500 });
        }

        const transporter = nodemailer.createTransport({
            host: smtpConfig.smtp_host,
            port: parseInt(smtpConfig.smtp_port || '587'),
            secure: parseInt(smtpConfig.smtp_port || '587') === 465,
            auth: {
                user: smtpConfig.smtp_user,
                pass: smtpConfig.smtp_pass,
            },
        });

        const fromAddress = `"${smtpConfig.smtp_from_name || 'Assetra'}" <${smtpConfig.smtp_from || smtpConfig.smtp_user}>`;

        await transporter.sendMail({
            from: fromAddress,
            to: email,
            subject: '🔐 Redefinição de Senha - Assetra',
            html: `
                <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 500px; margin: 0 auto; background: #1a1a2e; color: #e0e0e0; border-radius: 12px; overflow: hidden;">
                    <div style="background: linear-gradient(135deg, #5B5CFF, #00E5FF); padding: 24px; text-align: center;">
                        <h1 style="color: white; margin: 0; font-size: 20px;">Redefinição de Senha</h1>
                    </div>
                    <div style="padding: 24px;">
                        <p style="color: #e0e0e0;">Olá <strong>${userName}</strong>,</p>
                        <p style="color: #a0a0b0;">Uma solicitação de redefinição de senha foi feita para sua conta.</p>
                        <div style="text-align: center; margin: 24px 0;">
                            <a href="${recoveryUrl}" style="display: inline-block; background: linear-gradient(135deg, #5B5CFF, #00E5FF); color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 14px;">
                                Redefinir Minha Senha →
                            </a>
                        </div>
                        <p style="color: #666; font-size: 11px;">Se não foi você, ignore este e-mail.</p>
                        <p style="color: #444; font-size: 10px; margin-top: 12px;">Este link expira em 24 horas.</p>
                    </div>
                    <div style="padding: 16px 24px; background: #12121a; text-align: center; font-size: 11px; color: #555;">
                        Assetra - Gestão de Frotas e Manutenção
                    </div>
                </div>
            `,
        });

        return NextResponse.json({ success: true, message: 'Link de recuperação enviado com sucesso!' });

    } catch (error: any) {
        console.error('Reset password error:', error);
        return NextResponse.json({ error: error.message || 'Erro ao processar solicitação.' }, { status: 500 });
    }
}
