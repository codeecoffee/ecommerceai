import { forwardRef, Module } from '@nestjs/common';
import { PaymentService } from './provider/payment.service';
import { PaymentController } from './payment.controller';
import { DatabaseModule } from '../database/database.module';
import { OrderModule } from '../order/order.module';
import { ORDER_PAYMENT_HOOK } from '../order/interface/order-payment-hook.interface';
import { ConfigModule } from '@nestjs/config';
import { PAYMENT_GATEWAY } from './interfaces/payment-gateway.interface';
import { StripeGatewayService } from './provider/stripe-gateway.service';

@Module({
  //Circular: OrderModule needs PaymentModule for ORDER_PAYMENT_HOOK,
  //PaymentModule needs OrderModule for OrderService (to call confirm/ cancel() from
  //PaymentService.complete()/fail()/cancel()
  imports: [DatabaseModule, ConfigModule, forwardRef(() => OrderModule)],
  controllers: [PaymentController],
  providers: [
    PaymentService,
    StripeGatewayService,
    { provide: ORDER_PAYMENT_HOOK, useExisting: PaymentService },
    { provide: PAYMENT_GATEWAY, useExisting: StripeGatewayService },
  ],
  exports: [PaymentService, ORDER_PAYMENT_HOOK],
})
export class PaymentModule {}
