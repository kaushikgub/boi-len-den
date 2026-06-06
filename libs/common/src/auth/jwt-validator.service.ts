import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import { JwksClient } from 'jwks-rsa';
import { RedisService } from '../redis/redis.service';
import { AuthenticatedUser, Role } from './authenticated-user';

interface AccessClaims {
  sub: string;
  email: string;
  roles: Role[];
  jti: string;
  exp: number;
}

/**
 * Validates RS256 access tokens against the auth-service JWKS, then checks the
 * Redis revocation denylist. Used by the gateway AND defensively inside each
 * downstream service — so a forged or revoked token is rejected even if it
 * somehow reaches a service directly. The JWKS is fetched once and cached.
 */
@Injectable()
export class JwtValidatorService {
  private readonly jwks: JwksClient;

  constructor(
    config: ConfigService,
    private readonly redis: RedisService,
  ) {
    this.jwks = new JwksClient({
      jwksUri: config.getOrThrow<string>('AUTH_JWKS_URL'),
      cache: true,
      cacheMaxEntries: 5,
      cacheMaxAge: 10 * 60 * 1000, // 10 minutes
      rateLimit: true,
    });
  }

  private getKey: jwt.GetPublicKeyOrSecret = (header, callback) => {
    this.jwks
      .getSigningKey(header.kid)
      .then((key) => callback(null, key.getPublicKey()))
      .catch((err) => callback(err as Error));
  };

  async validate(token: string): Promise<AuthenticatedUser> {
    const claims = await new Promise<AccessClaims>((resolve, reject) => {
      jwt.verify(
        token,
        this.getKey,
        { algorithms: ['RS256'], issuer: 'auth-service' },
        (err, decoded) => {
          if (err) reject(new UnauthorizedException('Invalid token'));
          else resolve(decoded as AccessClaims);
        },
      );
    });

    if (claims.jti) {
      const revoked = await this.redis.client.get(`denylist:jti:${claims.jti}`);
      if (revoked) throw new UnauthorizedException('Token revoked');
    }

    return { userId: claims.sub, email: claims.email, roles: claims.roles ?? [], jti: claims.jti };
  }
}
