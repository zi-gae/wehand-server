import { Request, Response } from 'express';
import { AuthRequest } from '../types/auth';
import { supabase } from '../lib/supabase';
import { ApiError } from '../utils/errors';
import { logger } from '../config/logger';
import { z } from 'zod';
import { io } from '../app';

// Validation schemas
const sendMessageSchema = z.object({
  content: z.string().min(1).max(1000),
  message_type: z.enum(['text', 'image', 'system']).default('text'),
  reply_to: z.string().uuid().optional()
});

const createChatRoomSchema = z.object({
  type: z.enum(['direct', 'match']),
  participant_ids: z.array(z.string().uuid()).min(1).optional(),
  match_id: z.string().uuid().optional(),
  name: z.string().max(100).optional()
});

// 채팅방 목록 조회
export const getChatRooms = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { page = '1', limit = '20' } = req.query;

    const offset = (Number(page) - 1) * Number(limit);

    const { data: chatRooms, error, count } = await supabase
      .from('chat_room_participants')
      .select(`
        chat_room_id,
        unread_count
      `, { count: 'exact' })
      .eq('user_id', userId)
      .range(offset, offset + Number(limit) - 1);

    if (error) {
      throw new ApiError(500, '채팅방 목록 조회 실패', 'DATABASE_ERROR');
    }

    // 각 채팅방의 상세 정보를 별도로 조회
    const processedRooms = await Promise.all(
      (chatRooms || []).map(async (participant: any) => {
        // 채팅방 기본 정보 조회
        const { data: room } = await supabase
          .from('chat_rooms')
          .select(`
            id,
            name,
            type,
            created_at,
            updated_at,
            match_id
          `)
          .eq('id', participant.chat_room_id)
          .single();

        if (!room) return null;

        // 매치 정보 조회 (매치 채팅방인 경우)
        let matchInfo = null;
        if (room.match_id) {
          const { data: match } = await supabase
            .from('matches')
            .select('id, title, match_date')
            .eq('id', room.match_id)
            .single();
          matchInfo = match;
        }

        // 최신 메시지 조회
        const { data: lastMessage } = await supabase
          .from('messages')
          .select(`
            id,
            content,
            message_type,
            created_at,
            sender_id
          `)
          .eq('chat_room_id', room.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        // 발신자 정보 조회 (메시지가 있는 경우)
        let senderInfo = null;
        if (lastMessage?.sender_id) {
          const { data: sender } = await supabase
            .from('users')
            .select('id, nickname, profile_image')
            .eq('id', lastMessage.sender_id)
            .single();
          senderInfo = sender;
        }

        // 1:1 채팅의 경우 상대방 정보 조회
        let otherParticipant = null;
        if (room.type === 'direct') {
          const { data: participants } = await supabase
            .from('chat_room_participants')
            .select('user_id')
            .eq('chat_room_id', room.id)
            .neq('user_id', userId);

          if (participants && participants.length > 0) {
            const { data: user } = await supabase
              .from('users')
              .select('id, nickname, profile_image')
              .eq('id', participants[0].user_id)
              .single();
            otherParticipant = user;
          }
        }

        return {
          id: room.id,
          name: room.type === 'direct' ? otherParticipant?.nickname : room.name,
          type: room.type,
          match: matchInfo,
          otherParticipant,
          lastMessage: lastMessage ? {
            ...lastMessage,
            sender: senderInfo
          } : null,
          unreadCount: participant.unread_count || 0,
          updatedAt: room.updated_at
        };
      })
    );

    // null 값 필터링
    const validRooms = processedRooms.filter(room => room !== null);

    const totalPages = Math.ceil((count || 0) / Number(limit));

    res.json({
      success: true,
      data: validRooms,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: count || 0,
        totalPages,
        hasNext: Number(page) < totalPages,
        hasPrev: Number(page) > 1
      }
    });

  } catch (error: any) {
    logger.error('채팅방 목록 조회 실패:', error);
    
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json({
        success: false,
        error: {
          code: error.code,
          message: error.message
        }
      });
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '서버 내부 오류가 발생했습니다'
      }
    });
  }
};

