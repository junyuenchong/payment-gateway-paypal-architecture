/** ----- Redis distributed lock token returned on acquire. ----- **/
export type LockHandle = {
  key: string;
  token: string;
};

/** ----- Internal module health response. ----- **/
export type LocksStatusDto = {
  ok: true;
  module: 'locks';
};
