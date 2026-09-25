import { forwardRef, Module } from '@nestjs/common';
import { PaymentService } from './provider/payment.service';
import { PaymentController } from './payment.controller';
import { DatabaseModule } from '../database/database.module';
import { OrderModule } from '../order/order.module';
import { ORDER_PAYMENT_HOOK } from '../order/interface/order-payment-hook.interface';

@Module({
  //Circular: OrderModule needs PaymentModule for ORDER_PAYMENT_HOOK,
  //PaymentModule needs OrderModule for OrderService (to call confirm/ cancel() from
  //PaymentService.complete()/fail()/cancel()
  imports: [DatabaseModule, forwardRef(() => OrderModule)],
  controllers: [PaymentController],
  providers: [
    PaymentService,
    // This is what wires PaymentService into OrderService's optional
    // @Inject(ORDER_PAYMENT_HOOK) — see order-payment-hook.interface.ts
    { provide: ORDER_PAYMENT_HOOK, useExisting: PaymentService },
  ],
})
export class PaymentModule {}
