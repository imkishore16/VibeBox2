export interface Video {
  id: string;
  title: string;
  smallImg: string;
  bigImg: string;
  upvotes: number;
  haveUpvoted: boolean;
  addedBy: string;
  paidAmount: number;
  platform: "YOUTUBE" | "SPOTIFY";
  extractedId: string;
  url: string;
} 