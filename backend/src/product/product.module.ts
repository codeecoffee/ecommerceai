import { Module } from '@nestjs/common';
import { ProductService } from './provider/product.service';
import { ProductController } from './product.controller';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [ProductController],
  providers: [ProductService],
  exports: [ProductService],
})
export class ProductModule {}
