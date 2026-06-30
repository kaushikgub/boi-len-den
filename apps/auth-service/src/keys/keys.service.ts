import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createHash,
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  KeyObject,
} from 'crypto';
import { readFileSync } from 'fs';

/**
 * Owns the RS256 signing material. auth-service is the ONLY service with the
 * private key; everyone else validates using the public key served from the
 * JWKS endpoint. In dev/test, if no key path is configured we generate an
 * ephemeral keypair at boot so the service is runnable without an openssl step —
 * the gateway picks it up because it fetches the JWKS at runtime, not from disk.
 */
@Injectable()
export class KeysService implements OnModuleInit {
  private readonly logger = new Logger(KeysService.name);
  private privateKey!: KeyObject;
  private publicKey!: KeyObject;
  /** Key id, threaded into the JWT header and the JWK so consumers pick the right key. */
  kid!: string;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const privatePath = this.config.get<string>('JWT_PRIVATE_KEY_PATH');
    if (privatePath) {
      const pem = readFileSync(privatePath, 'utf8');
      this.privateKey = createPrivateKey(pem);
      this.publicKey = createPublicKey(this.privateKey);
      this.logger.log(`Loaded RS256 private key from ${privatePath}`);
    } else {
      const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
      this.privateKey = privateKey;
      this.publicKey = publicKey;
      this.logger.warn(
        'JWT_PRIVATE_KEY_PATH not set — generated an EPHEMERAL RS256 keypair (dev/test only). ' +
          'Tokens will not survive a restart.',
      );
    }
    this.kid = this.computeKid(this.publicKey);
  }

  getPrivateKey(): KeyObject {
    return this.privateKey;
  }

  /** Public key as a JWK, ready to serve from the JWKS endpoint. */
  getPublicJwk(): Record<string, unknown> {
    const jwk = this.publicKey.export({ format: 'jwk' });
    return { ...jwk, kid: this.kid, use: 'sig', alg: 'RS256' };
  }

  /** Stable key id derived from the public key bytes. */
  private computeKid(publicKey: KeyObject): string {
    const der = publicKey.export({ type: 'spki', format: 'der' });
    return createHash('sha256').update(der).digest('base64url').slice(0, 16);
  }
}
