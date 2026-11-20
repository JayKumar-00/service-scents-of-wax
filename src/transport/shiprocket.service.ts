import {
  BadRequestException,
  Injectable,
  HttpException,
  NotFoundException,
} from '@nestjs/common';
import { ListCouriersQueryDto } from './dto/list-query.dto';
import { ShiprocketProvider } from './providers/shiprocket.provider';
import { ServiceabilityQueryDto } from './dto/serviceability-query.dto';
import { CreateForwardShipmentDto } from './dto/forward.dto';
import { QuickReturnDto } from './dto/quick-return.dto';
import {
  AddPickupLocationPayload,
  AddPickupLocationResult,
  AddProductResult,
  AssignShipmentPayload,
  AssignShipmentResult,
  ConvertToQCProductResult,
  ExchangeShimentResult,
  ExportOrdersResult,
  GenerateInvoicePayload,
  GenerateInvoiceResult,
  GenerateLabelPayload,
  GenerateLabelResult,
  GeneratePickupPayload,
  GeneratePickupResult,
  GetAllPickupLocationsResult,
  GetAllProductsResult,
  GetChannelsResult,
  GetCountryResult,
  GetDiscrepancyResult,
  GetImportResult,
  GetInventoryResult,
  GetLocalityResult,
  GetProductResult,
  GetReturnOrdersResult,
  GetShipmentOrderResult,
  GetShipmentOrdersResult,
  GetShipmentsResult,
  GetStatementResult,
  GetZoneResult,
  ShirocketMeta,
  TrackingResult,
  TransportShipmentOrderIDPayload,
  TransportShipmentOrderIDResult,
  UpdateDeliverylocationResult,
  UpdateInventoryResult,
  UpdatePickupLocationResult,
  UpdateReturnOrderResult,
  UpdateShipmentOrderResult,
} from './interfaces/shiprocket.interface';
import { UpdatePickupDto } from './dto/update-pickup.dto';
import { UpdateDeliveryLocationDto } from './dto/update-delivery-location.dto';
import { UpdateShipmentOrderDto } from './dto/update-shipment.dto';
import { GetShipmentsQueryDto } from './dto/shipments.query.dto';
import { OrderType } from 'src/common/dto/query.dto';
import { GetStatementsQueryDto } from './dto/statement.query.dto';
import { InventoryQueryDto } from './dto/inventory.query.dto';
import { UpdateInventoryDto } from './dto/update-inventory.dto';
import { ShipmentProductQueryDto } from './dto/shipment-product-query.dto';
import { ConvertToQcDto } from './dto/convert-to-qc.dto';
import { AddNewProductDto } from './dto/add-new-product.dto';
import { GetOrdersQueryDto } from './dto/get-orders.query.dto';
import { AllNdrQueryDto } from './dto/all-ndr-query.dto';
import { UpdateNdrDto } from './dto/update-ndr.dto';
import { ExchangeShimentDto } from './dto/exchange-order.dto';
import { ReturnOrderQueryDto } from './dto/return.query.dto';
import { UpdateReturnOrderDto } from './dto/update-return-order.dto';
import { CreateReturnOrderDto } from './dto/return-order.dto';
import { console } from 'inspector';
import { PickupQueryDto } from './dto/pickup-query.dto';
import { CreateShipmentChannelDto } from './dto/create-channel-order.dto';
import { LocationService } from 'src/geo/location.service';

@Injectable()
export class ShiprocketService {
  constructor(
    private readonly shiprocket: ShiprocketProvider,
    private readonly locationService: LocationService,
  ) {}

  private stripUndefinedValues<T extends object>(payload: T): T {
    return Object.fromEntries(
      Object.entries(payload).filter(([, value]) => value !== undefined),
    ) as T;
  }

  private get axiosInstance() {
    return this.shiprocket.axiosInstance;
  }

  private requestWithAuthRetry<T>(
    fn: (headers: Record<string, string>) => Promise<T>,
  ) {
    return this.shiprocket.requestWithAuthRetry(fn);
  }

  private handleShipRocketError(error: unknown) {
    return this.shiprocket.handleShipRocketError(error);
  }

  private formatTrackingResponse(data: any) {
    return this.shiprocket.formatTrackingResponse(data);
  }

  private mapStatus(status: string) {
    return this.shiprocket.mapStatus(status);
  }

  async listCouriers(query: ListCouriersQueryDto): Promise<unknown> {
    try {
      const res = await this.requestWithAuthRetry((headers) =>
        this.axiosInstance.get(`/courier/courierListWithCounts`, {
          headers,
          params: {
            type: query.type,
          },
        }),
      );

      if (res.status !== 200) {
        throw new BadRequestException(
          'Failed to fetch couriers from Shiprocket',
        );
      }

      const result = res.data;

      return { ...result };
    } catch (error) {
      throw this.handleShipRocketError(error);
    }
  }

