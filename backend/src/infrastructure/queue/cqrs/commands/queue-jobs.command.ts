/** ----- Handle queue jobs.command ----- **/
import type {
  CapturePaymentJob,
  CreatePaymentIntentJob,
  ExpireOrdersSweepJob,
  ExpireReservationsSweepJob,
  ExpireUnpaidOrdersSweepJob,
  MockCaptureSuccessJob,
  ProcessWebhookJob,
  ReconcileOrdersSweepJob,
} from '../../dto/queue-job.dto';

/** ----- Handle creat aymen nten o ommand class ----- **/
export class CreatePaymentIntentJobCommand {
  /** ----- Handle constructor dependency wiring ----- **/
  constructor(public readonly data: CreatePaymentIntentJob) {}
}

/** ----- Handle captur aymen o ommand class ----- **/
export class CapturePaymentJobCommand {
  /** ----- Handle constructor dependency wiring ----- **/
  constructor(public readonly data: CapturePaymentJob) {}
}

/** ----- Handle proces ebhoo o ommand class ----- **/
export class ProcessWebhookJobCommand {
  /** ----- Handle constructor dependency wiring ----- **/
  constructor(public readonly data: ProcessWebhookJob) {}
}

/** ----- Handle expir rder wee o ommand class ----- **/
export class ExpireOrdersSweepJobCommand {
  /** ----- Handle constructor dependency wiring ----- **/
  constructor(public readonly data: ExpireOrdersSweepJob) {}
}

/** ----- Handle moc aptur ucces o ommand class ----- **/
export class MockCaptureSuccessJobCommand {
  /** ----- Handle constructor dependency wiring ----- **/
  constructor(public readonly data: MockCaptureSuccessJob) {}
}

/** ----- Handle reconcil rder wee o ommand class ----- **/
export class ReconcileOrdersSweepJobCommand {
  /** ----- Handle constructor dependency wiring ----- **/
  constructor(public readonly data: ReconcileOrdersSweepJob) {}
}

/** ----- Handle expir eservatio wee o ommand class ----- **/
export class ExpireReservationsSweepJobCommand {
  constructor(public readonly data: ExpireReservationsSweepJob) {}
}

/** ----- Handle expir npai rder wee o ommand class ----- **/
export class ExpireUnpaidOrdersSweepJobCommand {
  constructor(public readonly data: ExpireUnpaidOrdersSweepJob) {}
}
