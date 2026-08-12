import { forwardRef, Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './providers/users.service';
import { AuthModule } from '../auth/auth.module';
import { HashingModule } from '../common/hashing/hashing.module';
import { UsersMapper } from './mappers/users.mapper';
import { AddressModule } from '../address/address.module';

@Module({
  controllers: [UsersController],
  providers: [UsersService, UsersMapper],
  exports: [UsersService],
  imports: [forwardRef(() => AuthModule), HashingModule, AddressModule],
})
export class UsersModule {}
