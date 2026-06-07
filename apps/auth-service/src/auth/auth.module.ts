import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/user.entity';
import { UsersService } from '../users/users.service';
import { KeysModule } from '../keys/keys.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { TokenService } from './token.service';
import { AdminSeedService } from './admin-seed.service';
import { InternalController } from '../users/internal.controller';

@Module({
  imports: [TypeOrmModule.forFeature([User]), KeysModule],
  controllers: [AuthController, InternalController],
  providers: [AuthService, UsersService, TokenService, AdminSeedService],
})
export class AuthModule {}