  async checkServiceability(query: ServiceabilityQueryDto): Promise<unknown> {
    try {
      const res = await this.requestWithAuthRetry((headers) =>
        this.axiosInstance.get(`/courier/serviceability`, {
          headers,
          params: {
            ...query,
            page: query.page,
            per_page: query.limit,
          },
        }),
      );

      if (res.status !== 200) {
        throw new BadRequestException(
          'Failed to check serviceability with Shiprocket',
        );
      }

      const result = res.data;

      return { ...result };
    } catch (error) {
      throw this.handleShipRocketError(error);
    }
  }

  async quickShipment(payload: CreateForwardShipmentDto): Promise<unknown> {
    try {
      const res = await this.requestWithAuthRetry((headers) =>
        this.axiosInstance.post(`/shipments/create/forward-shipment`, payload, {
          headers,
        }),
      );

      if (res.status !== 201 && res.status !== 200) {
        throw new BadRequestException(
          'Failed to create forward shipment in Shiprocket',
        );
      }

      const result = res.data;

      return result.payload;
    } catch (error) {
      throw this.handleShipRocketError(error);
    }
  }

  async quickReturnShipment(payload: QuickReturnDto): Promise<unknown> {
    try {
      const res = await this.requestWithAuthRetry((headers) =>
        this.axiosInstance.post(`/shipments/create/return-shipment`, payload, {
          headers,
        }),
      );

      if (res.status !== 201 && res.status !== 200) {
        throw new BadRequestException(
          'Failed to create return shipment in Shiprocket',
        );
      }

      const result = res.data;

      return result.payload;
    } catch (error) {
      throw this.handleShipRocketError(error);
    }
  }

  async assignAwb(
    payload: AssignShipmentPayload,
  ): Promise<AssignShipmentResult> {
    try {
      const res = await this.requestWithAuthRetry((headers) =>
        this.axiosInstance.post(`/courier/assign/awb`, payload, {
          headers,
        }),
      );

      console.log('ShipRocket Response:', res.data);

      // Check for HTTP status
      if (res.status !== 200) {
        throw new HttpException(res.data, res.status);
      }

      // Check for API-level error status codes and awb_assign_status
      if (res.data?.status_code !== 200 || res.data?.awb_assign_status === 0) {
        throw new HttpException(res.data, 400);
      }

      const data = res.data?.response?.data;

      if (!data?.awb_code || !data?.shipment_id) {
        throw new HttpException('Invalid AWB response from Shiprocket', 400);
      }

      return {
        awb: data.awb_code,
        courierName: data.courier_name,
        shipmentId: data.shipment_id,
        invoice_no: data.invoice_no,
        company_id: data.company_id,
        courier_company_id: data.courier_company_id,
      };
    } catch (error) {
      // If it's already an HttpException, re-throw it
      if (error instanceof HttpException) {
        throw error;
      }
      // Otherwise handle axios errors
      throw this.handleShipRocketError(error);
    }
  }

  async pickupSchedule(
    payload: GeneratePickupPayload,
  ): Promise<GeneratePickupResult> {
    try {
      if (
        !payload ||
        !payload.shipmentIds ||
        payload.shipmentIds.length === 0
      ) {
        throw new BadRequestException('shipmentIds are required');
      }

      const requestBody: any = {
        shipment_id: payload.shipmentIds,
      };

      if (payload.pickupDate) {
        requestBody.pickup_date = [payload.pickupDate];
      }

      const res = await this.requestWithAuthRetry((headers) =>
        this.axiosInstance.post(`/courier/generate/pickup`, requestBody, {
          headers,
        }),
      );

      if (res.data?.pickup_status !== 1) {
        throw new BadRequestException(
          res.data?.message || 'Failed to schedule pickup in Shiprocket',
        );
      }

      const result = res.data;

      if (!result.success) {
        throw new BadRequestException('Invalid pickup response structure');
      }

      return {
        pickupScheduledDate: result.pickup_scheduled_date,
        pickupTokenNumber: result.pickup_token_number,
        pickupGeneratedDate: result.pickup_generated_date?.date,
        pickupMessage: result.data,
      };
    } catch (error) {
      throw this.handleShipRocketError(error);
    }
  }

  async generateLabel(
    payload: GenerateLabelPayload,
  ): Promise<GenerateLabelResult> {
    try {
      const res = await this.requestWithAuthRetry((headers) =>
        this.axiosInstance.post(
          `/courier/generate/label`,
          {
            shipment_id: payload.shipmentIds, // must be array
          },
          { headers },
        ),
      );

      const data = res.data;

      if (!data?.label_created || data.label_created < 1) {
        throw new BadRequestException(
          data?.message || 'Failed to generate label in Shiprocket',
        );
      }

      if (!data.label_url) {
        throw new BadRequestException(
          'Shiprocket returned success but no label URL found',
        );
      }

      return {
        labelUrl: data.label_url,
        labelMessage: data.response ?? 'Label generated successfully',
        failedLabels: Array.isArray(data.not_created) ? data.not_created : [],
      };
    } catch (error) {
      throw this.handleShipRocketError(error);
    }
  }