// 채팅방 생성
export const createChatRoom = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    
    const validation = createChatRoomSchema.safeParse(req.body);

    if (!validation.success) {
      throw new ApiError(400, '입력값이 올바르지 않습니다', 'VALIDATION_ERROR');
    }

    const { type, participant_ids, match_id, name } = validation.data;

    // 매치 채팅방의 경우 중복 생성 방지
    if (type === 'match' && match_id) {
      const { data: existingRoom } = await supabase
        .from('chat_rooms')
        .select('id')
        .eq('type', 'match')
        .eq('match_id', match_id)
        .single();

      if (existingRoom) {
        // 기존 채팅방에 사용자 추가 (참가하지 않은 경우)
        const { data: participation } = await supabase
          .from('chat_room_participants')
          .select('id')
          .eq('chat_room_id', existingRoom.id)
          .eq('user_id', userId)
          .single();

        if (!participation) {
          await supabase
            .from('chat_room_participants')
            .insert({
              chat_room_id: existingRoom.id,
              user_id: userId
            });
        }

        return res.json({
          success: true,
          data: {
            id: existingRoom.id,
            message: '채팅방에 참가했습니다'
          }
        });
      }
    }

    // 1:1 채팅방의 경우 기존 채팅방 확인
    if (type === 'direct' && participant_ids && participant_ids.length === 1) {
      const otherUserId = participant_ids[0];
      
      // 기존 1:1 채팅방 찾기
      const { data: existingDirectRoom } = await supabase
        .rpc('find_direct_chat_room', {
          user1_id: userId,
          user2_id: otherUserId
        });

      if (existingDirectRoom && existingDirectRoom.length > 0) {
        return res.json({
          success: true,
          data: {
            id: existingDirectRoom[0].id,
            message: '기존 채팅방으로 연결되었습니다'
          }
        });
      }
    }

    // 새 채팅방 생성
    const { data: chatRoom, error } = await supabase
      .from('chat_rooms')
      .insert({
        type,
        name: name || null,
        match_id: match_id || null
      })
      .select('id')
      .single();

    if (error) {
      throw new ApiError(500, '채팅방 생성 실패', 'DATABASE_ERROR');
    }

    // 참가자 추가
    const participantsToAdd = [userId];
    if (participant_ids) {
      participantsToAdd.push(...participant_ids);
    }

    const participantInserts = participantsToAdd.map(participantId => ({
      chat_room_id: chatRoom.id,
      user_id: participantId
    }));

    const { error: participantError } = await supabase
      .from('chat_room_participants')
      .insert(participantInserts);

    if (participantError) {
      // 채팅방 삭제 후 에러 반환
      await supabase
        .from('chat_rooms')
        .delete()
        .eq('id', chatRoom.id);
      
      throw new ApiError(500, '채팅방 참가자 추가 실패', 'DATABASE_ERROR');
    }

    res.status(201).json({
      success: true,
      data: {
        id: chatRoom.id,
        message: '채팅방이 생성되었습니다'
      }
    });

  } catch (error: any) {
    logger.error('채팅방 생성 실패:', error);
    
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json({
        success: false,
        error: {
          code: error.code,
          message: error.message
        }
      });
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '서버 내부 오류가 발생했습니다'
      }
    });
  }
};

// 채팅방 상세 정보 조회
export const getChatRoom = async (req: AuthRequest, res: Response) => {
  try {
    const { chatRoomId } = req.params;
    const userId = req.userId!;

    // 채팅방 참가 여부 확인
    const { data: participation } = await supabase
      .from('chat_room_participants')
      .select('id')
      .eq('chat_room_id', chatRoomId)
      .eq('user_id', userId)
      .single();

    if (!participation) {
      throw new ApiError(403, '채팅방에 접근할 권한이 없습니다', 'FORBIDDEN');
    }

    // 채팅방 정보 조회
    const { data: chatRoom, error } = await supabase
      .from('chat_rooms')
      .select(`
        id,
        name,
        type,
        created_at,
        match:match_id(
          id,
          title,
          match_date,
          venue:venue_id(
            name
          )
        )
      `)
      .eq('id', chatRoomId)
      .single();

    if (error || !chatRoom) {
      throw new ApiError(404, '채팅방을 찾을 수 없습니다', 'CHATROOM_NOT_FOUND');
    }

    // 참가자 목록 조회
    const { data: participants } = await supabase
      .from('chat_room_participants')
      .select(`
        user:user_id(
          id,
          nickname,
          profile_image
        ),
        joined_at
      `)
      .eq('chat_room_id', chatRoomId)
      .order('joined_at', { ascending: true });

    res.json({
      success: true,
      data: {
        ...chatRoom,
        participants: participants || []
      }
    });

  } catch (error: any) {
    logger.error('채팅방 정보 조회 실패:', error);
    
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json({
        success: false,
        error: {
          code: error.code,
          message: error.message
        }
      });
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '서버 내부 오류가 발생했습니다'
      }
    });
  }
};

