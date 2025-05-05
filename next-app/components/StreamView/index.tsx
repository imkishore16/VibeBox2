"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import "react-lite-youtube-embed/dist/LiteYouTubeEmbed.css";

import { useSocket } from "@/context/socket-context";
import { useSession } from "next-auth/react";
import NowPlaying from "./NowPlaying";
import Queue from "./Queue";
import AddSongForm from "./AddSongForm";
import { Appbar } from "../Appbar";

export default function StreamView({
  creatorId,
  playVideo = false,
  spaceId,
}: {
  creatorId: string;
  playVideo: boolean;
  spaceId: string;
}) {
  const [inputLink, setInputLink] = useState("");
  const [queue, setQueue] = useState<Video[]>([]);
  const [currentVideo, setCurrentVideo] = useState<Video | null>(null);
  const [loading, setLoading] = useState(false);
  const [playNextLoader, setPlayNextLoader] = useState(false);
  const [spaceName, setSpaceName] = useState("");

  const { socket, sendMessage } = useSocket();
  const user = useSession().data?.user;

  useEffect(() => {
    if (socket) {
      socket.onmessage = async (event) => {
        const { type, data } = JSON.parse(event.data) || {};
        if (type === `new-stream/${spaceId}`) {
          console.log(type);
          addToQueue(data);
        } else if (type === `new-vote/${spaceId}`) {
          setQueue((prev) => {
            return prev
              .map((v) => {
                if (v.id === data.streamId) {
                  return {
                    ...v,
                    upvotes: v.upvotes + (data.vote === "upvote" ? 1 : -1),
                    haveUpvoted:
                      data.votedBy === user?.id
                        ? data.vote === "upvote"
                        : v.haveUpvoted,
                  };
                }
                return v;
              })
              .sort((a, b) => b.upvotes - a.upvotes);
          });
        } else if (type === "error") {
          enqueueToast("error", data.message);
          setLoading(false);
        } else if (type === `play-next/${spaceId}`) {
          await refreshStreams();
        } else if (type === `remove-song/${spaceId}`) {
          setQueue((prev) => {
            return prev.filter((stream) => stream.id !== data.streamId);
          });
        } else if (type === `empty-queue/${spaceId}`) {
          setQueue([]);
        }
      };
    }
  }, [socket]);

  useEffect(() => {
    console.log("refreshing")
    refreshStreams();
  }, []);

  async function addToQueue(newStream: any) {
    setQueue((prev) => [...prev, newStream]);
    setInputLink("");
    setLoading(false);
  }

  async function refreshStreams() {
    try {
      const res = await fetch(`/api/streams/?spaceId=${spaceId}`, {
        credentials: "include",
      });
      const json = await res.json();
      console.log("json" , json)
      setQueue(
        json.streams.sort((a: any, b: any) => (a.upvotes < b.upvotes ? 1 : -1)),
      );
      if (json.activeStream?.stream) {
        setCurrentVideo((video) => {
          console.log(video)
          if (video?.id === json.activeStream?.stream?.id) {
            console.log("video : " , video)
            return video;
          }
          return json.activeStream.stream;
        });
      }
      else {
        setCurrentVideo(null); 
      }
      setSpaceName(json.spaceName);
    } catch (error) {
      enqueueToast("error", "Something went wrong");
    }

    setPlayNextLoader(false);
  }

  const playNext = async () => {
    setPlayNextLoader(true);
    sendMessage("play-next", {
      spaceId,
      userId: user?.id,
    });
  };

  const enqueueToast = (type: "error" | "success", message: string) => {
    const toastFn = type === "error" ? toast.error : toast.success;
  
    toastFn(message, {
      duration: 5000,
    });
  };
  

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-gray-800">
      <Appbar isSpectator={!playVideo} />
      
      {/* Main Content Container */}
      <main className="container mx-auto px-4 py-6">
        {/* Space Name Header */}
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-center">
            <span className="bg-white/5 backdrop-blur-sm border border-white/10 px-6 py-3 rounded-lg inline-block">
              {spaceName}
            </span>
          </h1>
        </div>

        {/* Main Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 max-w-[1600px] mx-auto">
          {/* Queue Section - Larger on desktop */}
          <div className="lg:col-span-5 xl:col-span-4 space-y-6">
            <div className="sticky top-4">
              <Queue
                creatorId={creatorId}
                isCreator={playVideo}
                queue={queue}
                userId={user?.id || ""}
                spaceId={spaceId}
              />
            </div>
          </div>

          {/* Player Section - Center on desktop */}
          <div className="lg:col-span-7 xl:col-span-8 space-y-6">
            {/* Add Song Form */}
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
              <AddSongForm
                creatorId={creatorId}
                userId={user?.id || ""}
                enqueueToast={enqueueToast}
                inputLink={inputLink}
                loading={loading}
                setInputLink={setInputLink}
                setLoading={setLoading}
                spaceId={spaceId}
                isSpectator={!playVideo}
              />
            </div>

            {/* Now Playing Section */}
            <div className="relative">
              <NowPlaying
                currentVideo={currentVideo}
                playNext={playNext}
                playNextLoader={playNextLoader}
                playVideo={playVideo}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