  async generateInvoice(
    payload: GenerateInvoicePayload,
  ): Promise<GenerateInvoiceResult> {
    try {
      const res = await this.requestWithAuthRetry((headers) =>
        this.axiosInstance.post(
          `/orders/print/invoice`,
          {
            ids: payload.shiprocketOrderIds, // must be array
          },
          { headers },
        ),
      );

      const data = res.data;

      if (!data?.is_invoice_created) {
        throw new BadRequestException(
          'Failed to generate invoice in Shiprocket',
        );
      }

      return {
        invoiceUrl: data.invoice_url,
        failedInvoices: Array.isArray(data.not_created) ? data.not_created : [],
      };
    } catch (error) {
      throw this.handleShipRocketError(error);
    }
  }

  async trackShipmentByAwb(awb: string): Promise<TrackingResult> {
    try {
      const res = await this.requestWithAuthRetry((headers) =>
        this.axiosInstance.get(`/courier/track/awb/${awb}`, { headers }),
      );

      const trackingData = res.data?.tracking_data;

      if (!trackingData) {
        throw new NotFoundException(`No tracking data found for awb: ${awb}`);
      }

      if (trackingData.track_status !== 1) {
        return {
          awb,
          status: 'TRACKING_NOT_AVAILABLE',
        };
      }

      return this.formatTrackingResponse(res.data);
    } catch (error) {
      throw this.handleShipRocketError(error);
    }
  }

  async trackShipmentByShipmentId(
    shipment_id: string,
  ): Promise<TrackingResult> {
    try {
      const res = await this.requestWithAuthRetry((headers) =>
        this.axiosInstance.get(`/courier/track/shipment/${shipment_id}`, {
          headers,
        }),
      );

      const trackingData = res.data?.tracking_data;

      if (!trackingData) {
        throw new NotFoundException(
          `No tracking data found for shipment_id: ${shipment_id}`,
        );
      }

      if (trackingData.track_status !== 1) {
        return {
          shipment_id: shipment_id,
          status: 'TRACKING_NOT_AVAILABLE',
        };
      }

      return this.formatTrackingResponse(res.data);
    } catch (error) {
      throw this.handleShipRocketError(error);
    }
  }

  async cancelShipmentOrders(ids: number[]): Promise<boolean> {
    try {
      const response = await this.requestWithAuthRetry((headers) =>
        this.axiosInstance.post(`/orders/cancel`, { ids }, { headers }),
      );

      // Shiprocket returns 204 No Content
      if (![200, 204].includes(response.status)) {
        throw new BadRequestException('Failed to cancel order in Shiprocket');
      }

      return true;
    } catch (error) {
      throw this.handleShipRocketError(error);
    }
  }

  async cancelShipmentByAwb(awbs: string[]): Promise<{ message: string }> {
    try {
      const res = await this.requestWithAuthRetry((headers) =>
        this.axiosInstance.post(
          `/orders/cancel/shipment/awbs`,
          { awbs },
          { headers },
        ),
      );

      if (![200, 204].includes(res.status)) {
        throw new BadRequestException('Failed to cancel order in Shiprocket');
      }

      // This API returns message in body
      return {
        message:
          res.data?.message ??
          'Shipment cancellation request submitted successfully',
      };
    } catch (error) {
      throw this.handleShipRocketError(error);
    }
  }

  //   async handleWebhook(payload: any): Promise<TransportHookResult> {
  //     const { awb, current_status, courier_name } = payload;

  //     if (!awb) return null;

  //     const shipment = await this.shipmentModel.findOne({ awb });
  //     if (!shipment) return null;

  //     const mappedStatus = this.mapStatus(current_status);

  //     shipment.status = mappedStatus;
  //     shipment.lastStatusAt = new Date();
  //     shipment.lastWebhookPayload = payload;
  //     await shipment.save();

  //     /* To Prevent Duplicate Tracking Entries */
  //     const eventTime = payload.event_time
  //       ? new Date(payload.event_time)
  //       : new Date();

  //     const exists = await this.trackingModel.findOne({
  //       shipmentId: shipment._id,
  //       status: mappedStatus,
  //       eventTime,
  //     });

  //     if (!exists) {
  //       await this.trackingModel.create({
  //         shipmentId: shipment._id,
  //         status: mappedStatus,
  //         location: payload.current_location,
  //         remark: payload.remark,
  //         eventTime,
  //         rawPayload: payload,
  //       });
  //     }

  //     return {
  //       shipment_id: shipment._id.toString(),
  //       shipment_status: mappedStatus,
  //       awb, // Include AWB in response for invoice update
  //       courier_name: courier_name, // Include courier name if available
  //     };
  //   }

  // Pickup Addresses Collection (Add new pickup location, Get pickup locations)
  async addPickupLocation(
    payload: AddPickupLocationPayload,
  ): Promise<AddPickupLocationResult> {
    try {
      const coordinates =
        payload.lat != null && payload.long != null
          ? { lat: payload.lat, lng: payload.long }
          : await this.locationService.resolveCoordinates({
              area: payload.address,
              addressLine2: payload.address_2,
              city: payload.city,
              state: payload.state,
              country: payload.country,
            });

      const requestPayload: AddPickupLocationPayload = {
        ...payload,
        lat: coordinates.lat,
        long: coordinates.lng,
      };

      const res = await this.requestWithAuthRetry((headers) =>
        this.axiosInstance.post(`/settings/company/addpickup`, requestPayload, {
          headers,
        }),
      );

      const result = res.data;

      if (!result.success) {
        throw new BadRequestException(
          result.data?.message || 'Failed to add pickup location in Shiprocket',
        );
      }

      return {
        address: result.address,
        pickup_id: result.pickup_id,
        company_name: result.company_name,
        full_name: result.full_name,
      };
    } catch (error) {
      throw this.handleShipRocketError(error);
    }
  }

