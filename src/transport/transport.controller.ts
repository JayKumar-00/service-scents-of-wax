import {
  Body,
  Controller,
  Get,
  Ip,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { ShiprocketService } from './shiprocket.service';
import { ListCouriersQueryDto } from './dto/list-query.dto';
import { ServiceabilityQueryDto } from './dto/serviceability-query.dto';
import { CreateForwardShipmentDto } from './dto/forward.dto';
import { QuickReturnDto } from './dto/quick-return.dto';
import { CreateReturnOrderDto } from './dto/return-order.dto';
import { UpdateReturnOrderDto } from './dto/update-return-order.dto';
import {
  AddPickupLocationPayload,
  AssignShipmentPayload,
  GenerateInvoicePayload,
  GenerateLabelPayload,
  GeneratePickupPayload,
  TransportShipmentOrderIDPayload,
  TransportShipmentOrderIDResult,
} from './interfaces/shiprocket.interface';
import { UpdatePickupDto } from './dto/update-pickup.dto';
import { UpdateDeliveryLocationDto } from './dto/update-delivery-location.dto';
import { UpdateShipmentOrderDto } from './dto/update-shipment.dto';
import { GetShipmentsQueryDto } from './dto/shipments.query.dto';
import { ReturnOrderQueryDto } from './dto/return.query.dto';
import { AllNdrQueryDto } from './dto/all-ndr-query.dto';
import { UpdateNdrDto } from './dto/update-ndr.dto';
import { GetOrdersQueryDto } from './dto/get-orders.query.dto';
import { AddNewProductDto } from './dto/add-new-product.dto';
import { ConvertToQcDto } from './dto/convert-to-qc.dto';
import { ShipmentProductQueryDto } from './dto/shipment-product-query.dto';
import { UpdateInventoryDto } from './dto/update-inventory.dto';
import { InventoryQueryDto } from './dto/inventory.query.dto';
import { GetStatementsQueryDto } from './dto/statement.query.dto';
import { ExchangeShimentDto } from './dto/exchange-order.dto';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { JwtUser } from 'src/auth/types/jwt-user.type';
import { ISuccessResponse } from 'src/common/interceptors/envelope.interface';
import { CreateShipmentDto } from './dto/create-shipment.dto';
import { TransportService } from './transport.service';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { AssignShipmentDto } from './dto/assign-shipment.dto';
import { GeneratePickupDto } from './dto/pickup-schedule.dto';
import { GenerateLabelDto } from './dto/generate-label.dto';
import { GenerateInvoiceDto } from './dto/generate-invoice.dto';
import { CancelShipmentOrderDto } from './dto/cancel-shipment-order.dto';
import { CancelShipmentByAwbDto } from './dto/cancel-shipment.dto';
import { AddPickupLocationDto } from './dto/add-pickup-location.dto';
import { PickupQueryDto } from './dto/pickup-query.dto';
import { GenerateManifestDto } from './dto/generate-manifest.dto';
import { PrintManifestDto } from './dto/print-manifest.dto';
import { CreateShipmentChannelDto } from './dto/create-channel-order.dto';

@ApiTags('Transport / Shiprocket')
@Controller('transport')
export class TransportController {
  constructor(
    private readonly shiprocket: ShiprocketService,
    private readonly transportService: TransportService,
  ) {}

  @Get('shiprocket/couriers')
  @ApiBearerAuth('access-token')
  @Roles(
    Role.CUSTOMER,
    Role.FRANCHISE_AUDITOR,
    Role.FRANCHISE_OWNER,
    Role.FRANCHISE_STAFF,
    Role.SUPERADMIN,
  )
  @ApiOperation({ summary: 'List couriers from Shiprocket' })
  listCouriers(@Query() query: ListCouriersQueryDto) {
    return this.shiprocket.listCouriers(query);
  }

  @Get('shiprocket/serviceability')
  @Roles(
    Role.CUSTOMER,
    Role.FRANCHISE_AUDITOR,
    Role.FRANCHISE_OWNER,
    Role.FRANCHISE_STAFF,
    Role.SUPERADMIN,
  )
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Check Shiprocket serviceability' })
  checkServiceability(@Query() query: ServiceabilityQueryDto) {
    return this.shiprocket.checkServiceability(query);
  }

  @Post('shiprocket/shipments/forward')
  @Roles(
    Role.FRANCHISE_AUDITOR,
    Role.FRANCHISE_OWNER,
    Role.FRANCHISE_STAFF,
    Role.SUPERADMIN,
  )
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Create a forward shipment' })
  quickShipment(@Body() payload: CreateForwardShipmentDto) {
    return this.shiprocket.quickShipment(payload);
  }

  @Post('shiprocket/shipments/return')
  @Roles(
    Role.FRANCHISE_AUDITOR,
    Role.FRANCHISE_OWNER,
    Role.FRANCHISE_STAFF,
    Role.SUPERADMIN,
  )
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Create a return shipment' })
  quickReturnShipment(@Body() payload: QuickReturnDto) {
    return this.shiprocket.quickReturnShipment(payload);
  }

  @Post('shiprocket/shipments/awb/assign')
  @Roles(
    Role.FRANCHISE_AUDITOR,
    Role.FRANCHISE_OWNER,
    Role.FRANCHISE_STAFF,
    Role.SUPERADMIN,
  )
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Assign AWB to a shipment' })
  assignAwb(@Body() dto: AssignShipmentDto) {
    return this.shiprocket.assignAwb(dto);
  }

  @Post('shiprocket/pickups/schedule')
  @Roles(
    Role.FRANCHISE_AUDITOR,
    Role.FRANCHISE_OWNER,
    Role.FRANCHISE_STAFF,
    Role.SUPERADMIN,
  )
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Schedule a pickup' })
  pickupSchedule(@Body() dto: GeneratePickupDto) {
    return this.shiprocket.pickupSchedule(dto);
  }

  @Post('shiprocket/labels')
  @Roles(
    Role.FRANCHISE_AUDITOR,
    Role.FRANCHISE_OWNER,
    Role.FRANCHISE_STAFF,
    Role.SUPERADMIN,
  )
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Generate shipment labels' })
  generateLabel(@Body() payload: GenerateLabelDto) {
    return this.shiprocket.generateLabel(payload);
  }

  @Post('shiprocket/invoices')
  @Roles(
    Role.FRANCHISE_AUDITOR,
    Role.FRANCHISE_OWNER,
    Role.FRANCHISE_STAFF,
    Role.SUPERADMIN,
  )
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Generate invoice PDF' })
  generateInvoice(@Body() dto: GenerateInvoiceDto) {
    return this.shiprocket.generateInvoice(dto);
  }

  @Get('shiprocket/tracking/awb/:awb')
  @Roles(
    Role.FRANCHISE_AUDITOR,
    Role.FRANCHISE_OWNER,
    Role.FRANCHISE_STAFF,
    Role.SUPERADMIN,
  )
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Track a shipment by AWB' })
  trackShipmentByAwb(@Param('awb') awb: string) {
    return this.shiprocket.trackShipmentByAwb(awb);
  }

  @Get('shiprocket/tracking/shipment/:shipmentId')
  @Roles(
    Role.FRANCHISE_AUDITOR,
    Role.FRANCHISE_OWNER,
    Role.FRANCHISE_STAFF,
    Role.SUPERADMIN,
  )
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Track a shipment by shipment ID' })
  trackShipmentByShipmentId(@Param('shipmentId') shipmentId: string) {
    return this.shiprocket.trackShipmentByShipmentId(shipmentId);
  }

  @Post('shiprocket/orders/cancel')
  @Roles(
    Role.FRANCHISE_AUDITOR,
    Role.FRANCHISE_OWNER,
    Role.FRANCHISE_STAFF,
    Role.SUPERADMIN,
  )
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Cancel shipment orders by order IDs' })
  cancelShipmentOrders(@Body() dto: CancelShipmentOrderDto) {
    return this.shiprocket.cancelShipmentOrders(dto.ids);
  }

  @Post('shiprocket/orders/cancel/awbs')
  @Roles(
    Role.FRANCHISE_AUDITOR,
    Role.FRANCHISE_OWNER,
    Role.FRANCHISE_STAFF,
    Role.SUPERADMIN,
  )
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Cancel shipment orders by AWB list' })
  cancelShipmentByAwb(@Body() dto: CancelShipmentByAwbDto) {
    return this.shiprocket.cancelShipmentByAwb(dto.awbs);
  }

  @Post('shiprocket/pickup-locations')
  @Roles(
    Role.FRANCHISE_AUDITOR,
    Role.FRANCHISE_OWNER,
    Role.FRANCHISE_STAFF,
    Role.SUPERADMIN,
  )
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Add a pickup location' })
  @ApiBody({ type: AddPickupLocationDto })
  addPickupLocation(@Body() dto: AddPickupLocationDto) {
    return this.shiprocket.addPickupLocation(dto);
  }

  @Patch('shiprocket/pickup-locations')
  @Roles(
    Role.FRANCHISE_AUDITOR,
    Role.FRANCHISE_OWNER,
    Role.FRANCHISE_STAFF,
    Role.SUPERADMIN,
  )
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update pickup location' })
  @ApiBody({ type: UpdatePickupDto })
  updatePickupLocation(@Body() dto: UpdatePickupDto) {
    return this.shiprocket.updatePickupLocation(dto);
  }

  @Patch('shiprocket/delivery-locations')
  @Roles(
    Role.FRANCHISE_AUDITOR,
    Role.FRANCHISE_OWNER,
    Role.FRANCHISE_STAFF,
    Role.SUPERADMIN,
  )
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update delivery location' })
  updateDeliveryLocation(@Body() dto: UpdateDeliveryLocationDto) {
    return this.shiprocket.updateDeliveryLocation(dto);
  }

  @Patch('shiprocket/shipments/order')
  @Roles(
    Role.FRANCHISE_AUDITOR,
    Role.FRANCHISE_OWNER,
    Role.FRANCHISE_STAFF,
    Role.SUPERADMIN,
  )
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update a shipment order' })
  updateShipmentOrder(@Body() dto: UpdateShipmentOrderDto) {
    return this.shiprocket.updateShipmentOrder(dto);
  }

  @Get('shiprocket/pickup-locations')
  @Roles(
    Role.FRANCHISE_AUDITOR,
    Role.FRANCHISE_OWNER,
    Role.FRANCHISE_STAFF,
    Role.SUPERADMIN,
  )
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'List pickup locations' })
  async getAllPickupLocations(@Query() query: PickupQueryDto) {
    return this.shiprocket.getAllPickupLocations(query);
  }

  @Get('shiprocket/shipments')
  @Roles(
    Role.FRANCHISE_AUDITOR,
    Role.FRANCHISE_OWNER,
    Role.FRANCHISE_STAFF,
    Role.SUPERADMIN,
  )
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'List shipments' })
  getShipments(@Query() query: GetShipmentsQueryDto) {
    return this.shiprocket.getShipments(query);
  }

  @Get('shiprocket/shipments/:shipmentId')
  @Roles(
    Role.FRANCHISE_AUDITOR,
    Role.FRANCHISE_OWNER,
    Role.FRANCHISE_STAFF,
    Role.SUPERADMIN,
  )
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get a shipment by shipment ID' })
  getSpecificOrderByShipmentId(@Param('shipmentId') shipmentId: string) {
    return this.shiprocket.getSpecificOrderByShipmentId(shipmentId);
  }

  @Post('shiprocket/manifests/generate')
  @Roles(
    Role.FRANCHISE_AUDITOR,
    Role.FRANCHISE_OWNER,
    Role.FRANCHISE_STAFF,
    Role.SUPERADMIN,
  )
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Generate a manifest' })
  manifestsGenerate(@Body() dto: GenerateManifestDto) {
    return this.shiprocket.manifestsGenerate(dto.shipmentIds);
  }

  @Post('shiprocket/manifests/print')
  @Roles(
    Role.FRANCHISE_AUDITOR,
    Role.FRANCHISE_OWNER,
    Role.FRANCHISE_STAFF,
    Role.SUPERADMIN,
  )
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Print a manifest' })
  manifestPrint(@Body() dto: PrintManifestDto) {
    return this.shiprocket.manifestPrint(dto.orderIds);
  }

  @Post('shiprocket/returns')
  @Roles(
    Role.FRANCHISE_AUDITOR,
    Role.FRANCHISE_OWNER,
    Role.FRANCHISE_STAFF,
    Role.SUPERADMIN,
  )
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Create a return order' })
  returnOrder(@Body() dto: CreateReturnOrderDto) {
    return this.shiprocket.returnOrder(dto);
  }

  @Patch('shiprocket/returns')
  @Roles(
    Role.FRANCHISE_AUDITOR,
    Role.FRANCHISE_OWNER,
    Role.FRANCHISE_STAFF,
    Role.SUPERADMIN,
  )
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update a return order' })
  updateReturnOrder(@Body() dto: UpdateReturnOrderDto) {
    return this.shiprocket.updateReturnOrder(dto);
  }

  @Get('shiprocket/returns')
  @Roles(
    Role.FRANCHISE_AUDITOR,
    Role.FRANCHISE_OWNER,
    Role.FRANCHISE_STAFF,
    Role.SUPERADMIN,
  )
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'List return orders' })
  getReturnOrders(@Query() query: ReturnOrderQueryDto) {
    return this.shiprocket.getReturnOrders(query);
  }

  @Post('shiprocket/exchange')
  @Roles(
    Role.FRANCHISE_AUDITOR,
    Role.FRANCHISE_OWNER,
    Role.FRANCHISE_STAFF,
    Role.SUPERADMIN,
  )
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Create an exchange order' })
  exchangeOrder(@Body() dto: ExchangeShimentDto) {
    return this.shiprocket.exchangeOrder(dto);
  }

  @Post('shiprocket/ndr/:awb/action')
  @Roles(
    Role.FRANCHISE_AUDITOR,
    Role.FRANCHISE_OWNER,
    Role.FRANCHISE_STAFF,
    Role.SUPERADMIN,
  )
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update NDR action for an AWB' })
  updateNDR(@Param('awb') awb: string, @Body() dto: UpdateNdrDto) {
    return this.shiprocket.updateNDR(awb, dto);
  }

  @Get('shiprocket/ndr')
  @Roles(
    Role.FRANCHISE_AUDITOR,
    Role.FRANCHISE_OWNER,
    Role.FRANCHISE_STAFF,
    Role.SUPERADMIN,
  )
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'List NDR reasons' })
  getAllNdrReasons(@Query() query: AllNdrQueryDto) {
    return this.shiprocket.getAllNdrReasons(query);
  }

  @Get('shiprocket/ndr/:awb')
  @Roles(
    Role.FRANCHISE_AUDITOR,
    Role.FRANCHISE_OWNER,
    Role.FRANCHISE_STAFF,
    Role.SUPERADMIN,
  )
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get NDR details by AWB' })
  getSpecificNdrReasons(@Param('awb') awb: string) {
    return this.shiprocket.getSpecificNdrReasons(awb);
  }

  @Post('/create-orders/:invoiceNumber')
  @Roles(
    Role.FRANCHISE_AUDITOR,
    Role.FRANCHISE_OWNER,
    Role.FRANCHISE_STAFF,
    Role.SUPERADMIN,
  )
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Create ad-hoc shipping order' })
  @ApiParam({
    name: 'invoiceNumber',
    type: String,
    required: true,
    description: 'Invoice number from invoice to create shipment order',
  })
  async createOrderByOrderNumberFromInvoice(
    @CurrentUser() user: JwtUser,
    @Param('invoiceNumber') invoiceNumber: string,
    @Body() dto: CreateShipmentDto,
    @Ip() ip: string,
  ): Promise<ISuccessResponse<TransportShipmentOrderIDResult>> {
    const result = await this.transportService.createOrder(
      user,
      invoiceNumber,
      dto,
      ip,
    );

    return {
      data: result,
      message: 'Shipping order created successfully',
    };
  }

  // @Post('/custom-create-orders')
  // @Roles(
  //   Role.FRANCHISE_AUDITOR,
  //   Role.FRANCHISE_OWNER,
  //   Role.FRANCHISE_STAFF,
  //   Role.SUPERADMIN,
  // )
  // @ApiBearerAuth('access-token')
  // @ApiOperation({ summary: 'Create ad-hoc shipping order' })
  // async customOrderForShipment(
  //   @CurrentUser() user: JwtUser,
  //   @Body() dto: TransportShipmentDto,
  //   @Ip() ip: string,
  // ): Promise<ISuccessResponse<unknown>> {
  //   const data = await this.transportService.createCustomOrder(user, dto, ip);
  // 
  //   return {
  //     data,
  //     message: 'Shipping order created successfully',
  //   };
  // }

  // @Post('shiprocket/orders/channel')
  // @Roles(
  //   Role.FRANCHISE_AUDITOR,
  //   Role.FRANCHISE_OWNER,
  //   Role.FRANCHISE_STAFF,
  //   Role.SUPERADMIN,
  // )
  // @ApiBearerAuth('access-token')
  // @ApiOperation({ summary: 'Create a shipment order from channel data' })
  // createShipmentWithChannel(@Body() dto: CreateShipmentChannelDto) {
  //   return this.shiprocket.createShipmentWithChannel(dto);
  // }

  @Get('shiprocket/orders')
  @Roles(
    Role.FRANCHISE_AUDITOR,
    Role.FRANCHISE_OWNER,
    Role.FRANCHISE_STAFF,
    Role.SUPERADMIN,
  )
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'List shipment orders' })
  getOrders(@Query() query: GetOrdersQueryDto) {
    return this.shiprocket.getOrders(query);
  }

  @Get('shiprocket/orders/:orderId')
  @ApiOperation({ summary: 'Get a shipment order by ID' })
  getOrder(@Param('orderId') orderId: string) {
    return this.shiprocket.getOrder(orderId);
  }

  @Get('shiprocket/orders/export')
  @Roles(
    Role.FRANCHISE_AUDITOR,
    Role.FRANCHISE_OWNER,
    Role.FRANCHISE_STAFF,
    Role.SUPERADMIN,
  )
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Export orders from Shiprocket' })
  exportOrders() {
    return this.shiprocket.exportOrders();
  }

  @Get('shiprocket/wallet-balance')
  @Roles(
    Role.FRANCHISE_AUDITOR,
    Role.FRANCHISE_OWNER,
    Role.FRANCHISE_STAFF,
    Role.SUPERADMIN,
  )
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get Shiprocket wallet balance' })
  getWalletBalance() {
    return this.shiprocket.getWalletBalance();
  }

  @Post('shiprocket/products')
  @Roles(
    Role.FRANCHISE_AUDITOR,
    Role.FRANCHISE_OWNER,
    Role.FRANCHISE_STAFF,
    Role.SUPERADMIN,
  )
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Create a product in Shiprocket' })
  addNewProduct(@Body() payload: AddNewProductDto) {
    return this.shiprocket.addNewProduct(payload);
  }

  @Post('shiprocket/products/:productId/qc')
  @Roles(
    Role.FRANCHISE_AUDITOR,
    Role.FRANCHISE_OWNER,
    Role.FRANCHISE_STAFF,
    Role.SUPERADMIN,
  )
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Convert a product to QC product' })
  convertToQcProduct(
    @Param('productId') productId: string,
    @Body() payload: ConvertToQcDto,
  ) {
    return this.shiprocket.convertToQcProduct(productId, payload);
  }

  @Get('shiprocket/products')
  @Roles(
    Role.FRANCHISE_AUDITOR,
    Role.FRANCHISE_OWNER,
    Role.FRANCHISE_STAFF,
    Role.SUPERADMIN,
  )
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'List products from Shiprocket' })
  getProducts(@Query() query: ShipmentProductQueryDto) {
    return this.shiprocket.getProducts(query);
  }

  @Get('shiprocket/products/:productId')
  @Roles(
    Role.FRANCHISE_AUDITOR,
    Role.FRANCHISE_OWNER,
    Role.FRANCHISE_STAFF,
    Role.SUPERADMIN,
  )
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get a product by ID' })
  getProduct(@Param('productId') productId: string) {
    return this.shiprocket.getProduct(productId);
  }

  @Get('shiprocket/channels')
  @Roles(
    Role.FRANCHISE_AUDITOR,
    Role.FRANCHISE_OWNER,
    Role.FRANCHISE_STAFF,
    Role.SUPERADMIN,
  )
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'List available channels' })
  getChannels() {
    return this.shiprocket.getChannels();
  }

  @Patch('shiprocket/inventory/:productId')
  @Roles(
    Role.FRANCHISE_AUDITOR,
    Role.FRANCHISE_OWNER,
    Role.FRANCHISE_STAFF,
    Role.SUPERADMIN,
  )
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update product inventory' })
  updatetInventory(
    @Param('productId') productId: string,
    @Body() payload: UpdateInventoryDto,
  ) {
    return this.shiprocket.updatetInventory(productId, payload);
  }

  @Get('shiprocket/inventory')
  @Roles(
    Role.FRANCHISE_AUDITOR,
    Role.FRANCHISE_OWNER,
    Role.FRANCHISE_STAFF,
    Role.SUPERADMIN,
  )
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'List inventory items' })
  getInventory(@Query() query: InventoryQueryDto) {
    return this.shiprocket.getInventory(query);
  }

  @Get('shiprocket/countries')
  @Roles(
    Role.FRANCHISE_AUDITOR,
    Role.FRANCHISE_OWNER,
    Role.FRANCHISE_STAFF,
    Role.SUPERADMIN,
  )
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'List country codes' })
  getCountryCodes() {
    return this.shiprocket.getCountryCodes();
  }

  @Get('shiprocket/countries/:countryId/zones')
  @Roles(
    Role.FRANCHISE_AUDITOR,
    Role.FRANCHISE_OWNER,
    Role.FRANCHISE_STAFF,
    Role.SUPERADMIN,
  )
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'List zones for a country' })
  getAllZones(@Param('countryId') countryId: string) {
    return this.shiprocket.getAllZones(countryId);
  }

  @Get('shiprocket/postcodes/:postcode')
  @Roles(
    Role.FRANCHISE_AUDITOR,
    Role.FRANCHISE_OWNER,
    Role.FRANCHISE_STAFF,
    Role.SUPERADMIN,
  )
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get locality details by postcode' })
  getLocalityDetails(@Param('postcode') postcode: string) {
    return this.shiprocket.getLocalityDetails(postcode);
  }

  @Get('shiprocket/statements')
  @ApiOperation({ summary: 'Get account statements' })
  getStatement(@Query() query: GetStatementsQueryDto) {
    return this.shiprocket.getStatement(query);
  }

  @Get('shiprocket/discrepancy')
  @Roles(
    Role.FRANCHISE_AUDITOR,
    Role.FRANCHISE_OWNER,
    Role.FRANCHISE_STAFF,
    Role.SUPERADMIN,
  )
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get billing discrepancy data' })
  getDiscrepancy() {
    return this.shiprocket.getDiscrepancy();
  }

  @Get('shiprocket/imports/:importId/check')
  @Roles(
    Role.FRANCHISE_AUDITOR,
    Role.FRANCHISE_OWNER,
    Role.FRANCHISE_STAFF,
    Role.SUPERADMIN,
  )
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Check import results' })
  getImportResults(@Param('importId') importId: string) {
    return this.shiprocket.getImportResults(importId);
  }
}
