import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';

const DEFAULT_FROM = 'Finly <onboarding@resend.dev>';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly resend: Resend | null =
    process.env.RESEND_API_KEY && process.env.RESEND_API_KEY !== 're_xxxxxx'
      ? new Resend(process.env.RESEND_API_KEY)
      : null;
  private readonly from: string = process.env.RESEND_FROM ?? DEFAULT_FROM;

  get isConfigured(): boolean {
    return this.resend !== null;
  }

  async sendOtp(to: string, otp: string): Promise<void> {
    if (!this.resend) {
      this.logger.log(`[OTP] ${to}: ${otp}`);
      return;
    }
    await this.resend.emails.send({
      from: this.from,
      to,
      subject: 'Your Finly verification code',
      text: `Your Finly verification code is ${otp}. It expires in 10 minutes.`,
      html: `<p>Your Finly verification code is <strong>${otp}</strong>.</p><p>It expires in 10 minutes.</p>`,
    });
  }
}
