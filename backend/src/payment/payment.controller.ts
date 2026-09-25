import { Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { OwnershipOrAdminGuard } from '../auth/guards/ownership-or-admin.guard';
import { CheckOwnership } from '../auth/decorators/check-ownership.decorator';
import { Role } from '../../prisma/src/generated/prisma/enums';

import { PaymentService } from './provider/payment.service';

/**
 * No POST route here — a Payment only ever comes into existence via
 * OrderService.checkout()'s internal hook (see OrderPaymentHook). Same
 * pattern as PurchaseHistory having no create endpoint.
 *
 * @CheckOwnership('payment') requires the corresponding case in
 * OwnershipOrAdminGuard.resolveOwnership() — see chat for the snippet to
 * add, since that's your file and I'm not silently rewriting it.
 */
@ApiTags('payments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('payments')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Get(':id')
  @UseGuards(OwnershipOrAdminGuard)
  @CheckOwnership({ resource: 'payment' })
  findOne(@Param('id') id: string) {
    return this.paymentService.findOne(id);
  }

  // The remaining transitions are admin-only for now, same rationale as
  // Order's confirm/process/ship/deliver: there's no real payment gateway
  // webhook to trigger these automatically yet.

  @Patch(':id/process')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  process(@Param('id') id: string) {
    return this.paymentService.process(id);
  }

  @Patch(':id/complete')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  complete(@Param('id') id: string) {
    return this.paymentService.complete(id);
  }

  @Patch(':id/fail')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  fail(@Param('id') id: string) {
    return this.paymentService.fail(id);
  }

  @Patch(':id/cancel')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  cancel(@Param('id') id: string) {
    return this.paymentService.cancel(id);
  }

  @Patch(':id/refund')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  refund(@Param('id') id: string) {
    return this.paymentService.refund(id);
  }

  @Patch(':id/partially-refund')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  partiallyRefund(@Param('id') id: string) {
    return this.paymentService.partiallyRefunded(id);
  }
}