  async updatePickupLocation(
    payload: UpdatePickupDto,
  ): Promise<UpdatePickupLocationResult> {
    try {
      const res = await this.requestWithAuthRetry((headers) =>
        this.axiosInstance.patch(`/orders/address/pickup`, payload, {
          headers,
        }),
      );

      if (res.status !== 200) {
        throw new BadRequestException(
          'Failed to update pickup location in Shiprocket',
        );
      }
      const result = res.data;

      return {
        message:
          result?.message ||
          'Pickup location updated successfully in Shiprocket',
      };
    } catch (error) {
      throw this.handleShipRocketError(error);
    }
  }

  async updateDeliveryLocation(
    payload: UpdateDeliveryLocationDto,
  ): Promise<UpdateDeliverylocationResult> {
    try {
      const res = await this.requestWithAuthRetry((headers) =>
        this.axiosInstance.patch(`/orders/address/update`, payload, {
          headers,
        }),
      );

      if (res.status !== 200 && res.status !== 202) {
        throw new BadRequestException(
          'Failed to update delivery location in Shiprocket',
        );
      }

      return {
        message:
          res.data?.message ||
          'Delivery location updated successfully in Shiprocket',
      };
    } catch (error) {
      throw this.handleShipRocketError(error);
    }
  }

  async updateShipmentOrder(
    payload: UpdateShipmentOrderDto,
  ): Promise<UpdateShipmentOrderResult> {
    try {
      const res = await this.requestWithAuthRetry((headers) =>
        this.axiosInstance.patch(`/orders/update/adhoc`, payload, {
          headers,
        }),
      );

      const result = res.data;

      if (result.success) {
        throw new BadRequestException(
          'Failed to update shipment order in Shiprocket: ' +
            (result.data?.message || 'Unknown error'),
        );
      }

      return {
        partially_update: result.partially_update,
        not_updated_fields: result.not_updated_fields,
        order_id: result.order_id,
        shipment_id: result.shipment_id,
        new_order_status: result.new_order_status,
        old_order_status: result.old_order_status,
        awb_code: result.awb_code,
        courier_company_id: result.courier_company_id,
        courier_name: result.courier_name,
      };
    } catch (error) {
      throw this.handleShipRocketError(error);
    }
  }

  async getAllPickupLocations(
    query: PickupQueryDto,
  ): Promise<GetAllPickupLocationsResult> {
    try {
      const result = await this.requestWithAuthRetry((headers) =>
        this.axiosInstance.get(`/settings/company/pickup`, {
          headers,
        }),
      );

      const responseData = result?.data as any;
      const candidateData =
        responseData?.shipping_address ??
        responseData?.data?.shipping_address ??
        responseData?.pickup_locations ??
        responseData?.data?.pickup_locations ??
        [];

      let data = Array.isArray(candidateData) ? candidateData : [];

      // filter
      if (query.search) {
        const searchLower = query.search.toLowerCase();
        data = data.filter(
          (c: any) =>
            c.pickup_location?.toLowerCase().includes(searchLower) ||
            c.pin_code?.toLowerCase().includes(searchLower) ||
            c.email?.toLowerCase().includes(searchLower) ||
            c.name?.toLowerCase().includes(searchLower),
        );
      }

      // pagination
      const page = query.page && query.page > 0 ? query.page : 1;
      const limit = query.limit && query.limit > 0 ? query.limit : 10;

      const totalItems = data.length;

      const totalPages = Math.ceil(totalItems / limit);

      const paginatedData = data.slice((page - 1) * limit, page * limit);

      return {
        data: paginatedData,
        meta: {
          count: paginatedData.length,
          totalItems,
          totalPages,
          page,
          limit,
        },
      };
    } catch (error) {
      throw this.handleShipRocketError(error);
    }
  }

  async getShipments(query: GetShipmentsQueryDto): Promise<GetShipmentsResult> {
    try {
      const res = await this.requestWithAuthRetry((headers) =>
        this.axiosInstance.get(`/shipments`, {
          headers,
          params: {
            page: query.page,
            per_page: query.limit,
            sort: query.order === OrderType.ASC ? 'ASC' : 'DESC',
            filter: query.filter,
            filter_by: query.filter_by,
            sort_by: query.sort_by,
            from: query.fromDate,
            to: query.lastDate,
          },
        }),
      );

      const result = res.data;

      return { ...result };
    } catch (error) {
      throw this.handleShipRocketError(error);
    }
  }

  async getSpecificOrderByShipmentId(shipment_id: string): Promise<unknown> {
    try {
      const res = await this.requestWithAuthRetry((headers) =>
        this.axiosInstance.get(`/shipments/${shipment_id}`, {
          headers,
        }),
      );

      const result = res.data;

      if (!result) {
        throw new NotFoundException(
          res.data?.message ||
            `Order not found with ${shipment_id} in Shiprocket`,
        );
      }

      return result;
    } catch (error) {
      throw this.handleShipRocketError(error);
    }
  }

