import { sendPasswordResetEmail, sendVerificationEmail } from '../emailService';
import { Resend } from 'resend';

jest.mock('resend');

describe('emailService', () => {
  const originalEnv = process.env;
  let mockSend: jest.Mock;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv, RESEND_API_KEY: 'test_key', FROM_EMAIL: 'test@zidario.ro' };
    
    mockSend = jest.fn().mockResolvedValue({ id: 'mocked_email_id' });
    (Resend as jest.Mock).mockImplementation(() => ({
      emails: {
        send: mockSend,
      },
    }));
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('throws error if RESEND_API_KEY is missing', async () => {
    delete process.env.RESEND_API_KEY;
    await expect(sendVerificationEmail('test@example.com', '123456')).rejects.toThrow('RESEND_API_KEY lipsește din variabilele de mediu.');
  });

  it('sendPasswordResetEmail calls resend with correct parameters', async () => {
    await sendPasswordResetEmail('user@test.com', '987654');
    expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({
      to: 'user@test.com',
      from: 'Zidario <test@zidario.ro>',
      subject: 'Codul tău de resetare parolă — Zidario',
      html: expect.stringContaining('987654'),
    }));
  });

  it('sendVerificationEmail calls resend with correct parameters', async () => {
    await sendVerificationEmail('newuser@test.com', '112233');
    expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({
      to: 'newuser@test.com',
      from: 'Zidario <test@zidario.ro>',
      subject: 'Codul tău de verificare cont — Zidario',
      html: expect.stringContaining('112233'),
    }));
  });
});
