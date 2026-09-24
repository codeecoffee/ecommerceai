import { ApiProperty } from '@nestjs/swagger';
import { CartItemResponseDto } from './response-cartItem.dto';
import { Status as CartStatus } from '../../../prisma/src/generated/prisma/client';

export class CartResponseDto {
  @ApiProperty({
    nullable: true,
    description:
      'null when the user has no ACTIVE cart yet — none is created until the first item is added (lazy creation).',
  })
  cartId: string | null;

  @ApiProperty({ enum: CartStatus, nullable: true })
  status: CartStatus | null;

  @ApiProperty({ type: [CartItemResponseDto] })
  items: CartItemResponseDto[];

  @ApiProperty()
  total: number;
}