  async manifestsGenerate(shipmentIds: number[]): Promise<unknown> {
    try {
      if (!shipmentIds?.length || shipmentIds.length === 0) {
        throw new BadRequestException('shipmentIds are required');
      }

      const res = await this.requestWithAuthRetry((headers) =>
        this.axiosInstance.post(
          `/manifests/generate`,
          { shipment_id: shipmentIds },
          {
            headers,
          },
        ),
      );

      const result = res.data;

      if (!result) {
        throw new BadRequestException(
          res.data?.message || 'Failed to generate manifest in Shiprocket',
        );
      }

      return result;
    } catch (error) {
      throw this.handleShipRocketError(error);
    }
  }

  async manifestPrint(orderIds: number[]): Promise<unknown> {
    try {
      if (!orderIds.length || orderIds.length <= 0) {
        throw new BadRequestException('shipmentIds are required');
      }

      const res = await this.requestWithAuthRetry((headers) =>
        this.axiosInstance.post(
          `/manifests/print`,
          { order_ids: orderIds },
          { headers },
        ),
      );

      const result = res.data;

      if (!result) {
        throw new BadRequestException(
          res.data?.message || 'Failed to print manifest in Shiprocket',
        );
      }

      return {
        manifest_url: result.manifest_url,
      };
    } catch (error) {
      throw this.handleShipRocketError(error);
    }
  }

  async returnOrder(payload: CreateReturnOrderDto): Promise<unknown> {
    try {
      const res = await this.requestWithAuthRetry((headers) =>
        this.axiosInstance.post(`/orders/create/return`, payload, {
          headers,
        }),
      );

      if (res.status !== 201) {
        throw new BadRequestException(
          res.data?.message || 'Failed to create return order in Shiprocket',
        );
      }

      const response = res.data;

      if (!response) {
        throw new BadRequestException(
          'Invalid return order response structure from Shiprocket',
        );
      }

      return {
        order_id: response.order_id,
        shipment_id: response.shipment_id,
        status: response.status,
        status_code: response.status_code,
        company_name: response.company_name,
      };
    } catch (error) {
      throw this.handleShipRocketError(error);
    }
  }

  async updateReturnOrder(
    payload: UpdateReturnOrderDto,
  ): Promise<UpdateReturnOrderResult> {
    try {
      const res = await this.requestWithAuthRetry((headers) =>
        this.axiosInstance.post(`/orders/edit`, payload, {
          headers,
        }),
      );

      if (res.status !== 200 && res.status !== 202 && res.status !== 204) {
        throw new BadRequestException(
          'Failed to update return order in Shiprocket: ',
        );
      }

      const result = res.data;

      return { ...result };
    } catch (error) {
      throw this.handleShipRocketError(error);
    }
  }

  async getReturnOrders(
    query: ReturnOrderQueryDto,
  ): Promise<GetReturnOrdersResult> {
    try {
      const res = await this.requestWithAuthRetry((headers) =>
        this.axiosInstance.get(`/orders/processing/return`, {
          headers,
          params: {
            page: query.page,
            per_page: query.limit,
            from: query.fromDate,
            to: query.lastDate,
          },
        }),
      );

      if (res.status !== 200) {
        throw new BadRequestException(
          res.data?.message || 'Failed to fetch NDR reasons from Shiprocket',
        );
      }

      const result = res.data;

      return {
        data: result.data || [],
        meta: result.meta || {},
      };
    } catch (error) {
      throw this.handleShipRocketError(error);
    }
  }

  async exchangeOrder(
    payload: ExchangeShimentDto,
  ): Promise<ExchangeShimentResult> {
    try {
      const res = await this.requestWithAuthRetry((headers) =>
        this.axiosInstance.post(`/orders/create/exchange`, payload, {
          headers,
        }),
      );

      if (res.status !== 201) {
        throw new BadRequestException(
          res.data?.message || 'Failed to create return order in Shiprocket',
        );
      }

      const response = res.data;

      if (!response) {
        throw new BadRequestException(
          'Invalid return order response structure from Shiprocket',
        );
      }

      return {
        forward_orders: response.forward_orders,
        return_orders: response.return_orders,
      };
    } catch (error) {
      throw this.handleShipRocketError(error);
    }
  }

  // NDR Collection (Get NDR Reasons, Get NDR details)
  async updateNDR(
    awb: string,
    payload: UpdateNdrDto,
  ): Promise<{ message: string }> {
    try {
      const res = await this.requestWithAuthRetry((headers) =>
        this.axiosInstance.post(`/ndr/${awb}/action`, payload, {
          headers,
        }),
      );

      if (res.status !== 200) {
        throw new BadRequestException(
          res.data?.message || 'Failed to convert to qc product in Shiprocket',
        );
      }

      return {
        message:
          res.data?.message ||
          'Product converted into qc product successfully in Shiprocket',
      };
    } catch (error) {
      throw this.handleShipRocketError(error);
    }
  }

