import { PaymentGateway } from '../interfaces/payment-gateway.interface';

/**
 * Test double for PaymentGateway. Used by unit tests directly, and by e2e
 * tests via `.overrideProvider(PAYMENT_GATEWAY).useValue(...)` so that
 * running the test suite never makes a real network call to Stripe.
 *
 * `nextResult` defaults to a successful payment; set it before a call to
 * simulate a decline, and reset it back afterward (or construct a fresh
 * instance per test) so one test's override doesn't leak into the next.
 */
export class FakePaymentGateway implements PaymentGateway {
  public nextResult: { transactionId: string; succeeded: boolean } = {
    transactionId: 'fake_pi_succeeded',
    succeeded: true,
  };

  public calls: Array<{ amountInCents: number; currency: string }> = [];

  createAndConfirmPayment(params: {
    amountInCents: number;
    currency: string;
  }) {
    this.calls.push(params);
    return Promise.resolve(this.nextResult);
  }
}
