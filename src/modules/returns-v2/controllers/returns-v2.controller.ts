import {
  Body,
  Controller,
  Get,
  Ip,
  Param,
  Patch,
  Post,
  Query,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Role, ReturnStatus } from '@prisma/client';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { JwtUser } from '../../../auth/types/jwt-user.type';
import {
  CreatePosReturnDto,
  CreateOnlineReturnDto,
  CreateStockReturnDto,
} from '../dto/create-return.dto';
import { UpdateRefundPreferenceDto } from '../dto/update-refund-preference.dto';
import {
  UpdateStatusDto,
  CompleteInspectionDto,
} from '../dto/update-status.dto';
import {
  ListReturnsQueryDto,
  WithoutReturnPaginationDto,
} from '../dto/list-returns-query.dto';
import { ListInventoryQueryDto } from '../dto/list-inventory-query.dto';
import { ReturnRequestService } from '../services/return-request.service';
import { ReturnWorkflowService } from '../services/return-workflow.service';

@ApiTags('Return Management V2')
@ApiBearerAuth('access-token')
@Controller('returns-v2')
export class ReturnsV2Controller {
  constructor(
    private readonly requestService: ReturnRequestService,
    private readonly workflowService: ReturnWorkflowService,
  ) {}

  @Post('pos')
  @ApiOperation({
    summary: 'Create a new POS/offline order return request (EXCHANGE only)',
  })
  @ApiCreatedResponse({
    description: 'POS return request initialized successfully',
  })
  @Roles(
    Role.SUPERADMIN,
    Role.ADMIN_STAFF,
    Role.FRANCHISE_OWNER,
    Role.FRANCHISE_STAFF,
  )
  async createPos(
    @Body() dto: CreatePosReturnDto,
    @CurrentUser() user: JwtUser,
    @Ip() ip: string,
  ) {
    return this.requestService.createPosReturn(dto, user, ip);
  }

  @Post('online')
  @ApiOperation({
    summary: 'Create a new Online order return request',
    description: `Allowed Roles: SUPERADMIN, ADMIN_STAFF, CUSTOMER.
    
    If returnType is REFUND, a refundReceivingSource is required and validated based on the payment mode of the original order:
    
    1. **ONLINE Prepaid Orders** (order.paymentMode = ONLINE and order.onlinePaymentStatus = PAID):
       - Allowed options: ORIGINAL_SOURCE (Default Recommended) or REWARDS.
       - Do NOT provide UPI or Bank details.
       - *Example Payload:*
         \`\`\`json
         {
           "orderNumber": "ORD123456",
           "returnType": "REFUND",
           "refundReceivingSource": "ORIGINAL_SOURCE",
           "items": [{ "productId": "prod_123", "requestedQty": 1 }]
         }
         \`\`\`
       
    2. **COD Orders** (order.paymentMode = COD):
       - Allowed options: UPI, BANK_TRANSFER, or REWARDS.
       - ORIGINAL_SOURCE is not selectable.
       - For UPI: Must provide flat 'upiId' field.
       - For BANK_TRANSFER: Must provide flat 'accountHolderName', 'bankName', 'accountNumber', 'ifscCode' fields.
       - *Example Payload (UPI):*
         \`\`\`json
         {
           "orderNumber": "ORD123456",
           "returnType": "REFUND",
           "refundReceivingSource": "UPI",
           "upiId": "customer@upi",
           "items": [{ "productId": "prod_123", "requestedQty": 1 }]
         }
         \`\`\`
       - *Example Payload (BANK_TRANSFER):*
         \`\`\`json
         {
           "orderNumber": "ORD123456",
           "returnType": "REFUND",
           "refundReceivingSource": "BANK_TRANSFER",
           "accountHolderName": "John Doe",
           "bankName": "HDFC Bank",
           "accountNumber": "1234567890",
           "ifscCode": "HDFC0001234",
           "items": [{ "productId": "prod_123", "requestedQty": 1 }]
         }
         \`\`\`
    `,
  })
  @ApiCreatedResponse({
    description: 'Online return request initialized successfully',
  })
  @Roles(Role.SUPERADMIN, Role.ADMIN_STAFF, Role.CUSTOMER)
  async createOnline(
    @Body() dto: CreateOnlineReturnDto,
    @CurrentUser() user: JwtUser,
    @Ip() ip: string,
  ) {
    return this.requestService.createOnlineReturn(dto, user, ip);
  }

