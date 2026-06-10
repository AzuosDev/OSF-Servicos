import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly configService: ConfigService) {}

  private getBaseUrl() {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL')?.trim();
    return frontendUrl ? frontendUrl.replace(/\/$/, '') : 'http://localhost:5173';
  }

  private getFromAddress() {
    return this.configService.get<string>('EMAIL_FROM')?.trim() || this.configService.get<string>('EMAIL_USER')?.trim();
  }

  private getTransport() {
    const host = this.configService.get<string>('EMAIL_HOST')?.trim();
    const portValue = this.configService.get<string>('EMAIL_PORT')?.trim();
    const user = this.configService.get<string>('EMAIL_USER')?.trim();
    const pass = this.configService.get<string>('EMAIL_PASS')?.trim();

    if (!host || !portValue || !user || !pass) {
      return null;
    }

    const port = Number(portValue);
    if (!Number.isFinite(port)) {
      return null;
    }

    return nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: {
        user,
        pass,
      },
    });
  }

  private async sendMail(to: string, subject: string, text: string, html: string) {
    try {
      const from = this.getFromAddress();
      const transport = this.getTransport();

      if (!from || !transport) {
        this.logger.warn('Email config is incomplete. Skipping outbound email.');
        return false;
      }

      await transport.sendMail({
        from,
        to,
        subject,
        text,
        html,
      });

      return true;
    } catch (err) {
      this.logger.error('Email send failed', (err as Error)?.stack || String(err));
      return false;
    }
  }

  async sendVerificationEmail(to: string, token: string) {
    const verifyUrl = `${this.getBaseUrl()}/verify-email?token=${encodeURIComponent(token)}`;
    return this.sendMail(
      to,
      'Confirme seu email - ContaCerta',
      `Clique no link para confirmar seu email: ${verifyUrl}`,
      `
        <p>Olá!</p>
        <p>Para confirmar seu email, clique no link abaixo:</p>
        <p><a href="${verifyUrl}">${verifyUrl}</a></p>
        <p>Se você não criou uma conta no ContaCerta, ignore esta mensagem.</p>
      `,
    );
  }

  async sendPasswordResetEmail(to: string, token: string) {
    const resetUrl = `${this.getBaseUrl()}/reset-password?token=${encodeURIComponent(token)}`;
    return this.sendMail(
      to,
      'Redefinição de senha - ContaCerta',
      `Clique no link para redefinir sua senha: ${resetUrl}`,
      `
        <p>Olá!</p>
        <p>Para redefinir sua senha, clique no link abaixo:</p>
        <p><a href="${resetUrl}">${resetUrl}</a></p>
        <p>Se você não solicitou essa alteração, ignore esta mensagem.</p>
      `,
    );
  }
}
