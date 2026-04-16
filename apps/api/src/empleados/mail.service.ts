import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

type MailProvider = 'smtp' | 'graph' | 'auto';

interface MailPayload {
  subject: string;
  text: string;
  html: string;
}

/**
 * Servicio de envío de correo electrónico.
 * Soporta SMTP clásico y Microsoft Graph.
 *
 * Configuración esperada en .env:
 *   SMTP_HOST=smtp-mail.outlook.com
 *   SMTP_PORT=587
 *   SMTP_SECURE=false
 *   SMTP_USER=agomez_nextgen@outlook.com
 *   SMTP_PASS=********
 *
 * Usado actualmente para distribución de códigos QR (Tarea 5).
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly provider: MailProvider;
  private readonly smtpUser: string;
  private readonly smtpHost: string;
  private readonly smtpPort: number;
  private readonly smtpSecure: boolean;
  private readonly smtpPass: string;
  private transporter: nodemailer.Transporter | null = null;

  constructor(private readonly config: ConfigService) {
    this.smtpHost = this.getEnvString(['SMTP_HOST', 'EMAIL_HOST'], 'smtp-mail.outlook.com');
    this.smtpPort = this.getEnvNumber(['SMTP_PORT', 'EMAIL_PORT'], 587);
    this.smtpSecure = this.getEnvBool(['SMTP_SECURE', 'EMAIL_SECURE'], false);
    this.smtpUser = this.getEnvString(['SMTP_USER', 'EMAIL_USER'], '');
    this.smtpPass = this.getEnvString(
      ['SMTP_PASS', 'EMAIL_PASS', 'EMAIL_PASSWORD'],
      '',
    );

    const rawProvider = (
      this.config.get<string>('MAIL_PROVIDER', 'auto') || 'auto'
    ).toLowerCase();

    if (rawProvider === 'microsoft-graph') {
      this.provider = 'graph';
    } else if (
      rawProvider === 'smtp' ||
      rawProvider === 'graph' ||
      rawProvider === 'auto'
    ) {
      this.provider = rawProvider;
    } else {
      this.provider = 'auto';
      this.logger.warn(
        `MAIL_PROVIDER "${rawProvider}" no soportado. Se usará "auto".`,
      );
    }
  }

  private getEnvString(keys: string[], fallback = ''): string {
    for (const key of keys) {
      const value = this.config.get<string>(key);
      if (value !== undefined && value !== null && String(value).trim() !== '') {
        return String(value).trim();
      }
    }

    return fallback;
  }

  private getEnvNumber(keys: string[], fallback: number): number {
    const raw = this.getEnvString(keys, '');
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  private getEnvBool(keys: string[], fallback: boolean): boolean {
    const raw = this.getEnvString(keys, '');
    if (!raw) {
      return fallback;
    }

    return raw.toLowerCase() === 'true';
  }

  private getSmtpTransporter(): nodemailer.Transporter {
    if (this.transporter) {
      return this.transporter;
    }

    if (!this.smtpUser || !this.smtpPass) {
      throw new Error(
        'SMTP_USER/EMAIL_USER y SMTP_PASS/EMAIL_PASS/EMAIL_PASSWORD son obligatorios para envío SMTP',
      );
    }

    this.transporter = nodemailer.createTransport({
      host: this.smtpHost,
      port: this.smtpPort,
      secure: this.smtpSecure,
      auth: {
        user: this.smtpUser,
        pass: this.smtpPass,
      },
    });

    return this.transporter;
  }

  /**
   * Envía el QR personal de un empleado adjunto como PNG.
   *
   * @param to       - Dirección de destino
   * @param nombre   - Nombre completo del empleado (para personalizar asunto)
   * @param qrBuffer - Buffer del archivo PNG del QR
   * @param filename - Nombre del archivo adjunto
   */
  async sendQrEmail(
    to: string,
    nombre: string,
    qrBuffer: Buffer,
    filename: string,
  ): Promise<void> {
    const payload = this.buildMailPayload(nombre, filename);

    if (this.provider === 'graph') {
      await this.sendWithGraph(to, payload, qrBuffer, filename);
      return;
    }

    try {
      await this.sendWithSmtp(to, payload, qrBuffer, filename);
      return;
    } catch (smtpErr: any) {
      if (this.provider === 'auto' && this.shouldFallbackToGraph(smtpErr)) {
        this.logger.warn(
          'SMTP rechazado por Outlook (basic auth deshabilitado). Usando Microsoft Graph como fallback.',
        );
        await this.sendWithGraph(to, payload, qrBuffer, filename);
        return;
      }

      throw this.mapMailError(smtpErr);
    }
  }

  private buildMailPayload(nombre: string, filename: string): MailPayload {
    const displayName = nombre?.trim() || 'colaborador';
    const escapedName = this.escapeHtml(displayName);
    const escapedFilename = this.escapeHtml(filename || 'codigo-qr.png');

    return {
      subject: `Tu código QR personal — ${displayName}`,
      text: [
        `Hola ${displayName},`,
        '',
        'Te compartimos tu codigo QR personal en el archivo adjunto.',
        '',
        'Recomendaciones:',
        '- Guardalo en un lugar seguro.',
        '- No lo compartas con terceros.',
        '- Presentalo cuando te lo soliciten en planta.',
        '',
        `Archivo adjunto: ${filename || 'codigo-qr.png'}`,
        '',
        'Si tienes dudas, responde este correo.',
        '',
        'MERO IT',
      ].join('\n'),
      html: `
<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Tu codigo QR personal</title>
  </head>
  <body style="margin:0;padding:0;background:#f1f5f9;font-family:Segoe UI,Arial,sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;">
      <tr>
        <td align="center" style="padding:28px 16px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border:1px solid #dbe2ea;border-radius:16px;overflow:hidden;">
            <tr>
              <td style="padding:24px 28px;background:linear-gradient(135deg,#1d4ed8,#0d9488);color:#ffffff;">
                <p style="margin:0 0 8px;font-size:12px;letter-spacing:.10em;text-transform:uppercase;opacity:.9;">MERO IT</p>
                <h1 style="margin:0;font-size:24px;line-height:1.2;font-weight:800;">Tu codigo QR esta listo</h1>
                <p style="margin:10px 0 0;font-size:15px;line-height:1.5;opacity:.95;">Hola ${escapedName}, te enviamos tu codigo QR personal como archivo adjunto.</p>
              </td>
            </tr>

            <tr>
              <td style="padding:22px 28px 8px;">
                <p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#334155;">
                  Este codigo se usa para tu identificacion en el proceso operativo. Te recomendamos conservarlo de forma privada.
                </p>

                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 18px;border:1px solid #e2e8f0;border-radius:12px;background:#f8fafc;">
                  <tr>
                    <td style="padding:14px 16px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#64748b;">Archivo adjunto</td>
                  </tr>
                  <tr>
                    <td style="padding:14px 16px;font-size:14px;font-weight:700;color:#0f172a;">${escapedFilename}</td>
                  </tr>
                </table>

                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 10px;">
                  <tr>
                    <td style="padding:0 0 10px;font-size:14px;line-height:1.55;color:#0f172a;">1. Guardalo en un lugar seguro.</td>
                  </tr>
                  <tr>
                    <td style="padding:0 0 10px;font-size:14px;line-height:1.55;color:#0f172a;">2. No lo compartas con terceros.</td>
                  </tr>
                  <tr>
                    <td style="padding:0;font-size:14px;line-height:1.55;color:#0f172a;">3. Presentalo cuando sea solicitado.</td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td style="padding:18px 28px 26px;border-top:1px solid #e2e8f0;">
                <p style="margin:0;font-size:13px;line-height:1.6;color:#64748b;">
                  Si necesitas apoyo, responde este correo y el equipo de IT te ayudara.
                </p>
                <p style="margin:10px 0 0;font-size:12px;color:#94a3b8;">MERO IT</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`.trim(),
    };
  }

  private escapeHtml(value: string): string {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private async sendWithSmtp(
    to: string,
    payload: MailPayload,
    qrBuffer: Buffer,
    filename: string,
  ): Promise<void> {
    const transporter = this.getSmtpTransporter();
    const from = `"MERO IT" <${this.smtpUser}>`;

    await transporter.sendMail({
      from,
      to,
      subject: payload.subject,
      text: payload.text,
      html: payload.html,
      attachments: [
        {
          filename,
          content: qrBuffer,
          contentType: 'image/png',
        },
      ],
    });

    this.logger.log(`Correo enviado por SMTP a ${to}`);
  }

  private hasGraphConfig(): boolean {
    return !!(
      this.config.get<string>('GRAPH_TENANT_ID') &&
      this.config.get<string>('GRAPH_CLIENT_ID') &&
      this.config.get<string>('GRAPH_CLIENT_SECRET')
    );
  }

  private shouldFallbackToGraph(err: any): boolean {
    return this.isOutlookBasicAuthDisabled(err) && this.hasGraphConfig();
  }

  private isOutlookBasicAuthDisabled(err: any): boolean {
    const msg = (err?.message || '').toString().toLowerCase();
    return (
      msg.includes('basic authentication is disabled') ||
      msg.includes('5.7.139')
    );
  }

  private mapMailError(err: any): Error {
    if (this.isOutlookBasicAuthDisabled(err)) {
      const hasGraph = this.hasGraphConfig();
      const guidance = hasGraph
        ? 'Configura MAIL_PROVIDER=graph para enviar con Microsoft Graph.'
        : 'Configura MAIL_PROVIDER=graph y variables GRAPH_* o habilita SMTP AUTH/app password en Outlook.';
      return new Error(
        `Outlook rechazó autenticación SMTP (535 basic auth deshabilitado). ${guidance}`,
      );
    }

    return new Error(err?.message || 'Error enviando correo');
  }

  private async sendWithGraph(
    to: string,
    payload: MailPayload,
    qrBuffer: Buffer,
    filename: string,
  ): Promise<void> {
    if (!this.hasGraphConfig()) {
      throw new Error(
        'MAIL_PROVIDER=graph requiere GRAPH_TENANT_ID, GRAPH_CLIENT_ID y GRAPH_CLIENT_SECRET',
      );
    }

    const sender =
      this.config.get<string>('GRAPH_SENDER_USER') || this.smtpUser;
    if (!sender) {
      throw new Error('GRAPH_SENDER_USER o SMTP_USER es requerido para Graph');
    }

    const accessToken = await this.getGraphAccessToken();
    const endpoint = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(sender)}/sendMail`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          subject: payload.subject,
          body: {
            contentType: 'HTML',
            content: payload.html,
          },
          toRecipients: [{ emailAddress: { address: to } }],
          attachments: [
            {
              '@odata.type': '#microsoft.graph.fileAttachment',
              name: filename,
              contentType: 'image/png',
              contentBytes: qrBuffer.toString('base64'),
            },
          ],
        },
        saveToSentItems: true,
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(
        `Graph sendMail falló (${response.status}): ${detail || response.statusText}`,
      );
    }

    this.logger.log(`Correo enviado por Graph a ${to}`);
  }

  private async getGraphAccessToken(): Promise<string> {
    const tenantId = this.config.get<string>('GRAPH_TENANT_ID', '');
    const clientId = this.config.get<string>('GRAPH_CLIENT_ID', '');
    const clientSecret = this.config.get<string>('GRAPH_CLIENT_SECRET', '');

    const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
      scope: 'https://graph.microsoft.com/.default',
    });

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    const tokenData = (await response.json()) as {
      access_token?: string;
      error?: string;
      error_description?: string;
    };

    if (!response.ok || !tokenData.access_token) {
      throw new Error(
        `No se pudo obtener token de Graph: ${tokenData.error_description || tokenData.error || response.statusText}`,
      );
    }

    return tokenData.access_token;
  }
}
