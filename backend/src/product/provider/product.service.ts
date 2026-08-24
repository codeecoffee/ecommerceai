import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
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
      throw err;
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

  public async findOne(id: string): Promise<ProductResponseDto> {
    const product = await this.dbService.product.findUnique({
      where: { prod_id: id },
    });
    if (!product)
      throw new NotFoundException(`Product with id ${id} not found`);
    return ProductMapper.toResponseDto(product);
  }

  public async update(
    id: string,
    dto: UpdateProductDto,
  ): Promise<ProductResponseDto> {
    if (dto.categoryId) await this.assertCategoryExists(dto.categoryId);

    try {
      const product = await this.dbService.product.update({
        where: { prod_id: id },
        data: ProductMapper.toUpdateInput(dto),
      });
      return ProductMapper.toResponseDto(product);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError) {
        if (err.code == 'P2025')
          throw new NotFoundException(`Product with id ${id} not found`);
        if (err.code == 'P2002')
          throw new ConflictException(`SKU ${dto.sku} already exists`);
      }
      throw err;
    }
  }

  public async adjustStock(
    prodId: string,
    delta: number,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const client = tx ?? this.dbService;
    const result = await client.product.updateMany({
      where: {
        prod_id: prodId,
        ...(delta < 0 && { stock_qty: { gte: -delta } }),
      },
      data: { stock_qty: { increment: delta } },
    });
    if (result.count === 0) {
      throw new ConflictException(
        delta < 0
          ? `Insufficient stock for product ${prodId}`
          : `Product ${prodId} not found`,
      );
    }
  }

  public async remove(id: string): Promise<{ deleted: boolean }> {
    return this.dbService.$transaction(async (tx) => {
      const product = await tx.product.update({
        where: { prod_id: id },
        data: { is_active: false },
      });
      const [orderItemCount, cartItemCount, purchaseHistCount] =
        await Promise.all([
          tx.order_item.count({ where: { prod_id: product.prod_id } }),
          tx.cart_item.count({ where: { prod_id: product.prod_id } }),
          tx.purchase_history.count({ where: { prod_id: product.prod_id } }),
        ]);
      if (
        orderItemCount == 0 &&
        cartItemCount === 0 &&
        purchaseHistCount === 0
      ) {
        await tx.product.delete({ where: { prod_id: product.prod_id } });
        return { deleted: true };
      }
      return { deleted: false };
    });
  }
}
