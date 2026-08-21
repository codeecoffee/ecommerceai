import { CreateProductDto } from '../dto/create-product.dto';
import { Prisma, Product } from '../../../prisma/src/generated/prisma/client';
import { UpdateProductDto } from '../dto/update-product.dto';
import { ProductResponseDto } from '../dto/response-product.dto';

export class ProductMapper {
  static toCreateInput(dto: CreateProductDto): Prisma.ProductCreateInput {
    return {
      sku: dto.sku,
      name: dto.name,
      description: dto.description,
      photo_url: dto.photoUrl,
      price: dto.price,
      stock_qty: dto.stockQty,
      category: { connect: { category_id: dto.categoryId } },
    };
  }
  static toUpdateInput(dto: UpdateProductDto): Prisma.ProductUpdateInput {
    return {
      ...(dto.sku !== undefined && { sku: dto.sku }),
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.photoUrl !== undefined && { photo_url: dto.photoUrl }),
      ...(dto.price !== undefined && { price: dto.price }),
      ...(dto.stockQty !== undefined && { stock_qty: dto.stockQty }),
      ...(dto.categoryId !== undefined && {
        category: { connect: { category_id: dto.categoryId } },
      }),
    };
  }
  static toResponseDto(product: Product): ProductResponseDto {
    return {
      id: product.prod_id,
      sku: product.sku,
      name: product.name,
      description: product.description,
      photoUrl: product.photo_url,
      price: Number(product.price),
      stockQty: product.stock_qty,
      isActive: product.is_active,
      categoryId: product.category_id,
      createdAt: product.created_at,
      updatedAt: product.updated_at,
    };
  }
}
