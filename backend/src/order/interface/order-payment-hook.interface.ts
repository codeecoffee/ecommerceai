import { Prisma } from '../../generated/prisma/client';

/**
 * Extension point for the not-yet-built Payment module.
 *
 * OrderService.checkout() runs entirely inside a single prisma.$transaction
 * (inventory decrement + order/order-item creation, per BR-ORDER-05). If a
 * provider for ORDER_PAYMENT_HOOK is registered, checkout() calls it with
 * the *same* transaction client, so a payment failure rolls back the whole
 * checkout along with everything else. Today nothing registers this token,
 * so the call is skipped — see OrderService.checkout().
 *
 * When the Payment module is built: implement this interface in
 * PaymentService (or a small adapter), and provide it in PaymentModule as:
 *
 *   { provide: ORDER_PAYMENT_HOOK, useExisting: PaymentService }
 *
 * Then have PaymentModule import OrderModule (or vice versa via a shared
 * module) so Nest can wire the optional dependency.
 */
export interface OrderPaymentHook {
  /**
   * Called inside the checkout transaction immediately after the Order row
   * is created. Must create the Payment record scoped to `tx` — never open
   * a second, unscoped write here, or BR-ORDER-05's atomicity guarantee is
   * broken.
   */
  createPaymentForOrder(
    params: { orderId: string; amount: number },
    tx: Prisma.TransactionClient,
  ): Promise<void>;

  /**
   * Called by OrderService.checkout() AFTER the checkout transaction has
   * already committed successfully. This is where any external gateway
   * call belongs — it can never run inside the transaction above (see the
   * NFR in project_specs.md section 10: external calls must never hold a
   * transaction/row-lock open).
   *
   * A failure here does NOT roll back the order/payment rows that already
   * committed — checkout has already succeeded from the client's point of
   * view by this point. OrderService catches and logs errors from this
   * method rather than rethrowing them, leaving the Payment row in
   * whatever state the hook's own implementation left it for a later retry.
   *
   * Optional so a hook implementation that doesn't need a real gateway
   * (or the pre-Stripe version of this file) isn't forced to implement it.
   */
  afterCheckoutCommitted?(orderId: string): Promise<void>;
}

export const ORDER_PAYMENT_HOOK = Symbol('ORDER_PAYMENT_HOOK');
