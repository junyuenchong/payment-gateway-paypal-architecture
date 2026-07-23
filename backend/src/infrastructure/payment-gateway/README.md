# Payment gateway (PayPal & mock)

Thin adapter around **checkout, capture, and mock webhook delivery**. Domain code should call `PaymentService` / `PaymentGatewayService`, not PayPal details directly.

```text
payment-gateway/
├── contracts/payment-gateway.port.ts   # PaymentGatewayPort interface
├── gateways/
│   ├── paypal.gateway.ts               # Live / sandbox PayPal
│   └── mock.gateway.ts                 # Local mock (no PayPal UI)
├── dto/
├── helpers/
├── payment-gateway.service.ts          # Facade over active port
├── payment-gateway.controller.ts
└── payment-gateway.module.ts
```

`PaymentGatewayModule` binds `PAYMENT_GATEWAY_PORT` to Mock or PayPal from `MOCK_PAYMENT_GATEWAY`.

Both adapters implement the same port:

- `createCheckoutOrder`
- `captureCheckoutOrder`
- `getCheckoutOrderStatus`
- `deliverMockCaptureSuccess` (Mock only; PayPal rejects)

No CQRS in this folder — controllers and payment module call the service directly.
