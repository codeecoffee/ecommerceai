import { Module } from '@nestjs/common';
import { AddressService } from './providers/address.service';
import { AddressController } from './address.controller';
import { DatabaseService } from '../database/providers/database.service';

@Module({
  imports: [DatabaseService],
  exports: [AddressService],
  controllers: [AddressController],
  providers: [AddressService],
})
export class AddressModule {}
