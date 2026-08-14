import { Logger } from '@nestjs/common';
import { MailService } from './mail.service';

jest.mock('resend', () => ({
  Resend: jest.fn(),
}));

import { Resend } from 'resend';

const MockResend = Resend as jest.Mock;

function clearResendEnv() {
  delete process.env.RESEND_API_KEY;
  delete process.env.RESEND_FROM;
}

describe('MailService', () => {
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    clearResendEnv();
    MockResend.mockReset();
    logSpy = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    clearResendEnv();
    logSpy.mockRestore();
  });

  it('logs the OTP to the console when Resend is not configured', async () => {
    const service = new MailService();
    expect(service.isConfigured).toBe(false);

    await service.sendOtp('owner@finly.local', '123456');

    expect(MockResend).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith('[OTP] owner@finly.local: 123456');
  });

  it('sends the OTP via Resend when configured', async () => {
    process.env.RESEND_API_KEY = 're_1234567890';
    process.env.RESEND_FROM = 'Finly <finly@example.com>';
    const send = jest
      .fn<
        Promise<{ data: { id: string } | null; error: unknown }>,
        [options: Record<string, unknown>]
      >()
      .mockResolvedValue({ data: { id: 'email-id' }, error: null });
    MockResend.mockReturnValue({ emails: { send } });

    const service = new MailService();
    expect(service.isConfigured).toBe(true);

    await service.sendOtp('owner@finly.local', '123456');

    expect(MockResend).toHaveBeenCalledWith('re_1234567890');
    const message = send.mock.calls[0][0];
    expect(message).toMatchObject({
      from: 'Finly <finly@example.com>',
      to: 'owner@finly.local',
      subject: 'Your Finly verification code',
      text: 'Your Finly verification code is 123456. It expires in 10 minutes.',
    });
    expect(logSpy).not.toHaveBeenCalled();
  });

  it('falls back to the default Resend sender', async () => {
    process.env.RESEND_API_KEY = 're_1234567890';
    const send = jest
      .fn<
        Promise<{ data: { id: string } | null; error: unknown }>,
        [options: Record<string, unknown>]
      >()
      .mockResolvedValue({ data: { id: 'email-id' }, error: null });
    MockResend.mockReturnValue({ emails: { send } });

    const service = new MailService();

    await service.sendOtp('owner@finly.local', '123456');

    const message = send.mock.calls[0][0];
    expect(message).toMatchObject({
      from: 'Finly <onboarding@resend.dev>',
    });
  });

  it('treats the placeholder API key as unconfigured', () => {
    process.env.RESEND_API_KEY = 're_xxxxxx';
    const service = new MailService();
    expect(service.isConfigured).toBe(false);
    expect(MockResend).not.toHaveBeenCalled();
  });
});
