import { Category, Prisma } from '../../../prisma/src/generated/prisma/client';
import { CreateCategoryDto } from '../dto/create-category.dto';
import { UpdateCategoryDto } from '../dto/update-category.dto';
import { CategoryResponseDto } from '../dto/response-category.dto';

export class CategoryMapper {
  static toCreateInput(dto: CreateCategoryDto): Prisma.CategoryCreateInput {
    return {
      name: dto.name,
      description: dto.description,
      ...(dto.parentCategoryId && {
        parent: { connect: { category_id: dto.parentCategoryId } },
      }),
    };
  }

  static toUpdateInput(dto: UpdateCategoryDto): Prisma.CategoryUpdateInput {
    return {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.parentCategoryId !== undefined && {
        parent: dto.parentCategoryId
          ? { connect: { category_id: dto.parentCategoryId } }
          : { disconnect: true },
      }),
    };
  }

  static toResponseDto(category: Category): CategoryResponseDto {
    return {
      id: category.category_id,
      name: category.name,
      description: category.description,
      parentCategoryId: category.parent_category_id,
    };
  }
}
