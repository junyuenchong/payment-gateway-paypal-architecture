import { Global, Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { EventBusController } from './event-bus.controller';
import { EventBusRepository } from './event-bus.repository';

/** ----- Configure CQRS wrapper module. ----- **/
@Global()
@Module({
  imports: [CqrsModule],
  controllers: [EventBusController],
  providers: [EventBusRepository],
  exports: [CqrsModule],
})
/** ----- Handle even u odule class ----- **/
export class EventBusModule {}
