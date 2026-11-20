export const NOTICE_QUEUE = 'notice';

export const NOTICE_JOB = {
  SEND_GLOBAL: 'send-global-notice',
  SEND_FRANCHISE: 'send-franchise-notice',
};

export const NOTICE_QUEUE_DEFAULTS = {
  attempts: 5,
  backoff: { type: 'exponential', delay: 2000 },
};
