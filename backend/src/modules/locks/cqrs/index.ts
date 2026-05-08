import { ReleaseLockHandler } from '../application/handlers/release-lock.handler';
import { TryAcquireLockHandler } from '../application/handlers/try-acquire-lock.handler';

export const CommandHandlers = [TryAcquireLockHandler, ReleaseLockHandler];

export const QueryHandlers: never[] = [];
export const EventHandlers: never[] = [];
