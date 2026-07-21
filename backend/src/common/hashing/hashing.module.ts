import { Module } from '@nestjs/common';
import { HashingService } from './providers/hashing.service';

@Module({
  providers: [HashingService],
  exports: [HashingService],
})
export class HashingModule {}
