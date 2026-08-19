import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';

type EmailTemplateOptions = {
  preheader: string;
  heading: string;
  bodyHtml: string;
  ctaLabel: string;
  ctaUrl: string;
  footerNote: string;
};

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly configService: ConfigService) { }

  private getBaseUrl() {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL')?.split(',')[0]?.trim();
    return frontendUrl ? frontendUrl.replace(/\/$/, '') : 'http://localhost:5173';
  }

  private getFromAddress() {
    const address = this.configService.get<string>('EMAIL_FROM')?.trim() || this.configService.get<string>('EMAIL_USER')?.trim();
    return address ? `"OSF Serviços" <${address}>` : undefined;
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

  /** Layout compartilhado dos emails transacionais, seguindo o visual (dark, dourado, Syne/DM Sans) usado no app. */
  private renderTemplate({ preheader, heading, bodyHtml, ctaLabel, ctaUrl, footerNote }: EmailTemplateOptions) {
    const logoUrl = `${this.getBaseUrl()}/branding/osf-logo-dark.png`;
    const year = new Date().getFullYear();
    const headingFont = "'Syne', 'Segoe UI', Helvetica, Arial, sans-serif";
    const bodyFont = "'DM Sans', 'Segoe UI', Helvetica, Arial, sans-serif";

    return `<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="dark" />
    <title>${heading}</title>
  </head>
  <body style="margin:0;padding:0;background-color:#0a0a0a;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;font-size:1px;line-height:1px;color:#0a0a0a;">${preheader}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a0a0a;padding:40px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background-color:#141414;border-radius:16px;border:1px solid #232323;overflow:hidden;">
            <tr>
              <td style="padding:28px 32px;text-align:center;border-bottom:1px solid #232323;">
                <img src="${logoUrl}" alt="OSF Serviços" width="40" height="40" style="border-radius:8px;display:block;margin:0 auto 10px auto;" />
                <span style="font-family:${headingFont};font-size:18px;font-weight:700;color:#ffffff;letter-spacing:0.2px;">OSF Serviços</span>
              </td>
            </tr>
            <tr>
              <td style="padding:36px 32px 8px 32px;">
                <h1 style="margin:0 0 16px 0;font-family:${headingFont};font-size:22px;font-weight:700;color:#ffffff;">${heading}</h1>
                <div style="font-family:${bodyFont};font-size:14px;line-height:1.7;color:#9ca3af;">${bodyHtml}</div>
                <table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0 20px 0;">
                  <tr>
                    <td style="border-radius:12px;background-color:#F0AC28;">
                      <a href="${ctaUrl}" target="_blank" style="display:inline-block;padding:14px 28px;font-family:${headingFont};font-size:14px;font-weight:700;color:#0a0a0a;text-decoration:none;border-radius:12px;">${ctaLabel}</a>
                    </td>
                  </tr>
                </table>
                <p style="margin:0 0 28px 0;font-family:${bodyFont};font-size:12px;line-height:1.6;color:#4b5563;word-break:break-all;">
                  Se o botão não funcionar, copie e cole este link no seu navegador:<br />
                  <a href="${ctaUrl}" style="color:#F0AC28;text-decoration:underline;">${ctaUrl}</a>
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px;background-color:#0a0a0a;border-top:1px solid #232323;text-align:center;">
                <p style="margin:0;font-family:${bodyFont};font-size:12px;color:#4b5563;">${footerNote}</p>
                <p style="margin:10px 0 0 0;font-family:${bodyFont};font-size:11px;color:#4b5563;">&copy; ${year} OSF Serviços. Todos os direitos reservados.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
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
    const html = this.renderTemplate({
      preheader: 'Confirme seu email para ativar sua conta na OSF Serviços.',
      heading: 'Confirme seu email',
      bodyHtml: `
        <p style="margin:0 0 12px 0;">Olá!</p>
        <p style="margin:0;">Falta pouco para começar a usar a OSF Serviços. Clique no botão abaixo para confirmar seu email e ativar sua conta.</p>
      `,
      ctaLabel: 'Confirmar email',
      ctaUrl: verifyUrl,
      footerNote: 'Se você não criou uma conta na OSF Serviços, pode ignorar esta mensagem com segurança.',
    });

    return this.sendMail(
      to,
      'Confirme seu email - OSF Serviços',
      `Confirme seu email na OSF Serviços acessando o link: ${verifyUrl}`,
      html,
    );
  }

  async sendPasswordResetEmail(to: string, token: string) {
    const resetUrl = `${this.getBaseUrl()}/reset-password?token=${encodeURIComponent(token)}`;
    const html = this.renderTemplate({
      preheader: 'Recebemos um pedido para redefinir sua senha na OSF Serviços.',
      heading: 'Redefinir sua senha',
      bodyHtml: `
        <p style="margin:0 0 12px 0;">Olá!</p>
        <p style="margin:0;">Recebemos um pedido para redefinir a senha da sua conta. Clique no botão abaixo para escolher uma nova senha.</p>
      `,
      ctaLabel: 'Redefinir senha',
      ctaUrl: resetUrl,
      footerNote: 'Se você não solicitou essa alteração, pode ignorar esta mensagem com segurança — sua senha atual continuará funcionando.',
    });

    return this.sendMail(
      to,
      'Redefinição de senha - OSF Serviços',
      `Redefina sua senha na OSF Serviços acessando o link: ${resetUrl}`,
      html,
    );
  }
}
