export interface FetchedPost {
  postId: string;
  url: string;
  text: string;
  authorHandle: string;
  authorUserId?: string;
  isReply: boolean;
  isQuote: boolean;
  isRetweet: boolean;
  createdAt?: string;
  sourceAdapter: "fxtwitter_v2" | "dayclaw_public";
}
