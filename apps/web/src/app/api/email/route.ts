import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { createClient } from '@supabase/supabase-js';

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

function createTransporter(config: Record<string, string>) {
    return nodemailer.createTransport({
        host: config.smtp_host,
        port: parseInt(config.smtp_port || '587'),
        secure: parseInt(config.smtp_port || '587') === 465,
        auth: {
            user: config.smtp_user,
            pass: config.smtp_pass,
        },
    });
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { action } = body;

        const smtpConfig = await getSmtpConfig();

        if (!smtpConfig.smtp_host || !smtpConfig.smtp_user || !smtpConfig.smtp_pass) {
            return NextResponse.json({ error: 'SMTP não configurado. Vá em Configurações > Sistema para configurar.' }, { status: 400 });
        }

        const transporter = createTransporter(smtpConfig);
        const fromAddress = `"${smtpConfig.smtp_from_name || 'Assetra'}" <${smtpConfig.smtp_from || smtpConfig.smtp_user}>`;

        if (action === 'test') {
            // Test email
            const { to } = body;
            await transporter.sendMail({
                from: fromAddress,
                to: to || smtpConfig.smtp_user,
                subject: '✅ Teste SMTP - Assetra',
                html: `
                    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 500px; margin: 0 auto; background: #1a1a2e; color: #e0e0e0; border-radius: 12px; overflow: hidden;">
                        <div style="background: linear-gradient(135deg, #5B5CFF, #00E5FF); padding: 24px; text-align: center;">
                            <h1 style="color: white; margin: 0; font-size: 20px;">🎉 Teste SMTP Bem-Sucedido!</h1>
                        </div>
                        <div style="padding: 24px;">
                            <p style="color: #a0a0b0;">O servidor SMTP está configurado corretamente.</p>
                            <p style="color: #a0a0b0; font-size: 12px;">
                                Host: ${smtpConfig.smtp_host}<br>
                                Porta: ${smtpConfig.smtp_port}<br>
                                Enviado em: ${new Date().toLocaleString('pt-BR')}
                            </p>
                        </div>
                        <div style="padding: 16px 24px; background: #12121a; text-align: center; font-size: 11px; color: #555;">
                            Assetra - Gestão de Frotas e Manutenção
                        </div>
                    </div>
                `,
            });
            return NextResponse.json({ success: true, message: 'E-mail de teste enviado com sucesso!' });

        } else if (action === 'invite') {
            // Invite new user
            const { to, userName, tempPassword, loginUrl } = body;
            await transporter.sendMail({
                from: fromAddress,
                to,
                subject: '🔑 Bem-vindo ao Assetra - Defina sua senha',
                html: `
                    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 500px; margin: 0 auto; background: #1a1a2e; color: #e0e0e0; border-radius: 12px; overflow: hidden;">
                        <div style="background: linear-gradient(135deg, #5B5CFF, #00E5FF); padding: 24px; text-align: center;">
                            <h1 style="color: white; margin: 0; font-size: 20px;">Bem-vindo ao Assetra!</h1>
                            <p style="color: rgba(255,255,255,0.85); margin: 8px 0 0; font-size: 13px;">Sua conta foi criada com sucesso</p>
                        </div>
                        <div style="padding: 24px;">
                            <p style="color: #e0e0e0;">Olá <strong>${userName}</strong>,</p>
                            <p style="color: #a0a0b0;">Sua conta no sistema Assetra foi criada. Utilize as credenciais abaixo para fazer seu primeiro acesso:</p>
                            <div style="background: #12121a; border-radius: 8px; padding: 16px; margin: 16px 0; border: 1px solid rgba(91,92,255,0.3);">
                                <p style="margin: 4px 0; color: #a0a0b0; font-size: 13px;">📧 <strong style="color: #00E5FF;">E-mail:</strong> ${to}</p>
                                <p style="margin: 4px 0; color: #a0a0b0; font-size: 13px;">🔒 <strong style="color: #00E5FF;">Senha temporária:</strong> <code style="background: #5B5CFF33; padding: 2px 8px; border-radius: 4px; color: #5B5CFF; font-size: 14px;">${tempPassword}</code></p>
                            </div>
                            <p style="color: #ef4444; font-size: 12px;">⚠️ Por segurança, altere sua senha após o primeiro acesso.</p>
                            <div style="text-align: center; margin-top: 20px;">
                                <a href="${loginUrl || '#'}" style="display: inline-block; background: linear-gradient(135deg, #5B5CFF, #00E5FF); color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 14px;">
                                    Acessar o Sistema →
                                </a>
                            </div>
                        </div>
                        <div style="padding: 16px 24px; background: #12121a; text-align: center; font-size: 11px; color: #555;">
                            Assetra - Gestão de Frotas e Manutenção
                        </div>
                    </div>
                `,
            });
            return NextResponse.json({ success: true, message: 'E-mail de convite enviado!' });

        } else if (action === 'reset_password') {
            // Reset password
            const { to, userName, resetUrl } = body;
            await transporter.sendMail({
                from: fromAddress,
                to,
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
                                <a href="${resetUrl || '#'}" style="display: inline-block; background: linear-gradient(135deg, #5B5CFF, #00E5FF); color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 14px;">
                                    Redefinir Minha Senha →
                                </a>
                            </div>
                            <p style="color: #666; font-size: 11px;">Se não foi você, ignore este e-mail.</p>
                        </div>
                        <div style="padding: 16px 24px; background: #12121a; text-align: center; font-size: 11px; color: #555;">
                            Assetra - Gestão de Frotas e Manutenção
                        </div>
                    </div>
                `,
            });
            return NextResponse.json({ success: true, message: 'E-mail de reset enviado!' });

        } else if (action === 'notification') {
            // Generic notification email
            const { to, subject, title, message } = body;
            await transporter.sendMail({
                from: fromAddress,
                to,
                subject: subject || title,
                html: `
                    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 500px; margin: 0 auto; background: #1a1a2e; color: #e0e0e0; border-radius: 12px; overflow: hidden;">
                        <div style="background: linear-gradient(135deg, #5B5CFF, #00E5FF); padding: 24px; text-align: center;">
                            <h1 style="color: white; margin: 0; font-size: 20px;">${title}</h1>
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
            return NextResponse.json({ success: true, message: 'Notificação enviada!' });
        }

        return NextResponse.json({ error: 'Ação inválida' }, { status: 400 });

    } catch (error: any) {
        console.error('Email error:', error);
        return NextResponse.json({ error: error.message || 'Erro ao enviar e-mail' }, { status: 500 });
    }
}
