import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { JwtUser } from 'src/auth/types/jwt-user.type';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { Roles } from 'src/common/decorators/roles.decorator';
import { OrderAllocationService } from 'src/order-allocation/services/order-allocation.service';
import { FranchiseProposalsQueryDto } from 'src/order-allocation/dto/franchise-proposals.query.dto';
import { RejectProposalDto } from 'src/order-allocation/dto/reject-proposal.dto';

@ApiTags('Franchise Proposals')
@ApiBearerAuth('access-token')
@Controller('franchise/proposals')
export class FranchiseProposalsController {
  constructor(
    private readonly orderAllocationService: OrderAllocationService,
  ) {}

  @Get()
  @Roles(
    Role.SUPERADMIN,
    Role.FRANCHISE_OWNER,
    Role.FRANCHISE_STAFF,
    Role.FRANCHISE_AUDITOR,
  )
  @ApiOperation({ summary: 'List proposals for the current franchise' })
  list(
    @CurrentUser() user: JwtUser,
    @Query() query: FranchiseProposalsQueryDto,
  ) {
    return this.orderAllocationService.listProposals({
      ...query,
      ...(user.role === Role.FRANCHISE_OWNER
        ? { franchiseId: user.franchiseId }
        : user.role === Role.FRANCHISE_STAFF
          ? { franchiseId: user.franchiseOwnerId }
          : {}),
    });
  }

  @Post(':id/accept')
  @Roles(Role.SUPERADMIN, Role.FRANCHISE_OWNER, Role.FRANCHISE_STAFF)
  @ApiOperation({ summary: 'Accept a franchise proposal' })
  accept(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.orderAllocationService.acceptProposal(id, user);
  }

  @Post(':id/reject')
  @Roles(Role.SUPERADMIN, Role.FRANCHISE_OWNER, Role.FRANCHISE_STAFF)
  @ApiOperation({ summary: 'Reject a franchise proposal' })
  reject(
    @Param('id') id: string,
    @CurrentUser() user: JwtUser,
    @Body() dto: RejectProposalDto,
  ) {
    return this.orderAllocationService.rejectProposal(id, user, dto.reason);
  }
}
