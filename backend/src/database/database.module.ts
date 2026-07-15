import { Global, Module } from '@nestjs/common';
import { DatabaseService } from './providers/database.service';

@Global() //this makes the module available everywhere; once imported in the apps module, dont need to import again
@Module({
  providers: [DatabaseService],
  exports: [DatabaseService]
})
export class DatabaseModule {}
