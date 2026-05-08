/** ----- Handle lock.command ----- **/
export type LockHandle = {
  key: string;
  token: string;
};

/** ----- Handle tr cquir oc ommand class ----- **/
export class TryAcquireLockCommand {
  constructor(
    public readonly key: string,
    public readonly ttlMs: number,
  ) {}
}

/** ----- Handle releas oc ommand class ----- **/
export class ReleaseLockCommand {
  /** ----- Handle constructor dependency wiring ----- **/
  constructor(public readonly lock: LockHandle) {}
}
