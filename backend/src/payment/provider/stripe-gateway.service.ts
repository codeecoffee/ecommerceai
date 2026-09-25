import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { PaymentGateway } from '../interfaces/payment-gateway.interface';

@Injectable()
export class StripeGatewayService implements PaymentGateway {
  private readonly stripe: Stripe;
  private readonly testPaymentMethodId: string;

  constructor(private readonly configService: ConfigService) {
    const secretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (!secretKey) {
      throw new Error('STRIPE_SECRET_KEY is not set');
    }
    // This service auto-confirms every payment with a hardcoded Stripe TEST
    // payment method (see below) — that only works against a test-mode
    // key. Refusing to boot with a live key here is a deliberate guardrail,
    // not paranoia: this flow does not collect a real card from a real
    // person, so it must never run against a live account.
    if (!secretKey.startsWith('sk_test_')) {
      throw new Error(
        'StripeGatewayService requires a TEST secret key (sk_test_...) — ' +
          'refusing to start with what looks like a live key while the ' +
          'dev auto-confirm flow is wired in.',
      );
    }

    // Pin this to whatever API version your installed `stripe` package
    // expects (check node_modules/stripe/package.json or the Stripe
    // dashboard) — omitting it just means "use the account's default",
    // which can silently change later.
    this.stripe = new Stripe(secretKey);

    this.testPaymentMethodId = this.configService.get<string>(
      'STRIPE_TEST_PAYMENT_METHOD_ID',
      'pm_card_visa',
    );
  }

  async createAndConfirmPayment(params: {
    amountInCents: number;
    currency: string;
  }) {
    const intent = await this.stripe.paymentIntents.create({
      amount: params.amountInCents,
      currency: params.currency,
      payment_method: this.testPaymentMethodId,
      payment_method_types: ['card'],
      confirm: true,
    });

    return {
      transactionId: intent.id,
      succeeded: intent.status === 'succeeded',
    };
  }
}
