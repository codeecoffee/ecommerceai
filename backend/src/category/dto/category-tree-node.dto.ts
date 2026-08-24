import { CategoryResponseDto } from './response-category.dto';
import { ApiProperty } from '@nestjs/swagger';

export class CategoryTreeNodeDto extends CategoryResponseDto {
  @ApiProperty({ type: () => [CategoryTreeNodeDto] })
  children: CategoryTreeNodeDto[];
}
