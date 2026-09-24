import {
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { OwnershipOrAdminGuard } from '../auth/guards/ownership-or-admin.guard';
import { CheckOwnership } from '../auth/decorators/check-ownership.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Role } from '../../prisma/src/generated/prisma/client';

import { OrderService } from './provider/order.service';
import { OrderQueryDto } from './dto/get-orders-query.dto';

@ApiTags('orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('orders')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  /** Checkout — converts the caller's own ACTIVE cart into an Order. */
  @Post()
  checkout(@CurrentUser() user: { id: string }) {
    return this.orderService.checkout(user.id);
  }

  /** Own orders only (BR-ORDER-04). */
  @Get()
  findMine(@CurrentUser() user: { id: string }, @Query() query: OrderQueryDto) {
    return this.orderService.findAllForUser(user.id, query);
  }

  /**
   * All orders, admin only. Declared BEFORE `:id` so "admin" is never
   * captured as an order id — same pattern as GET /products/admin.
   */
  @Get('admin')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  findAllAdmin(@Query() query: OrderQueryDto) {
    return this.orderService.findAllAdmin(query);
  }

  @Get(':id')
  @UseGuards(OwnershipOrAdminGuard)
  @CheckOwnership({ resource: 'order', paramName: 'user_id' })
  findOne(@Param('id') id: string) {
    return this.orderService.findOne(id);
  }

  @Patch(':id/confirm')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  confirm(@Param('id') id: string) {
    return this.orderService.confirm(id);
  }

  @Patch(':id/process')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  process(@Param('id') id: string) {
    return this.orderService.process(id);
  }

  @Patch(':id/ship')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  ship(@Param('id') id: string) {
    return this.orderService.ship(id);
  }

  @Patch(':id/deliver')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  deliver(@Param('id') id: string) {
    return this.orderService.deliver(id);
  }

  /** Owner may cancel their own order; admin may cancel any. */
  @Patch(':id/cancel')
  @UseGuards(OwnershipOrAdminGuard)
  @CheckOwnership({ resource: 'order', paramName: 'user_id' })
  cancel(@Param('id') id: string) {
    return this.orderService.cancel(id);
  }

  @Patch(':id/refund')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  refund(@Param('id') id: string) {
    return this.orderService.refund(id);
  }
}