  async getAllNdrReasons(
    query: AllNdrQueryDto,
  ): Promise<{ data: unknown[]; meta: ShirocketMeta }> {
    try {
      const res = await this.requestWithAuthRetry((headers) =>
        this.axiosInstance.get(`/ndr/all`, {
          headers,
          params: {
            page: query.page,
            per_page: query.limit,
            from: query.fromDate,
            to: query.lastDate,
            search: query.search,
          },
        }),
      );

      if (res.status !== 200) {
        throw new BadRequestException(
          res.data?.message || 'Failed to fetch NDR reasons from Shiprocket',
        );
      }

      const result = res.data;

      return {
        data: result.data || [],
        meta: result.meta || {},
      };
    } catch (error) {
      throw this.handleShipRocketError(error);
    }
  }

  async getSpecificNdrReasons(
    awb: string,
  ): Promise<{ data: unknown[]; meta: ShirocketMeta }> {
    try {
      const res = await this.requestWithAuthRetry((headers) =>
        this.axiosInstance.get(`/ndr/${awb}`, {
          headers,
        }),
      );

      if (res.status !== 200) {
        throw new BadRequestException(
          res.data?.message || 'Failed to fetch NDR details from Shiprocket',
        );
      }

      const result = res.data;

      return {
        data: result.data || [],
        meta: result.meta || {},
      };
    } catch (error) {
      throw this.handleShipRocketError(error);
    }
  }

  // Orders Collection (Create Order, Get Orders, Get Specific Order)
  async createShipment(
    payload: TransportShipmentOrderIDPayload,
  ): Promise<TransportShipmentOrderIDResult> {
    try {
      const cleanedPayload = this.stripUndefinedValues(payload);

      const response = await this.requestWithAuthRetry((headers) =>
        this.axiosInstance.post(`/orders/create/adhoc`, cleanedPayload, {
          headers,
        }),
      );

      const result = response.data;

      if (!result) {
        throw new BadRequestException('Failed to create order in Shiprocket');
      }

      console.log('Shipment created with response:', result);
      return {
        order_id: result.order_id,
        channel_order_id: result.channel_order_id,
        shipment_id: result.shipment_id,
        status: result.status,
        status_code: 1,
        onboarding_completed_now: result.onboarding_completed_now,
        awb_code: result.awb_code,
        courier_company_id: result.courier_company_id,
        courier_name: result.courier_name,
        new_channel: result.new_channel,
        packaging_box_errord: result.packaging_box_errord,
      };
    } catch (error) {
      throw this.handleShipRocketError(error);
    }
  }

  // async createShipmentWithChannel(
  //   payload: CreateShipmentChannelDto,
  // ): Promise<TransportShipmentOrderIDResult> {
  //   try {
  //     const invoiceDetails = await this.invoiceModel
  //       .findOne({ orderNumber })
  //       .populate({
  //         path: 'items.productId',
  //         select: 'price',
  //       })
  //       .populate({
  //         path: 'items.variantId',
  //         select: 'price',
  //       });

  //     if (!invoiceDetails) {
  //       throw new NotFoundException(
  //         `Invoice not found for order number: ${orderNumber}`,
  //       );
  //     }

  //     const items = invoiceDetails.items.map((item, index) => {
  //       return {
  //         name: item.title,
  //         sku: item.sku,
  //         units: item.quantity,
  //         selling_price: Number(item.unitPrice),
  //         ...(item.discount !== 0 ? { discount: item.discount } : {}),
  //         tax: 18, // default tax percentage (can be dynamic based on item.gstRate)
  //         hsn: Number(item.hsnCode || '85171300'),
  //       };
  //     });

  //     const cleanedPayload = this.stripUndefinedValues(payload);

  //     const response = await this.requestWithAuthRetry((headers) =>
  //       this.axiosInstance.post(`/orders/create`, cleanedPayload, {
  //         headers,
  //       }),
  //     );

  //     const result = response.data;

  //     if (!result) {
  //       throw new BadRequestException('Failed to create order in Shiprocket');
  //     }

  //     return {
  //       order_id: result.order_id,
  //       shipment_id: result.shipment_id,
  //       status: result.status,
  //       status_code: result.status_code,
  //     };
  //   } catch (error) {
  //     throw this.handleShipRocketError(error);
  //   }
  // }

  async getOrders(query: GetOrdersQueryDto): Promise<GetShipmentOrdersResult> {
    try {
      const res = await this.requestWithAuthRetry((headers) =>
        this.axiosInstance.get(`/orders`, {
          headers,
          params: {
            page: query.page,
            per_page: query.limit,
            sort: query.order === OrderType.ASC ? 'ASC' : 'DESC',
            sort_by: query.sort_by,
            from: query.fromDate,
            to: query.lastDate,
            filter_by: query.filter_by,
            filter: query.filter,
            search: query.search,
            pickup_location: query.pickup_location,
            channel_id: query.channel_id,
            fbs: query.fbs,
            fbs_all_orders: query.fbs_all_orders,

            // page: query.page,
            // per_page: query.per_page,
          },
        }),
      );

      return res.data;
    } catch (error) {
      throw this.handleShipRocketError(error);
    }
  }

