import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

export class UpdateCartItemDto {
  @ApiProperty({
    minimum: 1,
    description:
      'Sets the exact quantity for this line item. Use DELETE /cart/items/:id to remove it entirely instead of setting 0.',
  })
  @IsInt()
  @Min(1)
  quantity: number;
}
