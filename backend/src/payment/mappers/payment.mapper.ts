import { Payment } from '../../../prisma/src/generated/prisma/client';
import { PaymentResponseDto } from '../dto/response-payment.dto';

export class PaymentMapper {
  static toResponseDto(payment: Payment): PaymentResponseDto {
    return {
      paymentId: payment.payment_id,
      orderId: payment.order_id,
      status: payment.status,
      amount: Number(payment.amount),
      provider: payment.provider,
      transactionId: payment.transaction_id,
      createdAt: payment.created_at,
      updatedAt: payment.updated_at,
    };
  }
}