// 메시지 목록 조회
export const getMessages = async (req: AuthRequest, res: Response) => {
  try {
    const { chatRoomId } = req.params;
    const userId = req.userId!;
    const { 
      page = '1', 
      limit = '50',
      before // 특정 메시지 ID 이전 메시지 조회 (무한 스크롤용)
    } = req.query;

    // 채팅방 참가 여부 확인
    const { data: participation } = await supabase
      .from('chat_room_participants')
      .select('id')
      .eq('chat_room_id', chatRoomId)
      .eq('user_id', userId)
      .single();

    if (!participation) {
      throw new ApiError(403, '채팅방에 접근할 권한이 없습니다', 'FORBIDDEN');
    }

    const offset = (Number(page) - 1) * Number(limit);

    let query = supabase
      .from('messages')
      .select(`
        id,
        content,
        message_type,
        created_at,
        reply_to,
        sender:sender_id(
          id,
          nickname,
          profile_image
        ),
        reply_message:reply_to(
          id,
          content,
          sender:sender_id(
            nickname
          )
        )
      `, { count: 'exact' })
      .eq('chat_room_id', chatRoomId)
      .order('created_at', { ascending: false })
      .range(offset, offset + Number(limit) - 1);

    // 특정 메시지 이전 메시지 조회 (무한 스크롤)
    if (before) {
      const { data: beforeMessage } = await supabase
        .from('messages')
        .select('created_at')
        .eq('id', before)
        .single();

      if (beforeMessage) {
        query = query.lt('created_at', beforeMessage.created_at);
      }
    }

    const { data: messages, error, count } = await query;

    if (error) {
      throw new ApiError(500, '메시지 조회 실패', 'DATABASE_ERROR');
    }

    // 메시지를 시간순으로 정렬 (오래된 것부터)
    const sortedMessages = (messages || []).reverse();

    const totalPages = Math.ceil((count || 0) / Number(limit));

    res.json({
      success: true,
      data: sortedMessages,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: count || 0,
        totalPages,
        hasNext: Number(page) < totalPages,
        hasPrev: Number(page) > 1
      }
    });

  } catch (error: any) {
    logger.error('메시지 조회 실패:', error);
    
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json({
        success: false,
        error: {
          code: error.code,
          message: error.message
        }
      });
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '서버 내부 오류가 발생했습니다'
      }
    });
  }
};

// 메시지 전송
export const sendMessage = async (req: AuthRequest, res: Response) => {
  try {
    const { chatRoomId } = req.params;
    const userId = req.userId!;
    
    const validation = sendMessageSchema.safeParse(req.body);

    if (!validation.success) {
      throw new ApiError(400, '입력값이 올바르지 않습니다', 'VALIDATION_ERROR');
    }

    // 채팅방 참가 여부 확인
    const { data: participation } = await supabase
      .from('chat_room_participants')
      .select('id')
      .eq('chat_room_id', chatRoomId)
      .eq('user_id', userId)
      .single();

    if (!participation) {
      throw new ApiError(403, '채팅방에 접근할 권한이 없습니다', 'FORBIDDEN');
    }

    const { content, message_type, reply_to } = validation.data;

    // 답글의 경우 원본 메시지 확인
    if (reply_to) {
      const { data: originalMessage } = await supabase
        .from('messages')
        .select('id')
        .eq('id', reply_to)
        .eq('chat_room_id', chatRoomId)
        .single();

      if (!originalMessage) {
        throw new ApiError(404, '답글 대상 메시지를 찾을 수 없습니다', 'MESSAGE_NOT_FOUND');
      }
    }

    // 메시지 전송
    const { data: message, error } = await supabase
      .from('messages')
      .insert({
        chat_room_id: chatRoomId,
        sender_id: userId,
        content,
        message_type,
        reply_to: reply_to || null
      })
      .select(`
        id,
        content,
        message_type,
        created_at,
        reply_to,
        sender:sender_id(
          id,
          nickname,
          profile_image
        )
      `)
      .single();

    if (error) {
      throw new ApiError(500, '메시지 전송 실패', 'DATABASE_ERROR');
    }

    // 채팅방 업데이트 시간 갱신
    await supabase
      .from('chat_rooms')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', chatRoomId);

    // 다른 참가자들의 읽지 않은 메시지 수 증가
    await supabase.rpc('increment_unread_count', {
      room_id: chatRoomId,
      sender_user_id: userId
    });

    // 실시간 메시지 전송 (Socket.io)
    io.to(`chat-${chatRoomId}`).emit('new-message', {
      id: message.id,
      content: message.content,
      messageType: message.message_type,
      sender: message.sender,
      replyTo: message.reply_to,
      timestamp: message.created_at,
      chatRoomId: chatRoomId
    });

    logger.info(`실시간 메시지 전송: 채팅방 ${chatRoomId}, 메시지 ID ${message.id}`);

    res.status(201).json({
      success: true,
      data: message
    });

  } catch (error: any) {
    logger.error('메시지 전송 실패:', error);
    
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json({
        success: false,
        error: {
          code: error.code,
          message: error.message
        }
      });
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '서버 내부 오류가 발생했습니다'
      }
    });
  }
};

