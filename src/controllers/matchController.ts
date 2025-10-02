// 분리된 매치 컨트롤러 모듈들을 re-export
import * as matchFunctions from "./match";

export const matchController = {
  getMatches: matchFunctions.getMatches,
  getMatchDetail: matchFunctions.getMatchDetail,
  joinMatch: matchFunctions.joinMatch,
  createMatch: matchFunctions.createMatch,
  deleteMatch: matchFunctions.deleteMatch,
  shareMatch: matchFunctions.shareMatch,
  bookmarkMatch: matchFunctions.bookmarkMatch,
  unbookmarkMatch: matchFunctions.unbookmarkMatch,
  createMatchChat: matchFunctions.createMatchChat,
  createPrivateChat: matchFunctions.createPrivateChat,
};
