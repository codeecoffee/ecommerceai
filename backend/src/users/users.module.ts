import { forwardRef, Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './providers/users.service';
import { AuthModule } from '../auth/auth.module';
import { HashingModule } from '../common/hashing/hashing.module';
import { UsersMapper } from './providers/users.mapper';

@Module({
  controllers: [UsersController],
  providers: [UsersService, UsersMapper],
  exports: [UsersService],
  imports: [forwardRef(() => AuthModule), HashingModule],
})
export class UsersModule {}
