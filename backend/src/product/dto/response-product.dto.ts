import { ApiProperty } from '@nestjs/swagger';

export class ProductResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() sku: string;
  @ApiProperty() name: string;
  @ApiProperty() description: string;
  @ApiProperty({ nullable: true }) photoUrl: string | null;
  @ApiProperty() price: number;
  @ApiProperty() stockQty: number;
  @ApiProperty() isActive: boolean;
  @ApiProperty() categoryId: string;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;
}
