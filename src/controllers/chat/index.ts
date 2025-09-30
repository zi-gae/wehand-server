export {
  getChatRooms,
  createChatRoom,
  getChatRoom,
  deleteChatRoom,
} from "./rooms";

export {
  getAllMessages,
  getMessages,
  sendMessage,
  markMessagesAsRead,
} from "./messages";

export { joinChatRoom, leaveChatRoom } from "./participants";

export { approveMatchParticipant, cancelMatchApproval } from "./matchApproval";

export const chatController = {
  getChatRooms: require("./rooms").getChatRooms,
  createChatRoom: require("./rooms").createChatRoom,
  getChatRoom: require("./rooms").getChatRoom,
  getMessages: require("./messages").getMessages,
  getAllMessages: require("./messages").getAllMessages,
  sendMessage: require("./messages").sendMessage,
  markMessagesAsRead: require("./messages").markMessagesAsRead,
  joinChatRoom: require("./participants").joinChatRoom,
  leaveChatRoom: require("./participants").leaveChatRoom,
  approveMatchParticipant: require("./matchApproval").approveMatchParticipant,
  cancelMatchApproval: require("./matchApproval").cancelMatchApproval,
  deleteChatRoom: require("./rooms").deleteChatRoom,
};
