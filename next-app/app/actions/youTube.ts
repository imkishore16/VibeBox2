"use-server"

export async function searchYouTube(query: string) {
    const API_KEY = process.env.YOUTUBE_API_KEY;
    const base = "https://www.googleapis.com/youtube/v3/search";
  
    const params = new URLSearchParams({
      part: "snippet",
      maxResults: "10",
      q: query,
      type: "video",
      key: API_KEY || "",
    });
  
    const res = await fetch(`${base}?${params}`);
    if (!res.ok) {
      throw new Error("Failed to fetch from YouTube API");
    }
  
    const json = await res.json();
    return json.items.map((item: any) => ({
      id: item.id.videoId,
      title: item.snippet.title,
      thumbnail: item.snippet.thumbnails.default.url,
    }));
}
  