import { PaymentProcessor } from './payment.processor';

export const createProcessorMap = (paymentProcessor: PaymentProcessor) => ({
  'settle-payment': paymentProcessor,
  'refund-payment': paymentProcessor,
});
