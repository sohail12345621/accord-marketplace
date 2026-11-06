import {
  NCEngine,
  DirectChannel,
  SendTextMessageParams,
  ConnectionStatusHandler,
  MessageHandler,
  ChannelHandler,
  AreaCode,
  LogLevel,
} from '@nexconn/chat';
import { apiFetch } from './api';

export type NexconnConnectionState =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'fallback_local'
  | 'disconnected'
  | 'error';

type MessageCallback = (msg: any) => void;
type TypingCallback = (data: { channelId: string; userId: string }) => void;
type StatusCallback = (status: NexconnConnectionState, detail?: string) => void;

class NexconnManager {
  private static instance: NexconnManager;
  private initialized = false;
  private connected = false;
  private currentChatId: string | null = null;
  private state: NexconnConnectionState = 'idle';

  private messageListeners = new Set<MessageCallback>();
  private typingListeners = new Set<TypingCallback>();
  private statusListeners = new Set<StatusCallback>();

  private constructor() {}

  public static getInstance(): NexconnManager {
    if (!NexconnManager.instance) {
      NexconnManager.instance = new NexconnManager();
    }
    return NexconnManager.instance;
  }

  public getState(): NexconnConnectionState {
    return this.state;
  }

  public getCurrentChatId(): string | null {
    return this.currentChatId;
  }

  private setState(newState: NexconnConnectionState, detail?: string) {
    this.state = newState;
    this.statusListeners.forEach((cb) => cb(newState, detail));
  }

  public subscribeStatus(cb: StatusCallback): () => void {
    this.statusListeners.add(cb);
    cb(this.state);
    return () => this.statusListeners.delete(cb);
  }

  public subscribeMessages(cb: MessageCallback): () => void {
    this.messageListeners.add(cb);
    return () => this.messageListeners.delete(cb);
  }

  public subscribeTyping(cb: TypingCallback): () => void {
    this.typingListeners.add(cb);
    return () => this.typingListeners.delete(cb);
  }

  /**
   * Safe centralized connection flow:
   * 1. Query secure backend endpoint /api/chat/token for current user
   * 2. If already connected as a different user, disconnect first
   * 3. Register handlers before connecting
   */
  public async initAndConnect(): Promise<void> {
    try {
      console.log('[NEXCONN_CONNECT] Requesting chat token from Accord backend');
      const res = await apiFetch<{
        enabled: boolean;
        app_key?: string;
        appKey?: string;
        token?: string;
        user_id?: string;
        userId?: string;
        area?: string;
        mode: string;
      }>('/chat/token');

      const userId = res.userId || res.user_id || '';
      const appKey = (import.meta.env.VITE_NEXCONN_APP_KEY as string | undefined)?.trim() || res.appKey || res.app_key;

      // If user switched, disconnect old session first
      if (this.currentChatId && this.currentChatId !== userId) {
        console.log('[NEXCONN_USER_SWITCH] Disconnecting previous chat ID:', this.currentChatId);
        await this.disconnect();
      }

      this.currentChatId = userId;

      if (!res.enabled || !appKey || !res.token) {
        console.info('[NEXCONN_CONNECT] Server running local transport fallback mode for user:', userId);
        this.setState('fallback_local', res.mode);
        return;
      }

      if (this.connected) {
        return;
      }

      this.setState('connecting');

      // Initialize SDK once
      if (!this.initialized) {
        try {
          const areaCode = res.area === 'NA' ? AreaCode.NA : AreaCode.SG;
          NCEngine.initialize({
            appKey: appKey,
            areaCode,
            logLevel: LogLevel.WARN,
          });
          this.initialized = true;

          NCEngine.addConnectionStatusHandler(
            'accord-conn-handler',
            new ConnectionStatusHandler({
              onConnectionStatusChanged: ({ status, code }) => {
                if (status === 0) {
                  this.connected = true;
                  this.setState('connected');
                } else if (status === 1) {
                  this.setState('connecting');
                } else {
                  this.connected = false;
                  this.setState('disconnected', `Status code: ${status} (${code})`);
                }
              },
            })
          );

          NCEngine.addMessageHandler(
            'accord-msg-handler',
            new MessageHandler({
              onMessageReceived: ({ messages }) => {
                messages.forEach((msg) => {
                  this.messageListeners.forEach((cb) => cb(msg));
                });
              },
            })
          );

          NCEngine.addChannelHandler(
            'accord-chan-handler',
            new ChannelHandler({
              onTypingStatusChanged: ({ channelIdentifier, userTypingStatus }) => {
                const typingUser = Array.isArray(userTypingStatus)
                  ? userTypingStatus[0]?.userId
                  : (userTypingStatus as any)?.userId;
                this.typingListeners.forEach((cb) =>
                  cb({
                    channelId: (channelIdentifier as any)?.targetId || '',
                    userId: typingUser || '',
                  })
                );
              },
            })
          );
        } catch (initErr) {
          console.warn('[Nexconn] Initialization warning:', initErr);
        }
      }

      // Connect with current user token
      const connectRes = await NCEngine.connect({ token: res.token });
      if (connectRes.isOk || connectRes.code === 0) {
        this.connected = true;
        this.setState('connected');
        console.log('[NEXCONN_CONNECT] Connected successfully for user ID:', connectRes.data?.userId);
      } else {
        this.setState('fallback_local', `Code ${connectRes.code}`);
      }
    } catch (err: any) {
      console.warn('[NEXCONN_CONNECT] Connect fallback:', err.message);
      this.setState('fallback_local', err.message);
    }
  }

  public async sendDirectMessage(
    targetChatId: string,
    text: string
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (this.state === 'connected') {
      try {
        const directChan = new DirectChannel(targetChatId);
        const params = new SendTextMessageParams({ text });
        const { code, data } = await directChan.sendMessage(params);
        if (code === 0 && data) {
          return { success: true, messageId: data.messageId };
        }
        return { success: false, error: `Nexconn send code ${code}` };
      } catch (e: any) {
        return { success: false, error: e.message };
      }
    }
    return { success: true };
  }

  public async sendTyping(targetChatId: string): Promise<void> {
    if (this.state === 'connected') {
      try {
        const directChan = new DirectChannel(targetChatId);
        await directChan.sendTypingStatus('RC:TxtMsg');
      } catch {
        // Best-effort transient typing indicator
      }
    }
  }

  public async disconnect(): Promise<void> {
    console.log('[NEXCONN_DISCONNECT] Tearing down connection for user:', this.currentChatId);
    if (this.connected && this.initialized) {
      try {
        await NCEngine.disconnect();
      } catch (e) {
        console.warn('Nexconn disconnect error:', e);
      }
    }
    this.connected = false;
    this.currentChatId = null;
    this.setState('disconnected');
  }
}

export const nexconn = NexconnManager.getInstance();
