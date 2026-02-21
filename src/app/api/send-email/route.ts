export const runtime = "nodejs";

import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(req: Request) {
    try {
        const { recipientEmail, contractData } = await req.json();

        if (!recipientEmail) {
            return NextResponse.json({ message: 'Email not provided' }, { status: 400 });
        }

        // Configure Nodemailer transporter
        // NOTE: In a real production environment, you would use Environment Variables for these credentials
        // e.g. process.env.SMTP_HOST, process.env.SMTP_USER, etc.
        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST || "smtp.example.com",
            port: parseInt(process.env.SMTP_PORT || "587"),
            secure: process.env.SMTP_SECURE === "true", // true for 465, false for other ports
            auth: {
                user: process.env.SMTP_USER || "user@example.com",
                pass: process.env.SMTP_PASS || "password",
            },
        });

        // Email Content
        const mailOptions = {
            from: '"Verum Vesting" <smartcontract@mastter.digital>',
            to: recipientEmail,
            subject: `Seu Contrato Vesting foi Criado: ${contractData.tokenName} - ${contractData.tokenSymbol}`,
            html: `
                <div style="font-family: Arial, sans-serif; background-color: #f4f4f5; padding: 20px;">
                    <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                        <div style="background-color: #000000; padding: 20px; text-align: center;">
                            <h1 style="color: #EAB308; margin: 0;">Verum Vesting</h1>
                        </div>
                        <div style="padding: 30px;">
                            <h2 style="color: #333333; margin-top: 0;">Novo Contrato Vesting Disponível</h2>
                            <p style="color: #666666; line-height: 1.6;">Olá,</p>
                            <p style="color: #666666; line-height: 1.6;">Um novo contrato de vesting foi criado para você. Abaixo estão os detalhes:</p>
                            
                            <hr style="border: 0; border-top: 1px solid #eeeeee; margin: 20px 0;">
                            
                            <div style="margin-bottom: 20px;">
                                <p style="margin: 5px 0;"><strong>Token:</strong> ${contractData.tokenName} (${contractData.tokenSymbol})</p>
                                <p style="margin: 5px 0;"><strong>Quantidade Total:</strong> ${contractData.totalAmount} ${contractData.tokenSymbol}</p>
                                <p style="margin: 5px 0;"><strong>Status:</strong> ${contractData.status}</p>
                                <p style="margin: 5px 0;"><strong>Início do Vesting:</strong> ${contractData.vestingStartDate}</p>
                                <p style="margin: 5px 0;"><strong>Duração:</strong> ${contractData.vestingDuration} ${contractData.selectedTimeUnit}</p>
                                <p style="margin: 5px 0;"><strong>Frequência:</strong> ${contractData.selectedSchedule}</p>
                            </div>

                            <div style="text-align: center; margin-top: 30px;">
                                <a href="https://verumvesting.mastter.digital" style="background-color: #EAB308; color: #000000; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Acessar Plataforma</a>
                            </div>
                            
                            <p style="color: #999999; font-size: 12px; margin-top: 30px; text-align: center;">Ou acesse diretamente: https://verumvesting.mastter.digital</p>
                        </div>
                        <div style="background-color: #f4f4f5; padding: 15px; text-align: center; color: #999999; font-size: 11px;">
                            &copy; ${new Date().getFullYear()} Verum Vesting. Todos os direitos reservados.
                        </div>
                    </div>
                </div>
            `
        };

        // Attempt to send email
        try {
            // Only send if we have basic env vars configured, otherwise just log
            if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
                await transporter.sendMail(mailOptions);
                console.log("REAL EMAIL SENT TO:", recipientEmail);
            } else {
                console.log("---------------------------------------------------");
                console.log("MOCK EMAIL SENT TO:", recipientEmail);
                console.log("SUBJECT:", mailOptions.subject);
                console.log("WARNING: To send real emails, set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS in your .env file.");
                console.log("---------------------------------------------------");
            }
        } catch (emailError) {
            console.error("Failed to send email via transporter:", emailError);
            // We still return success to the frontend to avoid blocking the flow, but log the error
        }

        return NextResponse.json({ success: true, message: 'Email processado' });

    } catch (error) {
        console.error('Error in send-email API:', error);
        return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
    }
}
