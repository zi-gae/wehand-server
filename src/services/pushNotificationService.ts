import * as admin from 'firebase-admin';
import { supabase } from '../lib/supabase';
import { logger } from '../config/logger';

// Firebase Admin SDK 초기화
// 서비스 계정 키는 환경 변수나 파일로 관리
const initializeFirebaseAdmin = () => {
  if (!admin.apps.length) {
    // 방법 1: 서비스 계정 JSON 파일 사용
    // const serviceAccount = require('../../firebase-service-account.json');
    // admin.initializeApp({
    //   credential: admin.credential.cert(serviceAccount)
    // });

    // 방법 2: 환경 변수 사용
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      })
    });
  }
};

initializeFirebaseAdmin();

// 푸시 알림 타입
export interface PushNotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  image?: string;
  data?: Record<string, string>;
  clickAction?: string;
}

// 단일 사용자에게 푸시 알림 전송
export const sendPushToUser = async (
  userId: string,
  payload: PushNotificationPayload
): Promise<boolean> => {
  try {
    // 사용자의 FCM 토큰 조회
    const { data: tokens, error } = await supabase
      .from('user_push_tokens')
      .select('fcm_token, device_type')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (error || !tokens || tokens.length === 0) {
      logger.warn(`No active FCM tokens found for user ${userId}`);
      return false;
    }

    // 각 디바이스로 전송
    const sendPromises = tokens.map(async (tokenData) => {
      const message: admin.messaging.Message = {
        token: tokenData.fcm_token,
        notification: {
          title: payload.title,
          body: payload.body,
          imageUrl: payload.image
        },
        data: {
          ...payload.data,
          click_action: payload.clickAction || '/',
          timestamp: new Date().toISOString()
        },
        webpush: {
          notification: {
            icon: payload.icon || '/pwa-192x192.png',
            badge: payload.badge || '/pwa-192x192.png',
            vibrate: [200, 100, 200],
            requireInteraction: true,
            tag: payload.data?.tag || 'wehand-notification'
          },
          fcmOptions: {
            link: payload.clickAction || '/'
          }
        },
        android: {
          notification: {
            icon: 'ic_notification',
            color: '#059669',
            priority: 'high' as const,
            channelId: 'wehand_notifications'
          }
        },
        apns: {
          payload: {
            aps: {
              badge: 1,
              sound: 'default',
              contentAvailable: true
            }
          }
        }
      };

      try {
        const response = await admin.messaging().send(message);
        logger.info(`Push notification sent successfully: ${response}`);
        return true;
      } catch (error: any) {
        logger.error(`Failed to send push notification: ${error.message}`);
        
        // 토큰이 유효하지 않으면 비활성화
        if (error.code === 'messaging/invalid-registration-token' || 
            error.code === 'messaging/registration-token-not-registered') {
          await supabase
            .from('user_push_tokens')
            .update({ is_active: false })
            .eq('fcm_token', tokenData.fcm_token);
        }
        
        return false;
      }
    });

    const results = await Promise.all(sendPromises);
    return results.some(result => result === true);
  } catch (error: any) {
    logger.error(`Error sending push notification: ${error.message}`);
    return false;
  }
};

// 여러 사용자에게 푸시 알림 전송
export const sendPushToMultipleUsers = async (
  userIds: string[],
  payload: PushNotificationPayload
): Promise<void> => {
  const sendPromises = userIds.map(userId => sendPushToUser(userId, payload));
  await Promise.allSettled(sendPromises);
};

// 토픽 기반 푸시 알림 전송
export const sendPushToTopic = async (
  topic: string,
  payload: PushNotificationPayload
): Promise<void> => {
  try {
    const message: admin.messaging.Message = {
      topic,
      notification: {
        title: payload.title,
        body: payload.body,
        imageUrl: payload.image
      },
      data: payload.data || {},
      webpush: {
        notification: {
          icon: payload.icon || '/pwa-192x192.png',
          badge: payload.badge || '/pwa-192x192.png'
        }
      }
    };

    const response = await admin.messaging().send(message);
    logger.info(`Topic push notification sent: ${response}`);
  } catch (error: any) {
    logger.error(`Failed to send topic push: ${error.message}`);
  }
};

