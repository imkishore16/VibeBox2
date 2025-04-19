import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import spotifyWebApi from "spotify-web-api-node"

export const YT_REGEX =
  /^(?:https?:\/\/)?(?:www\.)?(?:m\.)?(?:youtube\.com\/(?:watch\?(?!.*\blist=)(?:.*&)?v=|embed\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})(?:[?&]\S+)?$/;

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}


export const SPOTIFY_REGEX = /open\.spotify\.com\/(?:track|playlist|album|artist)\/([a-zA-Z0-9]+)/;
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