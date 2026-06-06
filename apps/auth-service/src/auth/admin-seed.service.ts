import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';

/**
 * Bootstraps an initial admin/librarian account so someone can use the admin
 * panel — there's otherwise no way to obtain a privileged role (registration
 * only grants `member`). Seeds from ADMIN_EMAIL/ADMIN_PASSWORD if set, else a
 * dev default. Skipped entirely in production unless ADMIN_EMAIL is provided.
 */
@Injectable()
export class AdminSeedService implements OnModuleInit {
  private readonly logger = new Logger(AdminSeedService.name);

  constructor(
    private readonly users: UsersService,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit() {
    const isProd = this.config.get('NODE_ENV') === 'production';
    const email = this.config.get<string>('ADMIN_EMAIL') ?? (isProd ? undefined : 'admin@boi-len-den.local');
    const password = this.config.get<string>('ADMIN_PASSWORD') ?? (isProd ? undefined : 'admin12345');
    if (!email || !password) return;

    if (await this.users.findByEmail(email)) return; // already seeded
    await this.users.create(email, password, ['admin', 'librarian']);
    this.logger.log(`seeded admin account: ${email}`);
  }
}
