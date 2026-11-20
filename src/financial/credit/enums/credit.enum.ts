export enum AdjustmentEnum {
  ADJUSTMENT = 'ADJUSTMENT',
  PENALTY = 'PENALTY',
}

export enum ReferenceTypeEnum {
  ORDER = 'ORDER',
  STOCK_REQUEST = 'STOCK_REQUEST',
}

export enum PaymentModeEnum {
  ONLINE = 'ONLINE',
  CASH = 'CASH',
}

export enum OnlinePaymentModeEnum {
  CARD = 'CARD',
  UPI = 'UPI',
  NETBANKING = 'NETBANKING',
}

export enum CreditEventEnum {
  CREDIT_PENALTY = 'CREDIT_PENALTY',
  CREDIT_REMINDER = 'CREDIT_REMINDER',
  CREDIT_LIMIT_EVALUATION = 'CREDIT_LIMIT_EVALUATION',
  CREDIT_PAYMENT = 'CREDIT_PAYMENT',
  CREDIT_AUTO_REFILL = 'CREDIT_AUTO_REFILL',
}
