import {WebSocket} from "ws"

const YT_REGEX =
  /^(?:https?:\/\/)?(?:www\.)?(?:m\.)?(?:youtube\.com\/(?:watch\?(?!.*\blist=)(?:.*&)?v=|embed\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})(?:[?&]\S+)?$/;

const SPOTIFY_REGEX = /open\.spotify\.com\/(?:track|playlist|album|artist)\/([a-zA-Z0-9]+)/;
export const isValidYoutubeURL = (data: string) => {
  return data.match(YT_REGEX);
};

export const isValidSpotifyURL = (data: string) => {
  return data.match(SPOTIFY_REGEX);
};

export const getVideoId = (url: string) => {
  return url.match(YT_REGEX)?.[1];
};

export const getSpotifyId = (url: string) => {
  const SPOTIFY_REGEX = /open\.spotify\.com\/(?:track|playlist|album|artist)\/([a-zA-Z0-9]+)/;
  return url.match(SPOTIFY_REGEX)?.[1];
};


export function sendError(ws: WebSocket, message: string) {
  ws.send(JSON.stringify({ type: "error", data: { message } }));
}

export function checkUrlPlatform(url:string) {
  const youtubeRegex = /^(?:https?:\/\/)?(?:www\.)?(?:m\.)?(?:youtube\.com\/(?:watch\?(?!.*\blist=)(?:.*&)?v=|embed\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})(?:[?&]\S+)?$/;
  const spotifyRegex = /open\.spotify\.com\/(?:track|playlist|album|artist)\/[a-zA-Z0-9]+/;

  if (youtubeRegex.test(url)) {
    return 'youtube';
  } else if (spotifyRegex.test(url)) {
    return 'spotify';
  }
  return 'unknown';
}


async function getSpotifyAccessToken() {
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization:
        "Basic " +
        Buffer.from(
          process.env.SPOTIFY_CLIENT_ID + ":" + process.env.SPOTIFY_CLIENT_SECRET,
        ).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  const data = await res.json();
  return data.access_token;
}


export async function getSpotifyTrack(trackId: string,token:string): Promise<any> {
  // const token = await getSpotifyAccessToken();

  const res = await fetch(`https://api.spotify.com/v1/tracks/${trackId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    throw new Error("Failed to fetch track from Spotify");
  }

  const data = await res.json();

  return {
    body: {
      id: data.id,
      name: data.name,
      artists: data.artists.map((a: any) => a.name).join(", "),
      album: {
        name: data.album.name,
        images: data.album.images, // this is used as thumbnails
      },
      external_urls: {
        spotify: data.external_urls.spotify, // this is used for the final `url`
      },
      duration_ms: data.duration_ms,
    },
  };
}

export async function getYouTubeVideoDetails(videoId: string): Promise<any> {
  const API_KEY = process.env.YOUTUBE_API_KEY;
  const base = "https://www.googleapis.com/youtube/v3/videos";

  const params = new URLSearchParams({
    part: "snippet,contentDetails,statistics",
    id: videoId,
    key: API_KEY || "",
  });

  const res = await fetch(`${base}?${params}`);
  if (!res.ok) {
    throw new Error("Failed to fetch from YouTube API");
  }

  const json = await res.json();
  const video = json.items[0];

  if (!video) {
    throw new Error("Video not found");
  }

  const thumbnailsObj = video.snippet.thumbnails;
  const thumbnailsArr = Object.values(thumbnailsObj);

  return {
    id: video.id,
    title: video.snippet.title,
    description: video.snippet.description,
    thumbnail: {
      thumbnails: thumbnailsArr,
    },
    publishedAt: video.snippet.publishedAt,
    viewCount: video.statistics.viewCount,
    likeCount: video.statistics.likeCount,
  };
}


function extractVideoIdFromUrl(url: string): string | null {
  const regex = /(?:https?:\/\/(?:www\.)?youtube\.com\/(?:watch\?v=|(?:v|e(?:mbed)?)\/)([a-zA-Z0-9_-]{11}))/;
  const match = url.match(regex);
  return match ? match[1] : null;
}
