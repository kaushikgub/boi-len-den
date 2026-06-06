import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/user.entity';
import { UsersService } from '../users/users.service';
import { KeysModule } from '../keys/keys.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { TokenService } from './token.service';

@Module({
  imports: [TypeOrmModule.forFeature([User]), KeysModule],
  controllers: [AuthController],
  providers: [AuthService, UsersService, TokenService],
})
export class AuthModule {}
