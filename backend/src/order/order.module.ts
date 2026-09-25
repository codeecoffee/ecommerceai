import { forwardRef, Module } from '@nestjs/common';
import { OrderService } from './provider/order.service';
import { OrderController } from './order.controller';
import { ProductModule } from '../product/product.module';
import { DatabaseModule } from '../database/database.module';
import { CartModule } from '../cart/cart.module';
import { PaymentModule } from '../payment/payment.module';

@Module({
  imports: [
    ProductModule,
    DatabaseModule,
    CartModule,
    forwardRef(() => PaymentModule),
  ],
  controllers: [OrderController],
  providers: [OrderService],
  exports: [OrderService],
})
export class OrderModule {}
