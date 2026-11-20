import { BadRequestException } from '@nestjs/common';
import { ReturnStatus, ReturnSourceType, ReturnType } from '@prisma/client';

export class ReturnsWorkflowValidator {
  /**
   * Validates if a transition from currentStatus to nextStatus is allowed.
   * Throws a BadRequestException if the transition is invalid.
   */
  static validateStatusTransition(
    currentStatus: ReturnStatus,
    nextStatus: ReturnStatus,
    sourceType: ReturnSourceType,
    returnType: ReturnType,
  ): void {
    if (currentStatus === nextStatus) {
      return; // No-op is valid
    }

    const allowedTransitions = this.getAllowedTransitions(
      currentStatus,
      sourceType,
      returnType,
    );

    if (!allowedTransitions.includes(nextStatus)) {
      throw new BadRequestException(
        `Invalid status transition from "${currentStatus}" to "${nextStatus}" for source type "${sourceType}" and return type "${returnType}".`,
      );
    }
  }

  private static getAllowedTransitions(
    currentStatus: ReturnStatus,
    sourceType: ReturnSourceType,
    returnType: ReturnType,
  ): ReturnStatus[] {
    if (sourceType === ReturnSourceType.CUSTOMER_ORDER) {
      switch (currentStatus) {
        case ReturnStatus.REQUESTED:
          return [ReturnStatus.APPROVED, ReturnStatus.REJECTED];
        case ReturnStatus.APPROVED:
          return [
            ReturnStatus.PICKUP_SCHEDULED,
            ReturnStatus.RECEIVED_AT_FRANCHISE,
            ReturnStatus.REJECTED,
          ];
        case ReturnStatus.PICKUP_SCHEDULED:
          return [ReturnStatus.PICKUP_COMPLETED, ReturnStatus.REJECTED];
        case ReturnStatus.PICKUP_COMPLETED:
          return [ReturnStatus.RECEIVED_AT_FRANCHISE];
        case ReturnStatus.RECEIVED_AT_FRANCHISE:
          return [ReturnStatus.UNDER_INSPECTION];
        case ReturnStatus.UNDER_INSPECTION:
          return [
            ReturnStatus.QC_PASSED,
            ReturnStatus.QC_FAILED,
            ReturnStatus.QC_CONFLICT,
          ];
        case ReturnStatus.QC_PASSED:
          if (returnType === ReturnType.REFUND) {
            return [
              ReturnStatus.CREDIT_NOTE_GENERATED,
              ReturnStatus.REFUND_PROCESSED,
            ];
          } else if (
            returnType === ReturnType.EXCHANGE ||
            returnType === ReturnType.SAME_PRODUCT_EXCHANGE
          ) {
            return [ReturnStatus.EXCHANGE_ORDER_CREATED];
          } else {
            return [ReturnStatus.CLOSED];
          }
        case ReturnStatus.CREDIT_NOTE_GENERATED:
          return [ReturnStatus.REFUND_PROCESSED];
        case ReturnStatus.REFUND_PROCESSED:
          return [ReturnStatus.CLOSED];
        case ReturnStatus.EXCHANGE_ORDER_CREATED:
          return [ReturnStatus.EXCHANGE_ORDER_DELIVERED, ReturnStatus.CLOSED]; // allow close or delivery
        case ReturnStatus.EXCHANGE_ORDER_DELIVERED:
          return [ReturnStatus.CLOSED];
        case ReturnStatus.QC_FAILED:
        case ReturnStatus.QC_CONFLICT:
        case ReturnStatus.REJECTED:
          return [ReturnStatus.CLOSED];
        case ReturnStatus.CLOSED:
        default:
          return [];
      }
    } else if (sourceType === ReturnSourceType.STOCK_REQUEST) {
      switch (currentStatus) {
        case ReturnStatus.REQUESTED:
          return [ReturnStatus.APPROVED, ReturnStatus.REJECTED];
        case ReturnStatus.APPROVED:
          return [
            ReturnStatus.IN_TRANSIT_TO_WAREHOUSE,
            ReturnStatus.RECEIVED_AT_WAREHOUSE,
            ReturnStatus.REJECTED,
          ];
        case ReturnStatus.IN_TRANSIT_TO_WAREHOUSE:
          return [ReturnStatus.RECEIVED_AT_WAREHOUSE];
        case ReturnStatus.RECEIVED_AT_WAREHOUSE:
          return [ReturnStatus.UNDER_INSPECTION];
        case ReturnStatus.UNDER_INSPECTION:
          return [
            ReturnStatus.QC_PASSED,
            ReturnStatus.QC_FAILED,
            ReturnStatus.QC_CONFLICT,
            ReturnStatus.WAREHOUSE_QC,
          ];
        case ReturnStatus.WAREHOUSE_QC:
          return [ReturnStatus.CLOSED];
        case ReturnStatus.QC_PASSED:
        case ReturnStatus.QC_FAILED:
        case ReturnStatus.QC_CONFLICT:
        case ReturnStatus.REJECTED:
          return [ReturnStatus.CLOSED];
        case ReturnStatus.CLOSED:
        default:
          return [];
      }
    }

    return [];
  }
}
