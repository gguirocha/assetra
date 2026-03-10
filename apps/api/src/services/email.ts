import nodemailer from 'nodemailer';

const host = process.env.SMTP_HOST || 'localhost';
const port = Number(process.env.SMTP_PORT) || 2525;
const user = process.env.SMTP_USER || '';
const pass = process.env.SMTP_PASS || '';
const from = process.env.SMTP_FROM || 'assetra@local';

const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // true for 465, false for other ports
    auth: {
        user,
        pass,
    },
});

export async function sendEmail(to: string, subject: string, html: string) {
    try {
        const info = await transporter.sendMail({
            from,
            to,
            subject,
            html,
        });
        console.log(`E-mail enviado: ${info.messageId}`);
    } catch (err) {
        console.error(`Erro ao enviar e-mail para ${to}:`, err);
    }
}
