import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';

export interface BookDetails {
  title: string;
  author: string;
  genre?: string;
  publishedYear?: number;
}

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

  async sendBookRented(to: string, book: BookDetails, dueAt: string): Promise<void> {
    const due = new Date(dueAt).toDateString();
    const meta = this.bookMeta(book);
    await this.transporter.sendMail({
      from: this.from,
      to,
      subject: `Rental confirmed: "${book.title}"`,
      text: [
        `Your rental has been confirmed!`,
        ``,
        `Book: ${book.title}`,
        `Author: ${book.author}`,
        ...(book.genre ? [`Genre: ${book.genre}`] : []),
        ...(book.publishedYear ? [`Year: ${book.publishedYear}`] : []),
        ``,
        `Please return the book by ${due}.`,
        ``,
        `Happy reading!`,
        `— Boi-Len-Den Library`,
      ].join('\n'),
      html: this.layout(`
        <h2 style="color:#4f46e5;margin:0 0 4px">Rental Confirmed!</h2>
        <p style="color:#6b7280;margin:0 0 24px">Your book is ready to read.</p>
        ${this.bookCard(book)}
        <table style="width:100%;border-collapse:collapse;margin:24px 0">
          <tr>
            <td style="padding:12px 16px;background:#fef3c7;border-radius:8px;border-left:4px solid #f59e0b">
              <span style="font-size:13px;color:#92400e;font-weight:600">Return by</span><br>
              <span style="font-size:18px;font-weight:700;color:#78350f">${due}</span>
            </td>
          </tr>
        </table>
        <p style="color:#6b7280;font-size:14px">Happy reading! Return on time to avoid overdue fees.</p>
      `),
    });
  }

  async sendBookReturned(to: string, book: BookDetails, returnedAt?: string): Promise<void> {
    const returnDate = returnedAt ? new Date(returnedAt).toDateString() : new Date().toDateString();
    await this.transporter.sendMail({
      from: this.from,
      to,
      subject: `Return confirmed: "${book.title}"`,
      text: [
        `We've received your return — thank you!`,
        ``,
        `Book: ${book.title}`,
        `Author: ${book.author}`,
        ...(book.genre ? [`Genre: ${book.genre}`] : []),
        ...(book.publishedYear ? [`Year: ${book.publishedYear}`] : []),
        ``,
        `Returned on: ${returnDate}`,
        ``,
        `Thanks for using Boi-Len-Den Library!`,
      ].join('\n'),
      html: this.layout(`
        <h2 style="color:#059669;margin:0 0 4px">Return Confirmed</h2>
        <p style="color:#6b7280;margin:0 0 24px">We've received your book — thank you!</p>
        ${this.bookCard(book)}
        <table style="width:100%;border-collapse:collapse;margin:24px 0">
          <tr>
            <td style="padding:12px 16px;background:#d1fae5;border-radius:8px;border-left:4px solid #059669">
              <span style="font-size:13px;color:#065f46;font-weight:600">Returned on</span><br>
              <span style="font-size:18px;font-weight:700;color:#064e3b">${returnDate}</span>
            </td>
          </tr>
        </table>
        <p style="color:#6b7280;font-size:14px">Thanks for using <strong>Boi-Len-Den Library</strong>. Rent your next book anytime!</p>
      `),
    });
  }

  async sendBookOverdue(to: string, book: BookDetails, dueAt: string): Promise<void> {
    const due = new Date(dueAt).toDateString();
    await this.transporter.sendMail({
      from: this.from,
      to,
      subject: `Overdue notice: "${book.title}"`,
      text: [
        `This is a reminder that your rental is overdue.`,
        ``,
        `Book: ${book.title}`,
        `Author: ${book.author}`,
        ...(book.genre ? [`Genre: ${book.genre}`] : []),
        ...(book.publishedYear ? [`Year: ${book.publishedYear}`] : []),
        ``,
        `Was due: ${due}`,
        ``,
        `Please return the book as soon as possible to avoid further penalties.`,
        ``,
        `— Boi-Len-Den Library`,
      ].join('\n'),
      html: this.layout(`
        <h2 style="color:#dc2626;margin:0 0 4px">Overdue Notice</h2>
        <p style="color:#6b7280;margin:0 0 24px">Please return this book as soon as possible.</p>
        ${this.bookCard(book)}
        <table style="width:100%;border-collapse:collapse;margin:24px 0">
          <tr>
            <td style="padding:12px 16px;background:#fee2e2;border-radius:8px;border-left:4px solid #dc2626">
              <span style="font-size:13px;color:#991b1b;font-weight:600">Was due on</span><br>
              <span style="font-size:18px;font-weight:700;color:#7f1d1d">${due}</span>
            </td>
          </tr>
        </table>
        <p style="color:#6b7280;font-size:14px">Please return the book immediately to avoid further penalties.</p>
      `),
    });
  }

  async sendNewBookAvailable(to: string, title: string, author: string): Promise<void> {
    const book: BookDetails = { title, author };
    await this.transporter.sendMail({
      from: this.from,
      to,
      subject: `New arrival: "${title}"`,
      text: [
        `A new book has just been added to the library!`,
        ``,
        `Book: ${title}`,
        `Author: ${author}`,
        ``,
        `Log in to rent it before copies run out.`,
        ``,
        `— Boi-Len-Den Library`,
      ].join('\n'),
      html: this.layout(`
        <h2 style="color:#4f46e5;margin:0 0 4px">New Arrival! 📚</h2>
        <p style="color:#6b7280;margin:0 0 24px">A new book has just been added to the library.</p>
        ${this.bookCard(book)}
        <p style="color:#6b7280;font-size:14px;margin-top:24px">
          Log in to <strong>Boi-Len-Den Library</strong> and rent it before copies run out!
        </p>
      `),
    });
  }

  onModuleDestroy() {
    this.transporter.close();
  }

  /* ─── Shared layout & components ─────────────────────────────────────────── */

  private bookMeta(book: BookDetails): string {
    const parts: string[] = [];
    if (book.author) parts.push(`by ${book.author}`);
    if (book.genre) parts.push(book.genre);
    if (book.publishedYear) parts.push(`${book.publishedYear}`);
    return parts.join(' · ');
  }

  private bookCard(book: BookDetails): string {
    const meta = this.bookMeta(book);
    return `
      <table style="width:100%;border-collapse:collapse;background:#f8fafc;border-radius:10px;overflow:hidden;border:1px solid #e2e8f0">
        <tr>
          <td style="padding:20px 24px">
            <div style="font-size:11px;font-weight:700;letter-spacing:.08em;color:#4f46e5;text-transform:uppercase;margin-bottom:6px">Book</div>
            <div style="font-size:20px;font-weight:700;color:#1e293b;line-height:1.3;margin-bottom:6px">${this.esc(book.title)}</div>
            ${meta ? `<div style="font-size:14px;color:#64748b">${this.esc(meta)}</div>` : ''}
          </td>
        </tr>
      </table>`;
  }

  private layout(body: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px">
        <!-- Header -->
        <tr>
          <td style="background:#4f46e5;border-radius:12px 12px 0 0;padding:24px 32px">
            <span style="font-size:20px;font-weight:800;color:#fff;letter-spacing:-.5px">Boi-Len-Den</span>
            <span style="font-size:13px;color:#c7d2fe;margin-left:8px">Library</span>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="background:#fff;padding:32px;border-radius:0 0 12px 12px;border:1px solid #e2e8f0;border-top:none">
            ${body}
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding:16px 0;text-align:center;font-size:12px;color:#94a3b8">
            © Boi-Len-Den Library · You're receiving this because you have an account.
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  }

  private esc(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}
