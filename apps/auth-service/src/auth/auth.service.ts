import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { User } from '../users/user.entity';
import { IssuedTokens, TokenService } from './token.service';

export interface AuthResult extends IssuedTokens {
  user: { id: string; email: string; roles: User['roles'] };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly tokens: TokenService,
  ) {}

  private toResult(user: User, issued: IssuedTokens): AuthResult {
    return { ...issued, user: { id: user.id, email: user.email, roles: user.roles } };
  }

  async register(email: string, password: string): Promise<AuthResult> {
    const user = await this.users.create(email, password);
    return this.toResult(user, await this.tokens.issueForUser(user));
  }

  async login(email: string, password: string): Promise<AuthResult> {
    const user = await this.users.validateCredentials(email, password);
    if (!user) throw new UnauthorizedException('Invalid email or password');
    return this.toResult(user, await this.tokens.issueForUser(user));
  }

  /** Rotate the refresh token and mint a fresh pair for the same user. */
  async refresh(presentedRefreshToken: string): Promise<AuthResult> {
    const { userId } = await this.tokens.rotateRefreshToken(presentedRefreshToken);
    const user = await this.users.findById(userId);
    if (!user) throw new UnauthorizedException('User no longer exists');
    return this.toResult(user, await this.tokens.issueForUser(user));
  }

  async logout(presentedRefreshToken: string | undefined): Promise<void> {
    if (presentedRefreshToken) await this.tokens.revokeRefreshToken(presentedRefreshToken);
  }
}
