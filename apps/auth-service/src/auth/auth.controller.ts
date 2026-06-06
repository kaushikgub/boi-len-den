import {
  Body,
  Controller,
  HttpCode,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response, CookieOptions } from 'express';
import * as jwt from 'jsonwebtoken';
import { AuthService, AuthResult } from './auth.service';
import { TokenService } from './token.service';
import { LoginDto, RegisterDto } from './dto';

export const REFRESH_COOKIE = 'refresh_token';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly tokens: TokenService,
    private readonly config: ConfigService,
  ) {}

  private cookieOptions(): CookieOptions {
    const isProd = this.config.get('NODE_ENV') === 'production';
    return {
      httpOnly: true, // JS can never read it — mitigates XSS token theft
      secure: isProd, // HTTPS-only in prod; relaxed for local http
      sameSite: 'lax',
      path: '/',
      maxAge: Number(this.config.get('REFRESH_TOKEN_TTL', '1209600')) * 1000,
    };
  }

  /** Set the refresh token as an HttpOnly cookie and return only the access token in the body. */
  private respondWithTokens(res: Response, result: AuthResult) {
    res.cookie(REFRESH_COOKIE, result.refreshToken, this.cookieOptions());
    return {
      accessToken: result.accessToken,
      expiresIn: result.expiresIn,
      user: result.user,
    };
  }

  @Post('register')
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    return this.respondWithTokens(res, await this.auth.register(dto.email, dto.password));
  }

  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    return this.respondWithTokens(res, await this.auth.login(dto.email, dto.password));
  }

  @Post('refresh')
  @HttpCode(200)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const presented = req.cookies?.[REFRESH_COOKIE];
    if (!presented) throw new UnauthorizedException('No refresh token');
    return this.respondWithTokens(res, await this.auth.refresh(presented));
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(req.cookies?.[REFRESH_COOKIE]);

    // Best-effort: also denylist the presented access token's jti so it can't be
    // used for its remaining lifetime.
    const authz = req.headers.authorization;
    if (authz?.startsWith('Bearer ')) {
      const decoded = jwt.decode(authz.slice(7)) as { jti?: string; exp?: number } | null;
      if (decoded?.jti && decoded.exp) {
        await this.tokens.revokeAccessJti(decoded.jti, decoded.exp);
      }
    }

    res.clearCookie(REFRESH_COOKIE, { path: '/' });
  }
}
