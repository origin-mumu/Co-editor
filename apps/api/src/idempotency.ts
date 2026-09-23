import type { TxExecutionResult } from '@co-editor/shared';

/**
 * 事务幂等去重管理器
 * 防止因客户端超时重发或网络抖动导致同一事务被服务端重复执行
 */
export class IdempotencyManager {
  private cache = new Map<string, TxExecutionResult>();
  private readonly ttlMs: number;
  private readonly maxSize: number;

  constructor(ttlMs = 5 * 60 * 1000, maxSize = 5000) {
    this.ttlMs = ttlMs;
    this.maxSize = maxSize;
  }

  /**
   * 检查指定 txId 是否已被执行
   */
  public has(txId: string): boolean {
    this.cleanExpired();
    return this.cache.has(txId);
  }

  /**
   * 获取已执行事务的缓存结果
   */
  public get(txId: string): TxExecutionResult | undefined {
    return this.cache.get(txId);
  }

  /**
   * 记录已成功执行的事务
   */
  public record(txId: string, resultingVersion: number): void {
    if (this.cache.size >= this.maxSize) {
      // 达到容量上限时淘汰最旧的键
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) this.cache.delete(oldestKey);
    }

    this.cache.set(txId, {
      txId,
      success: true,
      resultingVersion,
      timestamp: Date.now()
    });
  }

  /**
   * 定期清理过期项
   */
  private cleanExpired(): void {
    const now = Date.now();
    for (const [txId, item] of this.cache.entries()) {
      if (now - item.timestamp > this.ttlMs) {
        this.cache.delete(txId);
      }
    }
  }

  /**
   * 清空缓存 (主要用于单测)
   */
  public clear(): void {
    this.cache.clear();
  }
}
