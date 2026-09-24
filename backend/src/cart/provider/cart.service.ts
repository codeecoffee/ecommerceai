import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../../database/providers/database.service';
import { CartResponseDto } from '../dto/response-cart.dto';
import { CartMapper } from '../mapper/cart.mapper';
import { CreateCartItemDto } from '../dto/create-cartItem.dto';
import { UpdateCartItemDto } from '../dto/update-cartItem.dto';
import type { Prisma } from '../../../prisma/src/generated/prisma/client';

@Injectable()
export class CartService {
  constructor(private readonly databaseService: DatabaseService) {}

  public async getCart(userId: string): Promise<CartResponseDto> {
    const cart = await this.databaseService.cart.findFirst({
      where: { user_id: userId, status: 'ACTIVE' },
      include: { cart_items: true },
    });
    return CartMapper.toResponseDto(cart);
  }

  public async addItem(
    userId: string,
    dto: CreateCartItemDto,
  ): Promise<CartResponseDto> {
    const cart = await this.databaseService.$transaction(async (tx) => {
      const product = await tx.product.findUnique({
        where: { prod_id: dto.productId },
      });
      if (!product || !(product as any).is_active) {
        throw new NotFoundException('Product not found');
      }

      let activeCart = await tx.cart.findFirst({
        where: { user_id: userId, status: 'ACTIVE' },
      });
      if (!activeCart) {
        activeCart = await tx.cart.create({
          data: { user_id: userId, status: 'ACTIVE' },
        });
      }
      const existingItem = await tx.cart_item.findFirst({
        where: { cart_id: activeCart.cart_id, prod_id: dto.productId },
      });

      const targetQuantity = (existingItem?.quantity ?? 0) + dto.quantity;

      if (targetQuantity > product.stock_qty) {
        throw new BadRequestException(
          `Only ${product.stock_qty} of this item in stock`,
        );
      }

      const currentPrice = Number(product.price);

      if (existingItem) {
        await tx.cart_item.update({
          where: { cart_item_id: existingItem.cart_item_id },
          data: { quantity: targetQuantity, price_at_add: currentPrice },
        });
      } else {
        await tx.cart_item.create({
          data: {
            cart_id: activeCart.cart_id,
            prod_id: dto.productId,
            quantity: dto.quantity,
            price_at_add: currentPrice,
          },
        });
      }
      return tx.cart.findUniqueOrThrow({
        where: { cart_id: activeCart.cart_id },
        include: { cart_items: true },
      });
    });
    return CartMapper.toResponseDto(cart);
  }

  public async updateItemQuantity(
    userId: string,
    cartItemId: string,
    dto: UpdateCartItemDto,
  ): Promise<CartResponseDto> {
    const cart = await this.databaseService.$transaction(async (tx) => {
      const item = await tx.cart_item.findUnique({
        where: { cart_item_id: cartItemId },
        include: { cart: true },
      });
      if (!item) {
        throw new NotFoundException('Cart item not found');
      }
      if (item.cart.user_id !== userId) {
        throw new ForbiddenException('This cart item does not belong to you');
      }

      const product = await tx.product.findUniqueOrThrow({
        where: { prod_id: item.prod_id },
      });
      if (dto.quantity > product.stock_qty) {
        throw new BadRequestException(
          `Only ${product.stock_qty} of this item in stock`,
        );
      }

      await tx.cart_item.update({
        where: { cart_item_id: cartItemId },
        data: { quantity: dto.quantity },
      });

      return tx.cart.findUniqueOrThrow({
        where: { cart_id: cartItemId },
        include: { cart_items: true },
      });
    });
    return CartMapper.toResponseDto(cart);
  }

  public async removeItem(
    userId: string,
    cartItemId: string,
  ): Promise<CartResponseDto> {
    const cart = await this.databaseService.$transaction(async (tx) => {
      const item = await tx.cart_item.findUnique({
        where: { cart_item_id: cartItemId },
        include: { cart: true },
      });
      if (!item) {
        throw new NotFoundException('Cart item not found');
      }
      if (item.cart.user_id !== userId) {
        throw new ForbiddenException('This cart item does not belong to you');
      }
      await tx.cart_item.delete({ where: { cart_item_id: cartItemId } });

      return tx.cart.findUniqueOrThrow({
        where: { cart_id: cartItemId },
        include: { cart_items: true },
      });
    });
    return CartMapper.toResponseDto(cart);
  }

  public async clearCart(userId: string): Promise<{ deleted: boolean }> {
    const cart = await this.databaseService.cart.findFirst({
      where: { user_id: userId, status: 'ACTIVE' },
    });
    if (!cart) {
      return { deleted: false };
    }
    await this.databaseService.cart_item.deleteMany({
      where: { cart_id: cart.cart_id },
    });
    return { deleted: true };
  }

  async markConverted(cartId: string, tx?: Prisma.TransactionClient) {
    const client = tx ?? this.databaseService;
    return client.cart.update({
      where: { cart_id: cartId },
      data: { status: 'ACTIVE' },
    });
  }

  async findActiveCartWithItems(userId: string, tx?: Prisma.TransactionClient) {
    const client = tx ?? this.databaseService;
    return client.cart.findFirst({
      where: { user_id: userId, status: 'ACTIVE' },
      include: { cart_items: true },
    });
  }
}
