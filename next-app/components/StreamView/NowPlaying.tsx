import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Play, Youtube, Music } from "lucide-react";
import Image from "next/image";

export type Video = {
  platform: "YOUTUBE" | "SPOTIFY";
  extractedId: string;
  title: string;
  bigImg: string;
};

type Props = {
  playVideo: boolean;
  currentVideo: Video | null;
  playNextLoader: boolean;
  playNext: () => void;
};

export default function NowPlaying({
  playVideo,
  currentVideo,
  playNext,
  playNextLoader,
}: Props) {
  const renderMediaPlayer = () => {
    if (!currentVideo || !playVideo) return null;

    if (currentVideo.platform === "YOUTUBE") {
      return (
        <iframe
          src={`https://www.youtube.com/embed/${currentVideo.extractedId}?autoplay=1&enablejsapi=1&origin=${window.location.origin}`}
          width="100%"
          height="315"
          frameBorder="0"
          allowFullScreen
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          className="aspect-video rounded"
          onLoad={(e) => {
            // Add event listener for YouTube video end
            const iframe = e.currentTarget;
            window.addEventListener('message', (event) => {
              if (event.source === iframe.contentWindow) {
                try {
                  const data = JSON.parse(event.data);
                  if (data.event === 'onStateChange' && data.info === 0) {
                    // Video ended (state 0)
                    playNext();
                  }
                } catch (error) {
                  // Ignore parsing errors
                }
              }
            });
          }}
        />
      );
    } else if (currentVideo.platform === "SPOTIFY") {
      return (
        <iframe
          src={`https://open.spotify.com/embed/track/${currentVideo.extractedId}?autoplay=1`}
          width="100%"
          height="352"
          frameBorder="0"
          allowTransparency={true}
          allow="encrypted-media; autoplay; clipboard-write"
          className="rounded"
          onLoad={(e) => {
            // Add event listener for Spotify track end
            window.addEventListener('message', (event) => {
              try {
                const data = JSON.parse(event.data);
                // Check if the track ended (Spotify-specific event)
                if (data.type === "player_state_changed" && 
                    data.payload && 
                    data.payload.progress === 0 &&
                    data.payload.paused === true) {
                  playNext();
                }
              } catch (error) {
                // Ignore parsing errors
              }
            });
          }}
        />
      );
    }
    
    return null;
  };

  const renderPlatformIcon = () => {
    if (!currentVideo) return null;
    
    if (currentVideo.platform === "YOUTUBE") {
      return <Youtube className="mr-2 h-5 w-5 text-red-600" />;
    } else {
      return <Music className="mr-2 h-5 w-5 text-green-500" />;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center">
        {renderPlatformIcon()}
        <h2 className="text-2xl font-bold">Now Playing</h2>
      </div>
      
      <Card>
        <CardContent className="p-4">
          {currentVideo ? (
            <div>
              {playVideo ? (
                renderMediaPlayer()
              ) : (
                <>
                  <Image
                    height={288}
                    width={288}
                    alt={currentVideo.title}
                    src={currentVideo.bigImg}
                    className="h-72 w-full rounded object-cover"
                  />
                  <p className="mt-2 text-center font-semibold">
                    {currentVideo.title}
                  </p>
                </>
              )}
            </div>
          ) : (
            <p className="py-8 text-center">No media playing</p>
          )}
        </CardContent>
      </Card>
      
      {currentVideo && (
        <Button 
          disabled={playNextLoader} 
          onClick={playNext} 
          className="w-full"
        >
          <Play className="mr-2 h-4 w-4" />
          {playNextLoader ? "Loading..." : "Play next"}
        </Button>
      )}
    </div>
  );
}