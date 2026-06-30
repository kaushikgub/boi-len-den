import { Module } from '@nestjs/common';
import { KeysService } from './keys.service';
import { JwksController } from './jwks.controller';

@Module({
  controllers: [JwksController],
  providers: [KeysService],
  exports: [KeysService],
})
export class KeysModule {}
