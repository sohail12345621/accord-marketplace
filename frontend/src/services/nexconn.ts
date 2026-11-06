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
   * 1. Query secure backend endpoint /api/chat/token
   * 2. If Nexconn live keys configured on backend, initialize SDK once and connect
   * 3. Register handlers before connecting (per Nexconn best practices)
   * 4. Handle disconnect, reconnection, and local transport fallback seamlessly
   */
  public async initAndConnect(): Promise<void> {
    if (this.connected || this.state === 'connecting') {
      return;
    }

    this.setState('connecting');

    try {
      // Step 1: Securely obtain token from Accord Backend
      // Notice: NEXCONN APP SECRET NEVER TOUCHES FRONTEND!
      const res = await apiFetch<{
        enabled: boolean;
        app_key?: string;
        token?: string;
        user_id: string;
        area?: string;
        mode: string;
      }>('/chat/token');

      this.currentChatId = res.user_id;

      if (!res.enabled || !res.app_key || !res.token) {
        console.info('[Accord Chat] Server running local transport fallback mode.');
        this.setState('fallback_local', res.mode);
        return;
      }

      // Step 2: Initialize Nexconn SDK exactly once per app lifecycle
      if (!this.initialized) {
        try {
          const areaCode = res.area === 'NA' ? AreaCode.NA : AreaCode.SG;
          NCEngine.initialize({
            appKey: res.app_key,
            areaCode,
            logLevel: LogLevel.WARN,
          });
          this.initialized = true;

          // Step 3: Register event handlers before calling connect
          NCEngine.addConnectionStatusHandler(
            'accord-conn-handler',
            new ConnectionStatusHandler({
              onConnectionStatusChanged: ({ status, code }) => {
                console.log('[Nexconn] Connection status changed:', status, code);
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

      // Step 4: Connect with short-lived user access token
      const connectRes = await NCEngine.connect({ token: res.token });
      if (connectRes.isOk || connectRes.code === 0) {
        this.connected = true;
        this.setState('connected');
        console.log('[Nexconn] Connected successfully. Chat user id:', connectRes.data?.userId);
      } else {
        console.warn('[Nexconn] Connect call returned non-zero code:', connectRes.code);
        this.setState('fallback_local', `Code ${connectRes.code}`);
      }
    } catch (err: any) {
      console.warn('[Nexconn] Connect attempt errored, using reliable local fallback:', err.message);
      this.setState('fallback_local', err.message);
    }
  }

  /**
   * Sends a real-time message through a Direct Channel to the target user.
   */
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

    // If local fallback mode, messages flow through Accord's server endpoints
    return { success: true };
  }

  public async sendTyping(targetChatId: string): Promise<void> {
    if (this.state === 'connected') {
      try {
        const directChan = new DirectChannel(targetChatId);
        await directChan.sendTypingStatus('RC:TxtMsg');
      } catch {
        // Typing status is best-effort transient signal
      }
    }
  }

  public async disconnect(): Promise<void> {
    if (this.connected && this.initialized) {
      try {
        await NCEngine.disconnect();
      } catch (e) {
        console.error('Nexconn disconnect error:', e);
      }
    }
    this.connected = false;
    this.currentChatId = null;
    this.setState('disconnected');
  }
}

export const nexconn = NexconnManager.getInstance();
