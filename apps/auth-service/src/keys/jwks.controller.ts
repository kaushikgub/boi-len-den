import { Controller, Get } from '@nestjs/common';
import { KeysService } from './keys.service';

/**
 * Standard JWKS endpoint. The gateway and every service fetch this to validate
 * access tokens — so rotating the signing key never requires redeploying them.
 */
@Controller('.well-known')
export class JwksController {
  constructor(private readonly keys: KeysService) {}

  @Get('jwks.json')
  jwks() {
    return { keys: [this.keys.getPublicJwk()] };
  }
}
