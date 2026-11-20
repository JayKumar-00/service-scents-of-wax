import { CreditEventEnum } from '../enums/credit.enum';
import { PenaltyProcessor } from './penalty.processor';
import { ReminderProcessor } from './reminder.processor';
import { CreditAutoRefillProcessor } from './auto-refill.processor';
import { CreditPaymentProcessor } from './payment.processor';

export const createProcessorMap = (
  penaltyProcessor: PenaltyProcessor,
  reminderProcessor: ReminderProcessor,
  paymentProcessor: CreditPaymentProcessor,
  autoRefillProcessor: CreditAutoRefillProcessor,
) => ({
  [CreditEventEnum.CREDIT_PENALTY]: penaltyProcessor,
  [CreditEventEnum.CREDIT_REMINDER]: reminderProcessor,
  [CreditEventEnum.CREDIT_PAYMENT]: paymentProcessor,
  [CreditEventEnum.CREDIT_AUTO_REFILL]: autoRefillProcessor,
});
