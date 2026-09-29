import { ApiProperty } from '@nestjs/swagger';
import { PaymentStatus } from '../../generated/prisma/client';

export class PaymentResponseDto {
  @ApiProperty()
  paymentId: string;

  @ApiProperty()
  orderId: string;

  @ApiProperty({ enum: PaymentStatus })
  status: PaymentStatus;

  @ApiProperty({
    description: 'Snapshotted from Order.total at authorization time.',
  })
  amount: number;

  @ApiProperty({
    nullable: true,
    description:
      'Populated once a real payment gateway is wired up; null until then.',
  })
  provider: string | null;

  @ApiProperty({ nullable: true })
  transactionId: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
