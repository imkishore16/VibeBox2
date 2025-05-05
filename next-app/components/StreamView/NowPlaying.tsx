"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Play, Youtube, Music } from "lucide-react"
import Image from "next/image"
import ColorThief from "colorthief"
import { AudioEqualizer } from "@/components/audio-equalizer"

export type Video = {
  platform: "YOUTUBE" | "SPOTIFY"
  extractedId: string
  title: string
  bigImg: string
  url: string
}

type Props = {
  playVideo: boolean
  currentVideo: Video | null
  playNextLoader: boolean
  playNext: () => void
}

export default function NowPlaying({ playVideo, currentVideo, playNext, playNextLoader }: Props) {
  const [dominantColors, setDominantColors] = useState<[number, number, number][]>([])
  const [gradientStyle, setGradientStyle] = useState<React.CSSProperties>({})

  useEffect(() => {
    let isSubscribed = true;

    const loadImage = async () => {
      if (!currentVideo) return;
      
      try {
        const img = document.createElement("img");
        img.crossOrigin = "Anonymous";
        img.src = currentVideo.bigImg;

        img.onload = () => {
          if (!isSubscribed) return;
          
          const colorThief = new ColorThief();
          try {
            const palette = colorThief.getPalette(img, 3);
            if (!isSubscribed) return;
            
            setDominantColors(palette);
            const gradientColors = palette.map((color) => `rgba(${color[0]}, ${color[1]}, ${color[2]}, 0.3)`);

            setGradientStyle({
              background: `linear-gradient(135deg, ${gradientColors.join(", ")})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              boxShadow: "0 8px 32px 0 rgba(0, 0, 0, 0.37)",
              borderRadius: "16px",
              transition: "all 0.5s ease-in-out",
            });
          } catch (error) {
            console.error("Error extracting colors:", error);
            if (isSubscribed) {
              setDefaultGradient();
            }
          }
        };

        img.onerror = () => {
          if (!isSubscribed) return;
          console.error("Error loading image directly, trying with blob URL");
          fetch(currentVideo.bigImg)
            .then((response) => response.blob())
            .then((blob) => {
              if (!isSubscribed) return;
              const blobUrl = URL.createObjectURL(blob);
              img.src = blobUrl;
            })
            .catch((error) => {
              console.error("Error loading image:", error);
              if (isSubscribed) {
                setDefaultGradient();
              }
            });
        };
      } catch (error) {
        console.error("Error in loadImage:", error);
        if (isSubscribed) {
          setDefaultGradient();
        }
      }
    };

    loadImage();

    return () => {
      isSubscribed = false;
    };
  }, [currentVideo?.bigImg]); // Only depend on the image URL

  const setDefaultGradient = () => {
    setGradientStyle({
      background: "linear-gradient(135deg, rgba(30, 30, 30, 0.4), rgba(60, 60, 60, 0.3))",
      backdropFilter: "blur(20px)",
      WebkitBackdropFilter: "blur(20px)",
      border: "1px solid rgba(255, 255, 255, 0.15)",
      boxShadow: "0 8px 32px 0 rgba(0, 0, 0, 0.37)",
      borderRadius: "16px",
      transition: "all 0.5s ease-in-out",
    });
  };

  const renderMediaPlayer = () => {
    if (!currentVideo || !playVideo) return null

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
            const iframe = e.currentTarget
            window.addEventListener("message", (event) => {
              if (event.source === iframe.contentWindow) {
                try {
                  const data = JSON.parse(event.data)
                  if (data.event === "onStateChange" && data.info === 0) {
                    // Video ended (state 0)
                    playNext()
                  }
                } catch (error) {
                  // Ignore parsing errors
                }
              }
            })
          }}
        />
      )
    } else if (currentVideo.platform === "SPOTIFY") {
      return (
        <iframe
          src={`https://open.spotify.com/embed/track/${currentVideo.extractedId}?utm_source=generator&theme=0&autoplay=1`}
          width="100%"
          height="352"
          frameBorder="0"
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          loading="lazy"
          className="rounded"
          onLoad={(e) => {
            window.addEventListener("message", (event) => {
              try {
                const data = JSON.parse(event.data)
                if (
                  data.type === "player_state_changed" &&
                  data.payload &&
                  data.payload.progress === 0 &&
                  data.payload.paused === true
                ) {
                  playNext()
                }
              } catch (error) {}
            })
          }}
        />
      )
    }

    return null
  }

  const renderPlatformIcon = () => {
    if (!currentVideo) return null

    if (currentVideo.platform === "YOUTUBE") {
      return <Youtube className="mr-2 h-6 w-6 text-red-500" />
    } else {
      return <Music className="mr-2 h-6 w-6 text-green-500" />
    }
  }

  return (
    <div
      className="space-y-4 rounded-xl p-6 relative overflow-hidden transition-all duration-500 ease-in-out"
      style={{
        ...(currentVideo ? gradientStyle : {}),
        boxShadow: "0 8px 32px 0 rgba(0, 0, 0, 0.37)",
      }}
    >
      {currentVideo && (
        <div
          className="absolute inset-0 -z-10"
          style={{
            backgroundImage: `url(${currentVideo.bigImg})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            filter: "blur(30px) brightness(0.6)",
            transform: "scale(1.2)",
          }}
        />
      )}
      <div className="flex items-center relative z-10">
        {renderPlatformIcon()}
        <h2 className="text-2xl font-bold text-white/90">Now Playing</h2>
      </div>

      <Card className="bg-black/20 backdrop-blur-md border-white/20 relative z-10 overflow-hidden">
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
                    src={currentVideo.bigImg || "/placeholder.svg"}
                    className="h-72 w-full rounded-lg object-cover"
                    priority
                  />
                  <p className="mt-2 text-center font-semibold text-white/90">{currentVideo.title}</p>
                </>
              )}
            </div>
          ) : (
            <p className="py-8 text-center text-white/70">No media playing</p>
          )}
        </CardContent>
      </Card>

      {currentVideo && <AudioEqualizer isPlaying={!!playVideo} dominantColors={dominantColors} />}

      <Button
        disabled={playNextLoader}
        onClick={playNext}
        className="w-full bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/10 relative z-10"
      >
        <Play className="mr-2 h-4 w-4" />
        <span className="text-white/90">{playNextLoader ? "Loading..." : "Play next"}</span>
      </Button>
    </div>
  )
}
