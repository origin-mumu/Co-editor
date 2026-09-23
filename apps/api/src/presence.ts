import type { UserPresence } from '@co-editor/shared';

// Apple iOS 风格高质感协作者光标色彩阶梯
const COLLAB_COLORS = [
  '#3E6FDC', // iOS 科技蓝
  '#34C759', // iOS 经典绿
  '#FF9500', // iOS 暖橙
  '#AF52DE', // iOS 优雅紫
  '#FF2D55', // iOS 绯红
  '#5856D6', // iOS 靛青
  '#00C7BE', // iOS 浅青
  '#FF3B30'  // iOS 珊瑚红
];

/**
 * 协作者在线状态管理器
 */
export class PresenceManager {
  private users = new Map<string, UserPresence>();
  private readonly heartbeatTimeoutMs: number;

  constructor(heartbeatTimeoutMs = 15000) {
    this.heartbeatTimeoutMs = heartbeatTimeoutMs;
  }

  /**
   * 注册新用户进入
   */
  public join(clientId: string, username?: string): UserPresence {
    const existing = this.users.get(clientId);
    if (existing) {
      existing.lastSeen = Date.now();
      return existing;
    }

    const color = COLLAB_COLORS[this.users.size % COLLAB_COLORS.length];
    const user: UserPresence = {
      clientId,
      username: username || `协作者 ${clientId.slice(-4)}`,
      color,
      activeBlockId: null,
      cursorOffset: 0,
      lastSeen: Date.now()
    };

    this.users.set(clientId, user);
    return user;
  }

  /**
   * 更新用户光标与活动块
   */
  public update(
    clientId: string,
    data: Partial<Pick<UserPresence, 'activeBlockId' | 'cursorOffset' | 'username'>>
  ): UserPresence | null {
    const user = this.users.get(clientId);
    if (!user) return null;

    if (data.activeBlockId !== undefined) user.activeBlockId = data.activeBlockId;
    if (data.cursorOffset !== undefined) user.cursorOffset = data.cursorOffset;
    if (data.username !== undefined) user.username = data.username;
    user.lastSeen = Date.now();

    return { ...user };
  }

  /**
   * 用户离开
   */
  public leave(clientId: string): boolean {
    return this.users.delete(clientId);
  }

  /**
   * 获取当前全部活跃用户
   */
  public getActiveUsers(): UserPresence[] {
    this.cleanStale();
    return Array.from(this.users.values());
  }

  /**
   * 清理心跳超时的离线协作者
   */
  private cleanStale(): void {
    const now = Date.now();
    for (const [clientId, user] of this.users.entries()) {
      if (now - user.lastSeen > this.heartbeatTimeoutMs) {
        this.users.delete(clientId);
      }
    }
  }
}
