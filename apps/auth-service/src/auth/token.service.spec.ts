import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { generateKeyPairSync } from 'crypto';
import { RedisService } from '@app/common';
import { TokenService } from './token.service';
import { KeysService } from '../keys/keys.service';
import { User } from '../users/user.entity';

const testKeyPair = generateKeyPairSync('rsa', { modulusLength: 2048 });

/** Minimal in-memory stand-in for the ioredis client used by TokenService. */
class FakeRedis {
  private store = new Map<string, string>();
  async set(key: string, value: string) {
    this.store.set(key, value);
    return 'OK';
  }
  async get(key: string) {
    return this.store.get(key) ?? null;
  }
  async del(key: string) {
    return this.store.delete(key) ? 1 : 0;
  }
  size() {
    return this.store.size;
  }
}

function makeService() {
  const fake = new FakeRedis();
  const redis = { client: fake } as unknown as RedisService;
  const keys = {
    kid: 'test',
    getPrivateKey: () => testKeyPair.privateKey,
  } as unknown as KeysService;
  const config = new ConfigService({ ACCESS_TOKEN_TTL: '900', REFRESH_TOKEN_TTL: '1000' });
  return { service: new TokenService(keys, redis, config), fake };
}

const user = { id: 'u-1', email: 'a@b.com', roles: ['member'] } as User;

describe('TokenService refresh rotation', () => {
  it('issues a refresh token of the form <id>.<secret> and persists one record', async () => {
    const { service, fake } = makeService();
    const issued = await service.issueForUser(user);
    expect(issued.refreshToken).toMatch(/^[0-9a-f-]+\.[0-9a-f]+$/);
    expect(fake.size()).toBe(1);
  });

  it('rotates: a valid refresh token works once and is then consumed', async () => {
    const { service, fake } = makeService();
    const { refreshToken } = await service.issueForUser(user);

    const result = await service.rotateRefreshToken(refreshToken);
    expect(result.userId).toBe('u-1');
    // Old record deleted; nothing re-created by rotate itself.
    expect(fake.size()).toBe(0);

    // Reusing the same token must now fail (single-use).
    await expect(service.rotateRefreshToken(refreshToken)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects a token whose secret does not match and drops the record', async () => {
    const { service, fake } = makeService();
    const { refreshToken } = await service.issueForUser(user);
    const [id] = refreshToken.split('.');
    const tampered = `${id}.deadbeef`;

    await expect(service.rotateRefreshToken(tampered)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    // The record is destroyed on a secret mismatch (treated as compromised).
    expect(fake.size()).toBe(0);
  });

  it('rejects a malformed token', async () => {
    const { service } = makeService();
    await expect(service.rotateRefreshToken('nodot')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects an unknown / expired token', async () => {
    const { service } = makeService();
    await expect(service.rotateRefreshToken('missing.secret')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
