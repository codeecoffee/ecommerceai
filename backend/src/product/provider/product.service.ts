import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { CreateProductDto } from '../dto/create-product.dto';
import { UpdateProductDto } from '../dto/update-product.dto';
import { DatabaseService } from '../../database/providers/database.service';
import { ProductResponseDto } from '../dto/response-product.dto';
import { ProductMapper } from '../mapper/product.mapper';
import { Prisma } from '../../../prisma/src/generated/prisma/client';
import { ProductQueryDto } from '../dto/get-product-query.dto';
import { PaginatedResponseDto } from '../../common/dto/response-paginated.dto';

@Injectable()
export class ProductService {
  constructor(private readonly dbService: DatabaseService) {}

  private async assertCategoryExists(categoryId: string) {
    const category = await this.dbService.category.findUnique({
      where: { category_id: categoryId },
    });
    if (!category) {
      throw new BadRequestException(`Category with id ${categoryId} not found`);
    }
  }

  public async create(dto: CreateProductDto): Promise<ProductResponseDto> {
    await this.assertCategoryExists(dto.categoryId);

    try {
      const product = await this.dbService.product.create({
        data: ProductMapper.toCreateInput(dto),
      });
      return ProductMapper.toResponseDto(product);
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException(`SKU ${dto.sku} already exists`);
      }
    }
  }

  public async findAll(
    query: ProductQueryDto,
    { includeInactive = false }: { includeInactive?: boolean } = {},
  ): Promise<PaginatedResponseDto<ProductResponseDto>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.ProductWhereInput = {
      ...(!includeInactive && { is_active: true }),
      ...(query.categoryId && { category_id: query.categoryId }),
      ...(query.search && {
        name: { contains: query.search, mode: 'insensitive' },
      }),
      ...((query.minPrice !== undefined || query.maxPrice !== undefined) && {
        price: {
          ...(query.minPrice !== undefined && { gte: query.minPrice }),
          ...(query.maxPrice !== undefined && { lte: query.maxPrice }),
        },
      }),
    };
    const [data, total] = await this.dbService.$transaction([
      this.dbService.product.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
      this.dbService.product.count({ where }),
    ]);

    return {
      data: data.map((product) => ProductMapper.toResponseDto(product)),
      metadata: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  findOne(id: number) {
    return `This action returns a #${id} product`;
  }

  update(id: number, updateProductDto: UpdateProductDto) {
    return `This action updates a #${id} product`;
  }

  remove(id: number) {
    return `This action removes a #${id} product`;
  }
}
