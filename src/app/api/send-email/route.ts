export const runtime = "nodejs";

import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(req: Request) {
    try {
        const { recipientEmail, contractData, emailType = "creation" } = await req.json();

        if (!recipientEmail || recipientEmail === "exemplo@email.com") {
            return NextResponse.json({ message: 'Email not provided or invalid' }, { status: 400 });
        }

        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST || "smtp.example.com",
            port: parseInt(process.env.SMTP_PORT || "587"),
            secure: process.env.SMTP_SECURE === "true", // true for 465, false for other ports
            auth: {
                user: process.env.SMTP_USER || "user@example.com",
                pass: process.env.SMTP_PASS || "password",
            },
            tls: {
                // Do not fail on invalid certs (common for custom SMTP)
                rejectUnauthorized: false
            }
        });

        const isReminder = emailType === "reminder";
        const subject = isReminder
            ? `Lembrete de Saque Disponível: ${contractData.tokenName || 'Tokens'} (${contractData.tokenSymbol || 'TKN'})`
            : `Seu Contrato Vesting foi Criado: ${contractData.tokenName || 'Tokens'} (${contractData.tokenSymbol || 'TKN'})`;

        // Format status for display
        const statusMap: Record<string, string> = {
            'em-andamento': 'em andamento',
            'agendado': 'agendado',
            'completo': 'completo',
            'cancelado': 'cancelado'
        };
        const displayStatus = statusMap[contractData.status] || contractData.status || 'agendado';

        // Helper to format large numbers (K, M, etc.)
        const formatAmount = (num: number | string) => {
            const n = typeof num === 'string' ? parseFloat(num) : num;
            if (isNaN(n)) return '0';
            if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
            if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
            return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
        };

        const mailOptions = {
            from: process.env.SMTP_USER ? `"Verum Vesting" <${process.env.SMTP_USER}>` : '"Verum Vesting" <smartcontract@mastter.digital>',
            to: recipientEmail,
            subject: subject,
            html: `
                <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f5; padding: 40px 20px; color: #18181b; line-height: 1.5;">
                    <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);">
                        <!-- Header -->
                        <div style="background-color: #000000; padding: 32px; text-align: center;">
                            <h1 style="color: #EAB308; margin: 0; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">Verum Vesting</h1>
                        </div>
                        
                        <!-- Content -->
                        <div style="padding: 40px;">
                            <h2 style="color: #111827; margin-top: 0; margin-bottom: 24px; font-size: 22px; font-weight: 700;">
                                ${isReminder ? 'Saque Disponível!' : 'Novo Contrato Vesting Disponível'}
                            </h2>
                            
                            <p style="color: #4b5563; font-size: 16px; margin-bottom: 8px;">Olá,</p>
                            <p style="color: #4b5563; font-size: 16px; margin-bottom: 24px;">
                                ${isReminder
                    ? `O administrador do seu contrato <strong>${contractData.tokenName || 'Tokens'}</strong> enviou este lembrete para avisar que você já possui tokens disponíveis para saque.`
                    : `Um novo contrato de vesting foi criado para você. Abaixo estão os detalhes:`}
                            </p>
                            
                            <div style="border-top: 1px solid #e5e7eb; padding-top: 24px; margin-top: 24px;">
                                <div style="margin-bottom: 12px; font-size: 15px;">
                                    <strong style="color: #111827;">Contrato ID:</strong> <code style="background-color: #f1f5f9; padding: 2px 4px; border-radius: 4px;">${contractData.id || 'N/A'}</code>
                                </div>
                                <div style="margin-bottom: 12px; font-size: 15px;">
                                    <strong style="color: #111827;">Token:</strong> ${contractData.tokenName || 'Token'} (${contractData.tokenSymbol || 'TKN'})
                                </div>
                                <div style="margin-bottom: 12px; font-size: 15px;">
                                    <strong style="color: #111827;">Quantidade Total:</strong> ${formatAmount(contractData.totalAmount)} ${contractData.tokenSymbol || ''}
                                </div>
                                <div style="margin-bottom: 12px; font-size: 15px;">
                                    <strong style="color: #111827;">Status:</strong> ${displayStatus}
                                </div>
                                <div style="margin-bottom: 12px; font-size: 15px;">
                                    <strong style="color: #111827;">Início do Vesting:</strong> ${contractData.vestingStartDate || 'N/A'}
                                </div>
                                <div style="margin-bottom: 12px; font-size: 15px;">
                                    <strong style="color: #111827;">Duração:</strong> ${contractData.vestingDuration || '0'} ${contractData.selectedTimeUnit || ''}
                                </div>
                                <div style="margin-bottom: 12px; font-size: 15px;">
                                    <strong style="color: #111827;">Frequência:</strong> ${contractData.selectedSchedule || 'N/A'}
                                </div>
                            </div>

                            <!-- Button Area -->
                            <div style="text-align: center; margin-top: 40px; margin-bottom: 30px;">
                                <a href="https://verumvesting.mastter.digital" style="background-color: #EAB308; color: #000000; padding: 14px 44px; text-decoration: none; border-radius: 8px; font-weight: 700; display: inline-block; font-size: 16px;">
                                    Acessar Plataforma
                                </a>
                            </div>
                            
                            <!-- Bottom Link -->
                            <p style="color: #9ca3af; font-size: 13px; text-align: center; margin-top: 0;">
                                Ou acesse diretamente: <a href="https://verumvesting.mastter.digital" style="color: #3b82f6; text-decoration: none;">https://verumvesting.mastter.digital</a>
                            </p>
                        </div>
                        
                        <!-- Footer Small dots based on image -->
                        <div style="padding: 0 40px 40px 40px; text-align: left;">
                             <div style="color: #cbd5e1; letter-spacing: 2px; font-size: 20px;">...</div>
                        </div>
                    </div>
                </div>
            `
        };

        try {
            if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
                console.log("[API] Attempting to send email to:", recipientEmail);
                await transporter.sendMail(mailOptions);
                console.log("[API] SUCCESS: Email sent to", recipientEmail);
            } else {
                console.log("[API] INFO: Mock mode - Credentials missing in environment.");
            }
        } catch (emailError: any) {
            console.error("[API] SMTP ERROR:", emailError.message || emailError);
            return NextResponse.json({
                success: false,
                message: `Erro no servidor SMTP: ${emailError.code || 'Falha na conexão'}`,
                details: emailError.message
            }, { status: 500 });
        }

        return NextResponse.json({ success: true, message: 'Email processado' });

    } catch (error) {
        console.error('Error in send-email API:', error);
        return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
    }
}
