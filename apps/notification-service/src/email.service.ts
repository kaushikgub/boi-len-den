import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';

@Injectable()
export class EmailService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EmailService.name);
  private transporter!: Transporter;
  private readonly from: string;

  constructor(config: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: config.get('SMTP_HOST', 'localhost'),
      port: Number(config.get('SMTP_PORT', '1025')),
      secure: false,
      ignoreTLS: true,
    });
    this.from = config.get('SMTP_FROM', 'noreply@boi-len-den.local');
  }

  async onModuleInit() {
    try {
      await this.transporter.verify();
      this.logger.log(`SMTP transport ready (${this.transporter.options})`);
    } catch (err) {
      this.logger.warn(`SMTP transport not reachable: ${(err as Error).message}`);
    }
  }

  async sendBookRented(to: string, bookId: string, dueAt: string): Promise<void> {
    await this.transporter.sendMail({
      from: this.from,
      to,
      subject: 'Your rental is confirmed',
      text: `You have rented book ${bookId}. Please return it by ${new Date(dueAt).toDateString()}.`,
      html: `<p>You have rented book <strong>${bookId}</strong>.<br>Please return it by <strong>${new Date(dueAt).toDateString()}</strong>.</p>`,
    });
  }

  async sendBookReturned(to: string, bookId: string): Promise<void> {
    await this.transporter.sendMail({
      from: this.from,
      to,
      subject: 'Return confirmed — thanks!',
      text: `Book ${bookId} has been returned. Thanks for using Boi-Len-Den!`,
      html: `<p>Book <strong>${bookId}</strong> has been returned. Thanks for using <em>Boi-Len-Den</em>!</p>`,
    });
  }

  async sendBookOverdue(to: string, bookId: string, dueAt: string): Promise<void> {
    await this.transporter.sendMail({
      from: this.from,
      to,
      subject: 'Overdue notice — please return your book',
      text: `Book ${bookId} was due on ${new Date(dueAt).toDateString()} and is now overdue. Please return it as soon as possible.`,
      html: `<p>Book <strong>${bookId}</strong> was due on <strong>${new Date(dueAt).toDateString()}</strong> and is now overdue.<br>Please return it as soon as possible.</p>`,
    });
  }

  onModuleDestroy() {
    this.transporter.close();
  }
}
