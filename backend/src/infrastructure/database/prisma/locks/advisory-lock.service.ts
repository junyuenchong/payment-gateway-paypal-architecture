import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

type Tx = Prisma.TransactionClient;

/** ----- PostgreSQL transaction-scoped advisory locks. ----- **/
@Injectable()
export class AdvisoryLockService {
  /** ----- Acquire pg_advisory_xact_lock for the rest of the transaction. ----- **/
  lockTransactionKey(tx: Tx, key: number): Promise<void> {
    return tx.$executeRaw`SELECT pg_advisory_xact_lock(${key})`.then(() => {});
  }

  /** ----- Hash string key to int32 for advisory lock APIs. ----- **/
  keyFromString(value: string): number {
    let hash = 0;
    for (let i = 0; i < value.length; i += 1) {
      hash = (hash << 5) - hash + value.charCodeAt(i);
      hash |= 0;
    }
    return hash;
  }
}
