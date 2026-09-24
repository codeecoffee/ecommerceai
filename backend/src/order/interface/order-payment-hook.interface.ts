import { Prisma } from '../../../prisma/src/generated/prisma/client';

export interface OrderPaymentHook {
  createPaymentForOrder(
    params: { orderId: string; amount: number },
    tx: Prisma.TransactionClient,
  ): Promise<void>;
}
export const ORDER_PAYMENT_HOOK = Symbol('ORDER_PAYMENT_HOOK');
//TODO: When the payment module is built: implement this interface in PaymentService and provide it in PaymentModule as:
// { provide: ORDER_PAYMENT_HOOK, useExisting: PaymentService }
// have PaymentModule import OrderModule so Nest can wire the optional dependency.,
