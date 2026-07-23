import { forwardRef, Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './providers/auth.service';
import { UsersModule } from '../users/users.module';
import { DatabaseModule } from '../database/database.module';
import { HashingModule } from '../common/hashing/hashing.module';

@Module({
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
  imports: [forwardRef(() => UsersModule), DatabaseModule, HashingModule]
})
export class AuthModule {}