// 메시지 읽음 처리
export const markMessagesAsRead = async (req: AuthRequest, res: Response) => {
  try {
    const { chatRoomId } = req.params;
    const userId = req.userId!;

    // 채팅방 참가 여부 확인
    const { data: participation } = await supabase
      .from('chat_room_participants')
      .select('id')
      .eq('chat_room_id', chatRoomId)
      .eq('user_id', userId)
      .single();

    if (!participation) {
      throw new ApiError(403, '채팅방에 접근할 권한이 없습니다', 'FORBIDDEN');
    }

    // 읽지 않은 메시지 수 초기화
    const { error } = await supabase
      .from('chat_room_participants')
      .update({ 
        unread_count: 0,
        last_read_at: new Date().toISOString()
      })
      .eq('chat_room_id', chatRoomId)
      .eq('user_id', userId);

    if (error) {
      throw new ApiError(500, '메시지 읽음 처리 실패', 'DATABASE_ERROR');
    }

    res.json({
      success: true,
      data: {
        message: '메시지가 읽음 처리되었습니다'
      }
    });

  } catch (error: any) {
    logger.error('메시지 읽음 처리 실패:', error);
    
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json({
        success: false,
        error: {
          code: error.code,
          message: error.message
        }
      });
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '서버 내부 오류가 발생했습니다'
      }
    });
  }
};

// 채팅방 나가기
export const leaveChatRoom = async (req: AuthRequest, res: Response) => {
  try {
    const { chatRoomId } = req.params;
    const userId = req.userId!;

    // 채팅방 참가 여부 확인
    const { data: participation } = await supabase
      .from('chat_room_participants')
      .select('id')
      .eq('chat_room_id', chatRoomId)
      .eq('user_id', userId)
      .single();

    if (!participation) {
      throw new ApiError(403, '채팅방에 참가하지 않았습니다', 'NOT_PARTICIPANT');
    }

    // 참가자 삭제
    const { error } = await supabase
      .from('chat_room_participants')
      .delete()
      .eq('chat_room_id', chatRoomId)
      .eq('user_id', userId);

    if (error) {
      throw new ApiError(500, '채팅방 나가기 실패', 'DATABASE_ERROR');
    }

    // 나가기 시스템 메시지 전송
    const { data: user } = await supabase
      .from('users')
      .select('nickname')
      .eq('id', userId)
      .single();

    await supabase
      .from('messages')
      .insert({
        chat_room_id: chatRoomId,
        sender_id: null, // 시스템 메시지
        content: `${user?.nickname || '사용자'}님이 채팅방을 나갔습니다.`,
        message_type: 'system'
      });

    res.json({
      success: true,
      data: {
        message: '채팅방을 나갔습니다'
      }
    });

  } catch (error: any) {
    logger.error('채팅방 나가기 실패:', error);
    
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json({
        success: false,
        error: {
          code: error.code,
          message: error.message
        }
      });
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '서버 내부 오류가 발생했습니다'
      }
    });
  }
};

export const chatController = {
  getChatRooms,
  createChatRoom,
  getChatRoom,
  getMessages,
  sendMessage,
  markMessagesAsRead,
  leaveChatRoom
};