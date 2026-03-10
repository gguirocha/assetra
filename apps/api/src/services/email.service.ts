import nodemailer from 'nodemailer';

export async function sendEmail(to: string, subject: string, html: string) {
    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT) || 465,
        secure: Number(process.env.SMTP_PORT) === 465, // true for 465, false for other ports
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
    });

    const mailOptions = {
        from: process.env.SMTP_FROM || '"Assetra" <no-reply@assetra.com>',
        to,
        subject,
        html,
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log(`✉️ Email sent to ${to}: ${info.messageId}`);
        return true;
    } catch (error) {
        console.error(`❌ Failed to send email to ${to}:`, error);
        return false;
    }
}
