import { Socket } from "socket.io";

export interface UserData {
  id: string;
  nickname: string;
  name: string;
}

export interface ServerToClientEvents {
  "user-joined": (data: {
    userId: string;
    nickname: string;
    timestamp: string;
  }) => void;
  "user-left": (data: {
    userId: string;
    nickname: string;
    timestamp: string;
  }) => void;
  "user-typing": (data: {
    userId: string;
    nickname: string;
    isTyping: boolean;
  }) => void;
  "message-read-by": (data: {
    userId: string;
    messageId: string;
    timestamp: string;
  }) => void;
}

export interface ClientToServerEvents {
  "join-chat-room": (roomId: string) => void;
  "join-chat": (roomId: string) => void;
  "leave-chat-room": (roomId: string) => void;
  "leave-chat": (roomId: string) => void;
  "typing-start": (roomId: string) => void;
  "typing-stop": (roomId: string) => void;
  "message-read": (data: { roomId: string; messageId: string }) => void;
}

export interface InterServerEvents {}

export interface SocketData {
  user: UserData;
  userId: string;
}

export type TypedSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;