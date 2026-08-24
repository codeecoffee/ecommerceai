import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../../database/providers/database.service';
import { CreateCategoryDto } from '../dto/create-category.dto';
import { CategoryResponseDto } from '../dto/response-category.dto';
import { CategoryMapper } from '../mapper/category.mapper';
import { CategoryQueryDto } from '../dto/get-category-query.dto';
import { PaginatedResponseDto } from '../../common/dto/response-paginated.dto';
import { Prisma } from '../../../prisma/src/generated/prisma/client';
import { CategoryTreeNodeDto } from '../dto/category-tree-node.dto';
import { UpdateCategoryDto } from '../dto/update-category.dto';

@Injectable()
export class CategoryService {
  constructor(private readonly dbService: DatabaseService) {}

  private async assertParentExists(parentCategoryId: string) {
    const parent = await this.dbService.category.findUnique({
      where: { category_id: parentCategoryId },
    });
    if (!parent) {
      throw new BadRequestException(
        `Parent category with id ${parentCategoryId} not found`,
      );
    }
  }

  private async assertNoCycle(categoryId: string, proposedParentId: string) {
    if (proposedParentId === categoryId) {
      throw new BadRequestException('A category cannot be its own parent');
    }
    let currentId: string | null = proposedParentId;
    const visited = new Set<string>();
    while (currentId) {
      if (currentId === categoryId) {
        throw new BadRequestException(
          'This change would create a circular category hierarchy',
        );
      }
      if (visited.has(currentId)) break;
      visited.add(currentId);
      const current: { parent_category_id: string | null } | null =
        await this.dbService.category.findUnique({
          where: { category_id: currentId },
          select: { parent_category_id: true },
        });
      currentId = current?.parent_category_id ?? null;
    }
  }

  public async create(dto: CreateCategoryDto): Promise<CategoryResponseDto> {
    if (dto.parentCategoryId)
      await this.assertParentExists(dto.parentCategoryId);
    const category = await this.dbService.category.create({
      data: CategoryMapper.toCreateInput(dto),
    });
    return CategoryMapper.toResponseDto(category);
  }

  public async findOne(id: string): Promise<CategoryResponseDto> {
    const category = await this.dbService.category.findUnique({
      where: { category_id: id },
    });
    if (!category)
      throw new NotFoundException(`Category with id ${id} not found`);
    return CategoryMapper.toResponseDto(category);
  }

  public async findAll(
    query: CategoryQueryDto,
  ): Promise<PaginatedResponseDto<CategoryResponseDto>> {
    const page: number = query.page ?? 1;
    const limit: number = query.limit ?? 20;

    const where: Prisma.CategoryWhereInput = {
      ...(query.topLevelOnly && { parent_category_id: null }),
      ...(query.parentCategoryId && {
        parent_category_id: query.parentCategoryId,
      }),
      ...(query.search && {
        name: { contains: query.search, mode: 'insensitive' },
      }),
    };
    const [data, total] = await this.dbService.$transaction([
      this.dbService.category.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { name: 'asc' },
      }),
      this.dbService.category.count({ where }),
    ]);
    return {
      data: data.map((category) => CategoryMapper.toResponseDto(category)),
      metadata: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  public async findTree(): Promise<CategoryTreeNodeDto[]> {
    const all = await this.dbService.category.findMany({
      orderBy: { name: 'asc' },
    });
    const nodes = new Map<string, CategoryTreeNodeDto>(
      all.map((c) => [
        c.category_id,
        { ...CategoryMapper.toResponseDto(c), children: [] },
      ]),
    );
    const roots: CategoryTreeNodeDto[] = [];
    for (const category of all) {
      const node = nodes.get(category.category_id)!;
      if (category.parent_category_id) {
        nodes.get(category.parent_category_id)?.children.push(node);
      } else {
        roots.push(node);
      }
    }
    return roots;
  }

  public async update(
    id: string,
    dto: UpdateCategoryDto,
  ): Promise<CategoryResponseDto> {
    if (dto.parentCategoryId) {
      await this.assertParentExists(dto.parentCategoryId);
      await this.assertNoCycle(id, dto.parentCategoryId);
    }

    try {
      const category = await this.dbService.category.update({
        where: { category_id: id },
        data: CategoryMapper.toUpdateInput(dto),
      });
      return CategoryMapper.toResponseDto(category);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException(`Category with id ${id} not found`);
      }
      throw error;
    }
  }

  public async remove(id: string): Promise<{ deleted: boolean }> {
    const [productCount, subCategoryCount] = await Promise.all([
      this.dbService.product.count({ where: { category_id: id } }),
      this.dbService.category.count({ where: { parent_category_id: id } }),
    ]);
    if (productCount > 0 || subCategoryCount > 0) {
      throw new ConflictException(
        `Cannot delete category: ${productCount} products and ${subCategoryCount} subcategories still reference it. Reassign or remove them first`,
      );
    }
    try {
      await this.dbService.category.delete({ where: { category_id: id } });
      return { deleted: true };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException(`Category with id ${id} not found`);
      }
      throw error;
    }
  }
}
