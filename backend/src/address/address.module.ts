import { Module } from '@nestjs/common';
import { AddressService } from './providers/address.service';
import { AddressController } from './address.controller';
import { DatabaseModule } from '../database/database.module';
import { ADDRESS_GEOCODER } from './interfaces/address-geocoder.token';
import { PhotonGeocoderService } from './providers/pothon-geocoder.service';

@Module({
  imports: [DatabaseModule],
  exports: [AddressService],
  controllers: [AddressController],
  providers: [
    AddressService,
    {
      provide: ADDRESS_GEOCODER,
      useClass: PhotonGeocoderService,
    },
  ],
})
export class AddressModule {}
