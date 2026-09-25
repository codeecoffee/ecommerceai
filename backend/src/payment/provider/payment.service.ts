import { PaymentStatus } from '../../../prisma/src/generated/prisma/enums';
import {
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrderPaymentHook } from '../../order/interface/order-payment-hook.interface';
import { DatabaseService } from '../../database/providers/database.service';
import { OrderService } from '../../order/provider/order.service';
import { Prisma } from '@prisma/client/extension';
import { PaymentResponseDto } from '../dto/response-payment.dto';
import { PaymentMapper } from '../mappers/payment.mapper';

const PAYMENT_STATE_TRANSITIONS: Record<PaymentStatus, PaymentStatus[]> = {
  [PaymentStatus.PENDING]: [
    PaymentStatus.PROCESSING,
    PaymentStatus.FAILED,
    PaymentStatus.CANCELLED,
  ],
  [PaymentStatus.PROCESSING]: [
    PaymentStatus.COMPLETED,
    PaymentStatus.FAILED,
    PaymentStatus.CANCELLED,
  ],
  [PaymentStatus.COMPLETED]: [
    PaymentStatus.REFUNDED,
    PaymentStatus.PARTIALLY_REFUNDED,
  ],
  [PaymentStatus.PARTIALLY_REFUNDED]: [PaymentStatus.REFUNDED],
  [PaymentStatus.FAILED]: [],
  [PaymentStatus.CANCELLED]: [],
  [PaymentStatus.REFUNDED]: [],
};

@Injectable()
export class PaymentService implements OrderPaymentHook {
  constructor(
    private readonly dbservice: DatabaseService,
    @Inject(forwardRef(() => OrderService))
    private readonly orderService: OrderService,
  ) {}

  async createPaymentForOrder(
    params: { orderId: string; amount: number },
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    await tx.payment.create({
      data: {
        order_id: params.orderId,
        amount: params.amount,
        status: PaymentStatus.PENDING,
      },
    });
  }

  async findOne(paymentId: string): Promise<PaymentResponseDto> {
    const payment = await this.dbservice.payment.findUnique({
      where: { payment_id: paymentId },
    });
    if (!payment) {
      throw new NotFoundException('Payment does not exist');
    }
    return PaymentMapper.toResponseDto(payment);
  }

  process(paymentId: string) {
    return this.transition(paymentId, PaymentStatus.PROCESSING);
  }

  async complete(paymentId: string): Promise<PaymentResponseDto> {
    const result = await this.transition(paymentId, PaymentStatus.COMPLETED);
    await this.orderService.confirm(result.orderId);
    return result;
  }

  async fail(paymentId: string): Promise<PaymentResponseDto> {
    const result = await this.transition(paymentId, PaymentStatus.FAILED);
    await this.orderService.cancel(result.orderId);
    return result;
  }

  async cancel(paymentId: string): Promise<PaymentResponseDto> {
    const result = await this.transition(paymentId, PaymentStatus.CANCELLED);
    await this.orderService.cancel(result.orderId);
    return result;
  }
  refund(paymentId: string) {
    return this.transition(paymentId, PaymentStatus.REFUNDED);
  }
  partiallyRefunded(paymentId: string) {
    return this.transition(paymentId, PaymentStatus.PARTIALLY_REFUNDED);
  }

  private async transition(
    paymentId: string,
    target: PaymentStatus,
  ): Promise<PaymentResponseDto> {
    const payment = await this.dbservice.$transaction(async (tx) => {
      const existing = await tx.payment.findUnique({
        where: { payment_id: paymentId },
      });
      if (!existing) throw new NotFoundException('Payment does not exist');
      const allowed = PAYMENT_STATE_TRANSITIONS[existing.status];
      if (!allowed.includes(target))
        throw new NotFoundException(
          `Cannot move payment from ${existing.status} to ${target}`,
        );

      return tx.payment.update({
        where: { payment_id: paymentId },
        data: { status: target },
      });
    });

    return PaymentMapper.toResponseDto(payment);
  }
}
