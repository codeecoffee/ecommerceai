import { SetMetadata } from '@nestjs/common';

export const OWNERSHIP_KEY = 'ownership';

export interface OwnershipConfig {
  resource: 'address' | 'post' | 'product' | 'order' | 'user'; //!TODO: extend as needed
  paramName?: string; // defaults to id
}

export const CheckOwnership = (config: OwnershipConfig) =>
  SetMetadata(OWNERSHIP_KEY, config);
