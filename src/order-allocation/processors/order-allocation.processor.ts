import { Injectable, Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import {
  ORDER_ALLOCATION_JOB,
  ORDER_ALLOCATION_QUEUE,
} from '../constants/order-allocation.constants';
import { OrderAllocationService } from '../services/order-allocation.service';

@Processor(ORDER_ALLOCATION_QUEUE)
@Injectable()
export class OrderAllocationProcessor extends WorkerHost {
  private readonly logger = new Logger(OrderAllocationProcessor.name);

  constructor(private readonly allocationService: OrderAllocationService) {
    super();
  }

  async process(job: Job<any>): Promise<any> {
    try {
      switch (job.name) {
        case ORDER_ALLOCATION_JOB.ALLOCATE_REQUEST:
          return this.allocationService.processAllocationRequest(
            job.data.requestId,
          );
        case ORDER_ALLOCATION_JOB.EXPIRE_PROPOSAL:
          return this.allocationService.expireProposal(job.data.proposalId);
        case ORDER_ALLOCATION_JOB.EXPIRE_RESERVATION:
          return this.allocationService.expireReservation(
            job.data.reservationId,
          );
        case ORDER_ALLOCATION_JOB.EXPIRE_ONLINE_PAYMENT:
          return this.allocationService.expireOnlinePayment(job.data.orderId);
        default:
          this.logger.warn(`Unknown job received: ${job.name}`);
          return null;
      }
    } catch (error) {
      this.logger.error(
        `Allocation job failed (${job.name}): ${(error as Error).message}`,
      );
      throw error;
    }
  }
}
