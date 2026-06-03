import { Injectable } from '@nestjs/common';

@Injectable()
export class EmailService {
  async sendVerificationEmail(to: string, token: string) {
    try {
      console.log(`Sending verification email to ${to} with token ${token}`);
      // TODO: integrate with Nodemailer/Resend using env config
      return true;
    } catch (err) {
      console.error('Email send failed:', err);
      return false;
    }
  }

  async sendPasswordResetEmail(to: string, token: string) {
    try {
      console.log(`Sending password reset to ${to} with token ${token}`);
      return true;
    } catch (err) {
      console.error('Email send failed:', err);
      return false;
    }
  }
}
