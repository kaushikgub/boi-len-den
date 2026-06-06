import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '@app/common';
import { createHash, randomBytes, randomUUID } from 'crypto';
import * as jwt from 'jsonwebtoken';
import { KeysService } from '../keys/keys.service';
import { Role, User } from '../users/user.entity';

export interface AccessTokenClaims {
  sub: string;
  email: string;
  roles: Role[];
  jti: string;
}

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  /** Seconds until the access token expires — handy for the client. */
  expiresIn: number;
}

/**
 * Issues and rotates tokens.
 *  - Access token: short-lived RS256 JWT carrying roles + a jti, so it can be
 *    revoked via the Redis denylist.
 *  - Refresh token: opaque `<id>.<secret>`. Only a SHA-256 of the secret is
 *    stored in Redis (key refresh:<id>), so a Redis dump can't mint tokens. Each
 *    use rotates: the old record is deleted and a new one issued.
 */
@Injectable()
export class TokenService {
  constructor(
    private readonly keys: KeysService,
    private readonly redis: RedisService,
    private readonly config: ConfigService,
  ) {}

  private get accessTtl(): number {
    return Number(this.config.get('ACCESS_TOKEN_TTL', '900'));
  }

  private get refreshTtl(): number {
    return Number(this.config.get('REFRESH_TOKEN_TTL', '1209600'));
  }

  private refreshKey(id: string): string {
    return `refresh:${id}`;
  }

  private denylistKey(jti: string): string {
    return `denylist:jti:${jti}`;
  }

  private sha256(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  /** Mint a fresh access + refresh pair for a user. */
  async issueForUser(user: User): Promise<IssuedTokens> {
    const accessToken = this.signAccessToken(user);
    const refreshToken = await this.createRefreshToken(user.id);
    return { accessToken, refreshToken, expiresIn: this.accessTtl };
  }

  private signAccessToken(user: User): string {
    return jwt.sign(
      { email: user.email, roles: user.roles },
      this.keys.getPrivateKey(),
      {
        algorithm: 'RS256',
        expiresIn: this.accessTtl,
        subject: user.id,
        jwtid: randomUUID(),
        keyid: this.keys.kid,
        issuer: 'auth-service',
      },
    );
  }

  private async createRefreshToken(userId: string): Promise<string> {
    const id = randomUUID();
    const secret = randomBytes(32).toString('hex');
    await this.redis.client.set(
      this.refreshKey(id),
      JSON.stringify({ userId, secretHash: this.sha256(secret) }),
      'EX',
      this.refreshTtl,
    );
    return `${id}.${secret}`;
  }

  /**
   * Validate a refresh token and atomically rotate it. Returns the userId the
   * caller should re-issue tokens for, or throws if the token is invalid/expired.
   */
  async rotateRefreshToken(presented: string): Promise<{ userId: string }> {
    const [id, secret] = presented.split('.');
    if (!id || !secret) throw new UnauthorizedException('Malformed refresh token');

    const raw = await this.redis.client.get(this.refreshKey(id));
    if (!raw) throw new UnauthorizedException('Refresh token expired or revoked');

    const { userId, secretHash } = JSON.parse(raw) as { userId: string; secretHash: string };
    if (this.sha256(secret) !== secretHash) {
      // Presented secret doesn't match — treat the record as compromised and drop it.
      await this.redis.client.del(this.refreshKey(id));
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Rotate: single-use. Delete the old record before issuing a new pair.
    await this.redis.client.del(this.refreshKey(id));
    return { userId };
  }

  /** Drop a specific refresh record (logout). */
  async revokeRefreshToken(presented: string): Promise<void> {
    const [id] = presented.split('.');
    if (id) await this.redis.client.del(this.refreshKey(id));
  }

  /** Add an access-token jti to the denylist for its remaining lifetime. */
  async revokeAccessJti(jti: string, expSeconds: number): Promise<void> {
    const ttl = Math.max(1, expSeconds - Math.floor(Date.now() / 1000));
    await this.redis.client.set(this.denylistKey(jti), '1', 'EX', ttl);
  }
}