// 채팅 메시지 알림
export const sendChatNotification = async (
  recipientId: string,
  senderName: string,
  message: string,
  chatRoomId: string
): Promise<void> => {
  await sendPushToUser(recipientId, {
    title: `${senderName}님의 메시지`,
    body: message,
    data: {
      type: 'chat',
      chatRoomId,
      tag: `chat-${chatRoomId}`
    },
    clickAction: `/chat/${chatRoomId}`
  });
};

// 매치 참가 승인 알림
export const sendMatchApprovalNotification = async (
  userId: string,
  matchTitle: string,
  matchId: string
): Promise<void> => {
  await sendPushToUser(userId, {
    title: '매치 참가 승인',
    body: `"${matchTitle}" 매치 참가가 승인되었습니다!`,
    data: {
      type: 'match',
      matchId,
      tag: `match-${matchId}`
    },
    clickAction: `/matching/${matchId}`
  });
};

// 매치 시작 알림
export const sendMatchStartNotification = async (
  participants: string[],
  matchTitle: string,
  matchId: string,
  startTime: string
): Promise<void> => {
  await sendPushToMultipleUsers(participants, {
    title: '매치 시작 알림',
    body: `"${matchTitle}" 매치가 ${startTime}에 시작됩니다!`,
    data: {
      type: 'match',
      matchId,
      tag: `match-start-${matchId}`
    },
    clickAction: `/matching/${matchId}`
  });
};

// 커뮤니티 알림 (댓글, 좋아요)
export const sendCommunityNotification = async (
  userId: string,
  type: 'comment' | 'like',
  actorName: string,
  postTitle: string,
  postId: string
): Promise<void> => {
  const notifications = {
    comment: {
      title: '새 댓글',
      body: `${actorName}님이 "${postTitle}" 게시글에 댓글을 남겼습니다.`
    },
    like: {
      title: '좋아요',
      body: `${actorName}님이 "${postTitle}" 게시글을 좋아합니다.`
    }
  };

  await sendPushToUser(userId, {
    ...notifications[type],
    data: {
      type: 'community',
      postId,
      tag: `community-${postId}`
    },
    clickAction: `/board/${postId}`
  });
};

// FCM 토큰 저장/업데이트
export const saveFCMToken = async (
  userId: string,
  token: string,
  deviceType: string = 'web',
  deviceInfo?: any
): Promise<void> => {
  try {
    // 기존 토큰 확인
    const { data: existing } = await supabase
      .from('user_push_tokens')
      .select('id')
      .eq('user_id', userId)
      .eq('fcm_token', token)
      .single();

    if (existing) {
      // 업데이트
      await supabase
        .from('user_push_tokens')
        .update({
          is_active: true,
          device_info: deviceInfo,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id);
    } else {
      // 새로 추가
      await supabase
        .from('user_push_tokens')
        .insert({
          user_id: userId,
          fcm_token: token,
          device_type: deviceType,
          device_info: deviceInfo,
          is_active: true
        });
    }

    logger.info(`FCM token saved for user ${userId}`);
  } catch (error: any) {
    logger.error(`Failed to save FCM token: ${error.message}`);
    throw error;
  }
};

// FCM 토큰 삭제/비활성화
export const removeFCMToken = async (
  userId: string,
  token: string
): Promise<void> => {
  try {
    await supabase
      .from('user_push_tokens')
      .update({ is_active: false })
      .eq('user_id', userId)
      .eq('fcm_token', token);

    logger.info(`FCM token removed for user ${userId}`);
  } catch (error: any) {
    logger.error(`Failed to remove FCM token: ${error.message}`);
    throw error;
  }
};