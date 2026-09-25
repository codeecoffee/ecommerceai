export interface PaymentGateway {
  createAndConfirmPayment(params: {
    amountInCents: number;
    currency: string;
  }): Promise<{ transactionId: string; succeeded: boolean }>;
}
export const PAYMENT_GATEWAY = Symbol('PAYMENT_GATEWAY');
