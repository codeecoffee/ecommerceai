import { Module } from '@nestjs/common';
import { OrderService } from './provider/order.service';
import { OrderController } from './order.controller';
import { ProductModule } from '../product/product.module';
import { DatabaseModule } from '../database/database.module';
import { CartModule } from '../cart/cart.module';

@Module({
  imports: [ProductModule, DatabaseModule, CartModule],
  controllers: [OrderController],
  providers: [OrderService],
  exports: [OrderService],
})
export class OrderModule {}