  async getOrder(order_id: string): Promise<GetShipmentOrderResult> {
    try {
      // await this.authenticate();

      const res = await this.requestWithAuthRetry((headers) =>
        this.axiosInstance.get(`/orders/show/${order_id}`, {
          headers,
        }),
      );

      const result = res.data.data;

      if (!result) {
        throw new NotFoundException(
          `Order with id ${order_id} not found in Shiprocket`,
        );
      }

      return result;
    } catch (error) {
      throw this.handleShipRocketError(error);
    }
  }

  async exportOrders(): Promise<ExportOrdersResult> {
    try {
      const res = await this.requestWithAuthRetry((headers) =>
        this.axiosInstance.post(
          `/orders/export`,
          {},
          {
            headers: {
              ...headers,
              'Content-Type': 'application/json',
            },
          },
        ),
      );

      if (res.status !== 200) {
        throw new BadRequestException(
          res.data?.message || 'Failed to export orders in Shiprocket',
        );
      }

      const result = res.data;

      if (!result) {
        throw new NotFoundException(
          `Orders not found for export in Shiprocket`,
        );
      }

      return result;
    } catch (error) {
      throw this.handleShipRocketError(error);
    }
  }

  // Account (Wallet Balance) Collection
  async getWalletBalance(): Promise<{ balance_amount: string | number }> {
    try {
      const res = await this.requestWithAuthRetry((headers) =>
        this.axiosInstance.get(`/account/details/wallet-balance`, {
          headers,
        }),
      );

      const result = res.data.data;

      if (!result) {
        throw new NotFoundException(
          res.data?.message ||
            `Wallet balance not found in Shiprocket account details response`,
        );
      }

      return {
        balance_amount: result.balance_amount,
      };
    } catch (error) {
      throw this.handleShipRocketError(error);
    }
  }

  // Products Collection (Get Products, Get Specific Product)
  async addNewProduct(payload: AddNewProductDto): Promise<AddProductResult> {
    try {
      const res = await this.requestWithAuthRetry((headers) =>
        this.axiosInstance.post(`/products`, payload, {
          headers,
        }),
      );

      if (res.status !== 201) {
        throw new BadRequestException(
          res.data?.message || 'Failed to add new product in Shiprocket',
        );
      }

      return {
        success: true,
        message:
          res.data?.message || 'Product added successfully in Shiprocket',
      };
    } catch (error) {
      throw this.handleShipRocketError(error);
    }
  }

  async convertToQcProduct(
    productID: string,
    payload: ConvertToQcDto,
  ): Promise<ConvertToQCProductResult> {
    try {
      const res = await this.requestWithAuthRetry((headers) =>
        this.axiosInstance.post(
          `/products/qc-product-update/${productID}`,
          payload,
          {
            headers,
          },
        ),
      );

      if (res.status !== 200) {
        throw new BadRequestException(
          res.data?.message || 'Failed to convert to qc product in Shiprocket',
        );
      }

      return {
        success: true,
        message:
          res.data?.message ||
          'Product converted into qc product successfully in Shiprocket',
      };
    } catch (error) {
      throw this.handleShipRocketError(error);
    }
  }

  async getProducts(
    query: ShipmentProductQueryDto,
  ): Promise<GetAllProductsResult> {
    try {
      const res = await this.requestWithAuthRetry((headers) =>
        this.axiosInstance.get(`/products`, {
          headers,
          params: {
            page: query.page,
            per_page: query.limit,
            from: query.fromDate,
            to: query.lastDate,
            sort: query.order === OrderType.ASC ? 'ASC' : 'DESC',
            sort_by: query.sortBy,
            filter: query.filter,
            filter_by: query.filter_by,
          },
        }),
      );
      const result = res.data;

      if (res.status !== 200 || !result) {
        throw new NotFoundException(
          res.data?.message ||
            `Product not found in Shiprocket account details response`,
        );
      }

      return result;
    } catch (error) {
      throw this.handleShipRocketError(error);
    }
  }

  async getProduct(product_id: string): Promise<GetProductResult> {
    try {
      const res = await this.requestWithAuthRetry((headers) =>
        this.axiosInstance.get(`/products/show/${product_id}`, {
          headers,
        }),
      );
      const result = res.data.data;

      if (res.status !== 200 || !result) {
        throw new NotFoundException(
          res.data?.message ||
            `Product not found with ${product_id} in Shiprocket account details response`,
        );
      }

      return result;
    } catch (error) {
      throw this.handleShipRocketError(error);
    }
  }

  // Channels (GetChannels) Collection
  async getChannels(): Promise<GetChannelsResult[]> {
    try {
      const res = await this.requestWithAuthRetry((headers) =>
        this.axiosInstance.get(`/channels`, {
          headers,
        }),
      );

      if (res.status !== 200) {
        throw new NotFoundException(
          res.data?.message || 'Channels not found in Shiprocket response',
        );
      }

      const result = res.data;

      return result.data as GetChannelsResult[];
    } catch (error) {
      throw this.handleShipRocketError(error);
    }
  }

