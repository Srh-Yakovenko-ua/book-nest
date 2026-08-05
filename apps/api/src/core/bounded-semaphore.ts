import type { Nullable } from "@app/shared";

export type BoundedSemaphoreOptions = {
  name: string;
  permits: number;
  waitQueueLimit: number;
};

export type ReleasePermit = () => void;

type PermitWaiter = {
  readonly rejectWait: (error: Error) => void;
  readonly resolveWait: (release: ReleasePermit) => void;
  waitTimer: Nullable<ReturnType<typeof setTimeout>>;
};

export class BoundedSemaphore {
  private permitsInUse = 0;
  private readonly waiters: PermitWaiter[] = [];

  constructor(private readonly options: BoundedSemaphoreOptions) {}

  acquire({ timeoutMs }: { timeoutMs?: number } = {}): Promise<ReleasePermit> {
    if (this.permitsInUse < this.options.permits) {
      this.permitsInUse += 1;
      return Promise.resolve(this.createSingleUseRelease());
    }
    if (this.waiters.length >= this.options.waitQueueLimit) {
      return Promise.reject(new SemaphoreWaitQueueFullError(this.options.name));
    }
    return new Promise<ReleasePermit>((resolveWait, rejectWait) => {
      const waiter: PermitWaiter = { rejectWait, resolveWait, waitTimer: null };
      if (timeoutMs !== undefined) {
        waiter.waitTimer = setTimeout(() => {
          this.forgetWaiter(waiter);
          rejectWait(new SemaphoreWaitTimeoutError(this.options.name));
        }, timeoutMs);
      }
      this.waiters.push(waiter);
    });
  }

  async run<T>({ task, timeoutMs }: { task: () => Promise<T>; timeoutMs?: number }): Promise<T> {
    const release = await this.acquire({ timeoutMs });
    try {
      return await task();
    } finally {
      release();
    }
  }

  private createSingleUseRelease(): ReleasePermit {
    let hasReleased = false;
    return () => {
      if (hasReleased) {
        return;
      }
      hasReleased = true;
      this.handOverPermit();
    };
  }

  private forgetWaiter(waiter: PermitWaiter): void {
    const index = this.waiters.indexOf(waiter);
    if (index !== -1) {
      this.waiters.splice(index, 1);
    }
  }

  private handOverPermit(): void {
    const nextWaiter = this.waiters.shift();
    if (nextWaiter === undefined) {
      this.permitsInUse -= 1;
      return;
    }
    if (nextWaiter.waitTimer !== null) {
      clearTimeout(nextWaiter.waitTimer);
    }
    nextWaiter.resolveWait(this.createSingleUseRelease());
  }
}

export abstract class SemaphoreUnavailableError extends Error {
  readonly semaphoreName: string;

  protected constructor({ message, semaphoreName }: { message: string; semaphoreName: string }) {
    super(message);
    this.semaphoreName = semaphoreName;
  }
}

export class SemaphoreWaitQueueFullError extends SemaphoreUnavailableError {
  constructor(semaphoreName: string) {
    super({ message: `${semaphoreName} wait queue is full`, semaphoreName });
    this.name = "SemaphoreWaitQueueFullError";
  }
}

export class SemaphoreWaitTimeoutError extends SemaphoreUnavailableError {
  constructor(semaphoreName: string) {
    super({ message: `${semaphoreName} wait timed out`, semaphoreName });
    this.name = "SemaphoreWaitTimeoutError";
  }
}
