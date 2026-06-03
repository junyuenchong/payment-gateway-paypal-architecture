# Payment gateway (PayPal & mock)

Thin adapter around **checkout, capture, and mock webhook delivery**. Domain code in `modules/payment/` should call through `PaymentService` and `PaymentGatewayService`, not import PayPal details everywhere.

```text
payment-gateway/
├── dto/payment-gateway.dto.ts
├── helpers/payment-gateway.helper.ts
├── payment-gateway.service.ts
├── payment-gateway.controller.ts
└── payment-gateway.module.ts
```

**Mock mode** (`MOCK_PAYMENT_GATEWAY=true`): no real PayPal UI; the service simulates approval and can fire a signed mock webhook after a delay.

**Live mode:** uses sandbox/production credentials from `AppConfigService` / `.env`.

No CQRS in this folder — controllers and payment module call the service directly.