  // Inventory (GetInventories, Update Inventory) Collection
  async updatetInventory(
    product_id: string,
    payload: UpdateInventoryDto,
  ): Promise<UpdateInventoryResult> {
    try {
      const res = await this.requestWithAuthRetry((headers) =>
        this.axiosInstance.put(`/inventory/${product_id}/update`, payload, {
          headers,
        }),
      );

      if (res.status !== 200) {
        throw new NotFoundException(
          'Inventory updation failed in Shiprocket response',
        );
      }

      const result = res.data.data;

      return result as UpdateInventoryResult;
    } catch (error) {
      throw this.handleShipRocketError(error);
    }
  }

  async getInventory(query: InventoryQueryDto): Promise<GetInventoryResult> {
    try {
      const res = await this.requestWithAuthRetry((headers) =>
        this.axiosInstance.get(`/inventory`, {
          headers,
          params: {
            page: query.page,
            per_page: query.limit,
            sort: query.order === OrderType.ASC ? 'ASC' : 'DESC',
            sort_by: query.sortBy,
          },
        }),
      );

      if (res.status !== 200) {
        throw new NotFoundException(
          res.data?.message || 'Inventory not found in Shiprocket response',
        );
      }

      const result = res.data;

      return {
        data: result.data,
        meta: result.meta,
      };
    } catch (error) {
      throw this.handleShipRocketError(error);
    }
  }

  // Countries Collection (Contries, Zones, Localities)
  async getCountryCodes(): Promise<GetCountryResult[]> {
    try {
      const res = await this.requestWithAuthRetry((headers) =>
        this.axiosInstance.get(`/countries`, {
          headers,
        }),
      );

      const result = res.data;

      if (result.status !== 200 || !result.data) {
        throw new NotFoundException(
          res.data?.message || `Country codes not found in Shiprocket response`,
        );
      }

      return result.data as GetCountryResult[];
    } catch (error) {
      throw this.handleShipRocketError(error);
    }
  }

  async getAllZones(country_id: string): Promise<GetZoneResult[]> {
    try {
      const res = await this.requestWithAuthRetry((headers) =>
        this.axiosInstance.get(`/countries/show/${country_id}`, {
          headers,
        }),
      );

      const result = res.data;

      if (result.status !== 200 || !result.data) {
        throw new NotFoundException(
          res.data?.message ||
            `Zones not found for country_id ${country_id} in Shiprocket response`,
        );
      }

      return result.data as GetZoneResult[];
    } catch (error) {
      throw this.handleShipRocketError(error);
    }
  }

  async getLocalityDetails(postcode: string): Promise<GetLocalityResult> {
    try {
      const res = await this.requestWithAuthRetry((headers) =>
        this.axiosInstance.get(`/open/postcode/details`, {
          headers,
          params: { postcode },
        }),
      );

      const result = res.data;

      if (!result.success) {
        throw new NotFoundException(
          res.data?.message ||
            `Locality details not found for postcode ${postcode} in Shiprocket response`,
        );
      }

      return result;
    } catch (error) {
      throw this.handleShipRocketError(error);
    }
  }

  // Statements Collection
  async getStatement(
    query: GetStatementsQueryDto,
  ): Promise<GetStatementResult[]> {
    try {
      const res = await this.requestWithAuthRetry((headers) =>
        this.axiosInstance.get(`/account/details/statement`, {
          headers,
          params: {
            page: query.page,
            per_page: query.limit,
            from: query.fromDate,
            to: query.lastDate,
            sort:
              query.order === OrderType.ASC ? OrderType.ASC : OrderType.DESC,
          },
        }),
      );
      const result = res.data.data;

      if (res.status !== 200 || !result) {
        throw new NotFoundException(
          res.data?.message ||
            `Statement not found in Shiprocket account details response`,
        );
      }

      return result;
    } catch (error) {
      throw this.handleShipRocketError(error);
    }
  }

  // Descrepancy Collection
  async getDiscrepancy(): Promise<GetDiscrepancyResult> {
    try {
      const res = await this.requestWithAuthRetry((headers) =>
        this.axiosInstance.get(`/billing/discrepancy`, {
          headers,
        }),
      );

      const result = res.data;

      if (result.status !== 200) {
        throw new NotFoundException(
          res.data?.message ||
            `Descrepancy data not found in Shiprocket billing discrepancy response`,
        );
      }

      return {
        data: result.data,
        upper_fold_text: result.upper_fold_text,
        lower_fild_text: result.lower_fild_text,
      };
    } catch (error) {
      throw this.handleShipRocketError(error);
    }
  }

  // File Imports Collection
  async getImportResults(import_id: string): Promise<GetImportResult> {
    try {
      const res = await this.requestWithAuthRetry((headers) =>
        this.axiosInstance.get(`/errors/${import_id}/check`, {
          headers,
        }),
      );

      const result = res.data.data;

      if (!result) {
        throw new NotFoundException(
          res.data?.message ||
            `Import results not found for importId ${import_id} in Shiprocket`,
        );
      }

      return {
        status: result.status,
        message: result.message,
      };
    } catch (error) {
      throw this.handleShipRocketError(error);
    }
  }
}
