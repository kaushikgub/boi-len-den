import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Role, User } from './user.entity';

const BCRYPT_ROUNDS = 12;

@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private readonly users: Repository<User>) {}

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  async create(email: string, password: string, roles: Role[] = ['member']): Promise<User> {
    const normalized = this.normalizeEmail(email);
    const existing = await this.users.findOne({ where: { email: normalized } });
    if (existing) {
      throw new ConflictException('Email already registered');
    }
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const user = this.users.create({ email: normalized, passwordHash, roles });
    try {
      return await this.users.save(user);
    } catch (err: unknown) {
      // Unique-violation safety net for the register/register race.
      if ((err as { code?: string }).code === '23505') {
        throw new ConflictException('Email already registered');
      }
      throw err;
    }
  }

  findByEmail(email: string): Promise<User | null> {
    return this.users.findOne({ where: { email: this.normalizeEmail(email) } });
  }

  findById(id: string): Promise<User | null> {
    return this.users.findOne({ where: { id } });
  }

  async findEmailById(id: string): Promise<string | null> {
    const user = await this.users.findOne({ where: { id }, select: { email: true } });
    return user?.email ?? null;
  }

  async findAllMemberEmails(): Promise<string[]> {
    const members = await this.users
      .createQueryBuilder('u')
      .select('u.email')
      .where(`NOT ('admin' = ANY(u.roles))`)
      .andWhere(`NOT ('librarian' = ANY(u.roles))`)
      .getMany();
    return members.map((u) => u.email);
  }

  /** Returns the user iff the password matches; null otherwise. */
  async validateCredentials(email: string, password: string): Promise<User | null> {
    const user = await this.findByEmail(email);
    if (!user) {
      // Hash a dummy value to keep timing roughly constant against user enumeration.
      await bcrypt.compare(password, '$2b$12$0000000000000000000000000000000000000000000000000000');
      return null;
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    return ok ? user : null;
  }
}
