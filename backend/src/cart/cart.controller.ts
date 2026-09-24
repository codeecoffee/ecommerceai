import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CartService } from './provider/cart.service';
import { CreateCartItemDto } from './dto/create-cartItem.dto';
import { UpdateCartItemDto } from './dto/update-cartItem.dto';

@ApiTags('cart')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  getCart(@CurrentUser() user: { id: string }) {
    return this.cartService.getCart(user.id);
  }

  @Post('items')
  addItem(@CurrentUser() user: { id: string }, @Body() dto: CreateCartItemDto) {
    return this.cartService.addItem(user.id, dto);
  }

  @Patch('items/:cartItemId')
  updateItem(
    @CurrentUser() user: { id: string },
    @Param('cartItemId') cartItemId: string,
    @Body() dto: UpdateCartItemDto,
  ) {
    return this.cartService.updateItemQuantity(user.id, cartItemId, dto);
  }

  @Delete('items/:cartItemId')
  removeItem(
    @CurrentUser() user: { id: string },
    @Param('cartItemId') cartItemId: string,
  ) {
    return this.cartService.removeItem(user.id, cartItemId);
  }

  @Delete()
  clearCart(@CurrentUser() user: { id: string }) {
    return this.cartService.clearCart(user.id);
  }
}
