import { Injectable } from "@nestjs/common";

import { REALTIME_ADMISSION } from "../domain/realtime-admission.js";

@Injectable()
export class RealtimeConnectionRegistry {
  private readonly connectionsBySourceAddress = new Map<string, number>();
  private pendingConnections = 0;

  release(sourceAddress: string): void {
    const current = this.connectionsBySourceAddress.get(sourceAddress);
    if (current === undefined) {
      return;
    }
    this.pendingConnections -= 1;
    if (current <= 1) {
      this.connectionsBySourceAddress.delete(sourceAddress);
      return;
    }
    this.connectionsBySourceAddress.set(sourceAddress, current - 1);
  }

  tryAcquire(sourceAddress: string): boolean {
    if (this.pendingConnections >= REALTIME_ADMISSION.maxPendingConnections) {
      return false;
    }
    const current = this.connectionsBySourceAddress.get(sourceAddress) ?? 0;
    if (current >= REALTIME_ADMISSION.maxConnectionsPerSourceAddress) {
      return false;
    }
    this.connectionsBySourceAddress.set(sourceAddress, current + 1);
    this.pendingConnections += 1;
    return true;
  }
}