  @Post('stock-request')
  @ApiOperation({
    summary: 'Create a new Franchise stock return request (RETURN only)',
  })
  @ApiCreatedResponse({
    description: 'Franchise stock return request initialized successfully',
  })
  @Roles(
    Role.SUPERADMIN,
    Role.ADMIN_STAFF,
    Role.FRANCHISE_OWNER,
    Role.FRANCHISE_STAFF,
  )
  async createStockRequest(
    @Body() dto: CreateStockReturnDto,
    @CurrentUser() user: JwtUser,
    @Ip() ip: string,
  ) {
    return this.requestService.createStockReturn(dto, user, ip);
  }

  @Patch(':id/status')
  @ApiOperation({
    summary:
      'Advance the return request state (Common transitions: APPROVED, REJECTED, PICKUP_SCHEDULED, PICKUP_COMPLETED, RECEIVED_AT_FRANCHISE, IN_TRANSIT_TO_WAREHOUSE, RECEIVED_AT_WAREHOUSE, UNDER_INSPECTION, REFUND_PROCESSED, EXCHANGE_ORDER_CREATED, CLOSED)',
    description: `Allowed Roles: SUPERADMIN, ADMIN_STAFF, FRANCHISE_OWNER, FRANCHISE_STAFF.
    
    Workflows:
    - Customer Online Return: REQUESTED -> APPROVED -> PICKUP_SCHEDULED -> PICKUP_COMPLETED -> RECEIVED_AT_FRANCHISE -> UNDER_INSPECTION -> (calls /complete-inspection) -> REFUND_PROCESSED/EXCHANGE_ORDER_CREATED -> CLOSED
    - Franchise Stock Return: REQUESTED -> APPROVED -> IN_TRANSIT_TO_WAREHOUSE -> RECEIVED_AT_WAREHOUSE -> UNDER_INSPECTION -> (calls /complete-inspection) -> CLOSED
    
    Inventory & Evidence Effects:
    - PICKUP_COMPLETED: Uploads and records PICKUP_PROOF media images.
    - RECEIVED_AT_FRANCHISE: Uploads and records RECEIVING_PROOF media, stages items in ReturnInventory (status PENDING_QC), logs CUSTOMER_TO_RETURN movement.
    - RECEIVED_AT_WAREHOUSE: Uploads and records RECEIVING_PROOF media, stages items in ReturnInventory (status PENDING_QC), logs FRANCHISE_TO_RETURN movement.
    - EXCHANGE_ORDER_CREATED: Validates and deducts exchange stock (FRANCHISE_TO_CUSTOMER) if not already deducted.
    
    {
      "status": "RECEIVED_AT_FRANCHISE",
      "remarks": "Received at central warehouse",
      "images": [
        "https://your-storage-bucket.com/evidence/image_of_received_package.jpg"
      ]
    }
    `,
  })
  @ApiOkResponse({
    description: 'Status updated and workflows processed successfully',
  })
  @Roles(
    Role.SUPERADMIN,
    Role.ADMIN_STAFF,
    Role.FRANCHISE_OWNER,
    Role.FRANCHISE_STAFF,
  )
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateStatusDto,
    @CurrentUser() user: JwtUser,
    @Ip() ip: string,
  ) {
    if (
      dto.status === ReturnStatus.QC_PASSED ||
      dto.status === ReturnStatus.QC_FAILED ||
      dto.status === ReturnStatus.QC_CONFLICT
    ) {
      throw new BadRequestException(
        `QC inspection outcome statuses (${dto.status}) are not allowed on this endpoint. Please call the '/returns-v2/:id/complete-inspection' endpoint to complete inspection and submit item condition assessments.`,
      );
    }
    return this.workflowService.handleStatusTransition(id, dto, user, ip);
  }

  @Patch(':id/complete-inspection')
  @ApiOperation({
    summary:
      'Step 4: Complete QC inspection and submit assessment results per item (Transition: UNDER_INSPECTION -> QC_PASSED / QC_FAILED / QC_CONFLICT)',
    description: `Allowed Roles: SUPERADMIN, ADMIN_STAFF, FRANCHISE_OWNER, FRANCHISE_STAFF.
    
    Assesses items and processes inventory adjustments from ReturnInventory (status PENDING_QC):
    - GOOD condition:
      * Customer Return: Moves stock to FranchiseStock. Logs RETURN_TO_FRANCHISE movement.
      * Stock Request Return: Moves stock to WarehouseStock and base Product/Variant stocks. Logs RETURN_TO_WAREHOUSE movement.
    - DEFECTIVE condition: Isolate items in DefectiveInventory. Logs RETURN_TO_DEFECTIVE movement.
    - CONFLICT condition: Isolate items in BlockedInventory. Logs RETURN_TO_BLOCKED movement.
    
    Evidence Effects:
    - QC_PROOF media images recorded.`,
  })
  @ApiOkResponse({ description: 'Inspection completed successfully' })
  @Roles(
    Role.SUPERADMIN,
    Role.ADMIN_STAFF,
    Role.FRANCHISE_OWNER,
    Role.FRANCHISE_STAFF,
  )
  async completeInspection(
    @Param('id') id: string,
    @Body() dto: CompleteInspectionDto,
    @CurrentUser() user: JwtUser,
    @Ip() ip: string,
  ) {
    return this.workflowService.handleStatusTransition(
      id,
      {
        status: dto.status,
        remarks: dto.remarks,
        items: dto.items,
        images: dto.images,
      },
      user,
      ip,
    );
  }

  @Get()
  @ApiOperation({
    summary:
      'List V2 returns with pagination, filtering, sorting, and text queries',
  })
  @ApiOkResponse({ description: 'Returns fetched successfully' })
  @Roles(
    Role.SUPERADMIN,
    Role.ADMIN_STAFF,
    Role.FRANCHISE_OWNER,
    Role.FRANCHISE_STAFF,
    Role.CUSTOMER,
  )
  async list(
    @Query() query: ListReturnsQueryDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.requestService.list(query, user);
  }

  @Get('inventory/list')
  @ApiOperation({
    summary:
      'List defective and blocked inventory with pagination, filtering, sorting, and text queries',
  })
  @ApiOkResponse({ description: 'Inventory list fetched successfully' })
  @Roles(
    Role.SUPERADMIN,
    Role.ADMIN_STAFF,
    Role.FRANCHISE_OWNER,
    Role.FRANCHISE_STAFF,
  )
  async listInventory(
    @Query() query: ListInventoryQueryDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.requestService.listInventory(query, user);
  }

  @Get('list/all')
  @ApiOperation({
    summary:
      'List V2 returns without pagination, including overall and franchise-wise metrics in meta',
  })
  @ApiOkResponse({ description: 'Returns fetched successfully' })
  @Roles(
    Role.SUPERADMIN,
    Role.ADMIN_STAFF,
    Role.FRANCHISE_OWNER,
    Role.FRANCHISE_STAFF,
    Role.CUSTOMER,
  )
  async listAll(
    @Query() query: WithoutReturnPaginationDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.requestService.listAll(query, user);
  }

  @Get(':returnNumber')
  @ApiOperation({
    summary: 'Get details of a specific return request by return number',
  })
  @ApiOkResponse({ description: 'Return details retrieved successfully' })
  @Roles(
    Role.SUPERADMIN,
    Role.ADMIN_STAFF,
    Role.FRANCHISE_OWNER,
    Role.FRANCHISE_STAFF,
    Role.CUSTOMER,
  )
  async findOne(
    @Param('returnNumber') returnNumber: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.requestService.findOne(returnNumber, user);
  }

  @Patch(':id/refund-preference')
  @ApiOperation({
    summary:
      'Explicitly update the refund preference of a return request (Admin/Superadmin only)',
  })
  @ApiOkResponse({ description: 'Refund preference updated successfully' })
  @Roles(Role.SUPERADMIN, Role.ADMIN_STAFF)
  async updateRefundPreference(
    @Param('id') id: string,
    @Body() dto: UpdateRefundPreferenceDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.requestService.updateRefundPreference(id, dto, user);
  }
}
