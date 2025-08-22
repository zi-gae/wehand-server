import { messaging } from '../config/firebase';
import { supabase } from '../lib/supabase';
import { Message, MulticastMessage, Notification, AndroidConfig, ApnsConfig, WebpushConfig } from 'firebase-admin/messaging';

interface NotificationPayload {
  userId?: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  imageUrl?: string;
  priority?: 'urgent' | 'high' | 'normal' | 'low';
  channel?: string;
  type: string;
}

interface SendToUserOptions {
  saveToHistory?: boolean;
}

export class PushNotificationService {
  // 사용자에게 푸시 알림 전송
  async sendToUser(
    userId: string, 
    payload: NotificationPayload,
    options: SendToUserOptions = { saveToHistory: true }
  ) {
    try {
      // 1. 사용자의 활성 디바이스 토큰 조회
      const { data: tokens, error: tokenError } = await supabase
        .from('device_tokens')
        .select('token, platform')
        .eq('user_id', userId)
        .eq('is_active', true);

      if (tokenError) {
        console.error('디바이스 토큰 조회 실패:', tokenError);
        throw tokenError;
      }

      if (!tokens || tokens.length === 0) {
        console.log(`사용자 ${userId}의 활성 토큰이 없습니다.`);
        return { success: false, message: '활성 디바이스 토큰이 없음' };
      }

      // 2. 사용자 알림 설정 확인
      const { data: settings } = await supabase
        .from('user_notification_settings')
        .select('*')
        .eq('user_id', userId)
        .eq('channel', payload.channel || 'general')
        .single();

      if (settings && !settings.is_enabled) {
        console.log(`사용자 ${userId}가 ${payload.channel} 채널 알림을 비활성화했습니다.`);
        return { success: false, message: '사용자가 알림을 비활성화함' };
      }

      // 3. FCM 메시지 구성
      const notification: Notification = {
        title: payload.title,
        body: payload.body,
      };

      if (payload.imageUrl) {
        notification.imageUrl = payload.imageUrl;
      }

      const message: MulticastMessage = {
        tokens: tokens.map(t => t.token),
        notification,
        data: {
          ...payload.data,
          type: payload.type,
          channel: payload.channel || 'general',
          timestamp: new Date().toISOString(),
        },
        android: this.getAndroidConfig(payload.priority),
        apns: this.getApnsConfig(payload.priority),
        webpush: this.getWebpushConfig(payload.priority),
      };

      // 4. FCM으로 전송
      const response = await messaging.sendEachForMulticast(message);
      
      // 5. 실패한 토큰 처리
      const failedTokens: string[] = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          console.error(`토큰 전송 실패: ${tokens[idx].token}`, resp.error);
          failedTokens.push(tokens[idx].token);
          
          // 특정 에러 코드에 대해 토큰 비활성화
          if (resp.error?.code === 'messaging/invalid-registration-token' ||
              resp.error?.code === 'messaging/registration-token-not-registered') {
            this.deactivateToken(tokens[idx].token);
          }
        }
      });

      // 6. 알림 히스토리 저장
      if (options.saveToHistory) {
        await this.saveNotificationHistory({
          user_id: userId,
          type: payload.type,
          title: payload.title,
          body: payload.body,
          data: payload.data || {},
          channel: payload.channel || 'general',
          priority: payload.priority || 'normal',
          status: response.successCount > 0 ? 'sent' : 'failed',
          sent_at: new Date().toISOString(),
        });
      }

      return {
        success: response.successCount > 0,
        successCount: response.successCount,
        failureCount: response.failureCount,
        failedTokens,
      };
    } catch (error) {
      console.error('푸시 알림 전송 실패:', error);
      throw error;
    }
  }

  // 여러 사용자에게 푸시 알림 전송
  async sendToMultipleUsers(userIds: string[], payload: NotificationPayload) {
    const results = await Promise.allSettled(
      userIds.map(userId => this.sendToUser(userId, payload))
    );

    const summary = {
      total: userIds.length,
      successful: 0,
      failed: 0,
      errors: [] as any[],
    };

    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value.success) {
        summary.successful++;
      } else {
        summary.failed++;
        if (result.status === 'rejected') {
          summary.errors.push({
            userId: userIds[index],
            error: result.reason,
          });
        }
      }
    });

    return summary;
  }

  // 토픽 기반 알림 전송 (대량 발송용)
  async sendToTopic(topic: string, payload: NotificationPayload) {
    try {
      const message: Message = {
        topic,
        notification: {
          title: payload.title,
          body: payload.body,
          imageUrl: payload.imageUrl,
        },
        data: {
          ...payload.data,
          type: payload.type,
          channel: payload.channel || 'general',
          timestamp: new Date().toISOString(),
        },
        android: this.getAndroidConfig(payload.priority),
        apns: this.getApnsConfig(payload.priority),
        webpush: this.getWebpushConfig(payload.priority),
      };

      const response = await messaging.send(message);
      
      // 캠페인 히스토리 저장
      await this.saveCampaignResult(topic, payload, response);
      
      return { success: true, messageId: response };
    } catch (error) {
      console.error('토픽 알림 전송 실패:', error);
      throw error;
    }
  }

  // 조건 기반 알림 전송
  async sendWithCondition(condition: string, payload: NotificationPayload) {
    try {
      const message: Message = {
        condition, // 예: "'stock-news' in topics || 'tech-news' in topics"
        notification: {
          title: payload.title,
          body: payload.body,
          imageUrl: payload.imageUrl,
        },
        data: {
          ...payload.data,
          type: payload.type,
          channel: payload.channel || 'general',
          timestamp: new Date().toISOString(),
        },
      };

      const response = await messaging.send(message);
      return { success: true, messageId: response };
    } catch (error) {
      console.error('조건 기반 알림 전송 실패:', error);
      throw error;
    }
  }

  // 디바이스 토큰 등록
  async registerDeviceToken(userId: string, token: string, platform: 'ios' | 'android' | 'web', deviceInfo?: any) {
    try {
      const { data, error } = await supabase
        .from('device_tokens')
        .upsert({
          user_id: userId,
          token,
          platform,
          device_info: deviceInfo || {},
          is_active: true,
          last_used_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,token',
        });

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('디바이스 토큰 등록 실패:', error);
      throw error;
    }
  }

  // 디바이스 토큰 비활성화
  async deactivateToken(token: string) {
    try {
      const { error } = await supabase
        .from('device_tokens')
        .update({ is_active: false })
        .eq('token', token);

      if (error) throw error;
    } catch (error) {
      console.error('토큰 비활성화 실패:', error);
    }
  }

  // 알림 히스토리 저장
  private async saveNotificationHistory(data: any) {
    try {
      const { error } = await supabase
        .from('notification_history')
        .insert(data);

      if (error) throw error;
    } catch (error) {
      console.error('알림 히스토리 저장 실패:', error);
    }
  }

  // 캠페인 결과 저장
  private async saveCampaignResult(topic: string, payload: NotificationPayload, messageId: string) {
    try {
      // 캠페인 테이블 업데이트 로직
      console.log(`캠페인 결과 저장: ${topic}, 메시지 ID: ${messageId}`);
    } catch (error) {
      console.error('캠페인 결과 저장 실패:', error);
    }
  }

  // Android 설정
  private getAndroidConfig(priority?: string): AndroidConfig {
    return {
      priority: priority === 'urgent' || priority === 'high' ? 'high' : 'normal',
      notification: {
        sound: 'default',
        clickAction: 'FLUTTER_NOTIFICATION_CLICK',
        channelId: 'default',
      },
    };
  }

  // iOS 설정
  private getApnsConfig(priority?: string): ApnsConfig {
    return {
      payload: {
        aps: {
          sound: 'default',
          badge: 1,
          contentAvailable: true,
        },
      },
      headers: {
        'apns-priority': priority === 'urgent' || priority === 'high' ? '10' : '5',
      },
    };
  }

  // Web Push 설정
  private getWebpushConfig(priority?: string): WebpushConfig {
    return {
      headers: {
        Urgency: priority || 'normal',
        TTL: '86400', // 24시간
      },
      notification: {
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        vibrate: [200, 100, 200],
      },
    };
  }

  // 토픽 구독
  async subscribeToTopic(tokens: string[], topic: string) {
    try {
      const response = await messaging.subscribeToTopic(tokens, topic);
      return {
        success: response.successCount > 0,
        successCount: response.successCount,
        failureCount: response.failureCount,
      };
    } catch (error) {
      console.error('토픽 구독 실패:', error);
      throw error;
    }
  }

  // 토픽 구독 해제
  async unsubscribeFromTopic(tokens: string[], topic: string) {
    try {
      const response = await messaging.unsubscribeFromTopic(tokens, topic);
      return {
        success: response.successCount > 0,
        successCount: response.successCount,
        failureCount: response.failureCount,
      };
    } catch (error) {
      console.error('토픽 구독 해제 실패:', error);
      throw error;
    }
  }
}

// 싱글톤 인스턴스
export const pushNotificationService = new PushNotificationService();