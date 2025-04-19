import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
//@ts-ignore
import youtubesearchapi from "youtube-search-api";
import { YT_REGEX ,SPOTIFY_REGEX} from "@/lib/utils";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { getSpotifyAccessToken } from "@/app/actions/spotifyToken";


const CreateStreamSchema = z.object({
  creatorId: z.string(),
  url: z.string(),
  spaceId:z.string()
});

const MAX_QUEUE_LEN = 20;

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user.id) {
      return NextResponse.json(
        {
          message: "Unauthenticated",
        },
        {
          status: 403,
        },
      );
    }
    const user = session.user;

    const data = CreateStreamSchema.parse(await req.json());

    if (!data.url.trim()) {
      return NextResponse.json(
        {
          message: "YouTube link cannot be empty",
        },
        {
          status: 400,
        },
      );
    }

    const ytMatch = data.url.match(YT_REGEX);
    const spotifyMatch = data.url.match(SPOTIFY_REGEX);

    let videoId: string | null = null;
    let title = "";
    let thumbnail = "";
    let platform: "YOUTUBE" | "SPOTIFY" = "YOUTUBE";

    

    if (ytMatch) {
      videoId = ytMatch[1];
      const res = await youtubesearchapi.GetVideoDetails(videoId);
      title = res.title ?? "Can't find video";
      const thumbnails = res.thumbnail.thumbnails;
      thumbnails.sort((a: { width: number }, b: { width: number }) =>
        a.width < b.width ? -1 : 1
      );
      thumbnail = thumbnails[thumbnails.length - 1]?.url;
      platform = "YOUTUBE";
    } else if (spotifyMatch) {
      videoId = spotifyMatch[1];
      const res = await getSpotifyTrackDetails(videoId); // You’ll implement this
      title = res.title;
      thumbnail = res.thumbnail;
      platform = "SPOTIFY";
    } else {
      return NextResponse.json({ message: "Invalid URL format" }, { status: 400 });
    }


    // Check if the user is not the creator
    if (user.id !== data.creatorId) {
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);

      const userRecentStreams = await db.stream.count({
        where: {
          userId: data.creatorId,
          addedBy: user.id,
          createAt: {
            gte: tenMinutesAgo,
          },
        },
      });

      // Check for duplicate song in the last 10 minutes
      const duplicateSong = await db.stream.findFirst({
        where: {
          userId: data.creatorId,
          extractedId: videoId,
          createAt: {
            gte: tenMinutesAgo,
          },
        },
      });
      if (duplicateSong) {
        return NextResponse.json(
          {
            message: "This song was already added in the last 10 minutes",
          },
          {
            status: 429,
          },
        );
      }

      // Rate limiting checks for non-creator users
      const streamsLastTwoMinutes = await db.stream.count({
        where: {
          userId: data.creatorId,
          addedBy: user.id,
          createAt: {
            gte: twoMinutesAgo,
          },
        },
      });

      if (streamsLastTwoMinutes >= 2) {
        return NextResponse.json(
          {
            message:
              "Rate limit exceeded: You can only add 2 songs per 2 minutes",
          },
          {
            status: 429,
          },
        );
      }

      if (userRecentStreams >= 5) {
        return NextResponse.json(
          {
            message:
              "Rate limit exceeded: You can only add 5 songs per 10 minutes",
          },
          {
            status: 429,
          },
        );
      }
    }

    const existingActiveStreams = await db.stream.count({
      where: {
        spaceId: data.spaceId,
        played: false,
      },
    });

    if (existingActiveStreams >= MAX_QUEUE_LEN) {
      return NextResponse.json(
        {
          message: "Queue is full",
        },
        {
          status: 429,
        },
      );
    }

    const stream = await db.stream.create({
      data: {
        userId: data.creatorId,
        addedBy: user.id,
        url: data.url,
        extractedId: videoId,
        type: ytMatch ? "VIDEO" : "AUDIO",
        title:title ?? "Can't find",
        smallImg:
          thumbnail ??
          "https://cdn.pixabay.com/photo/2024/02/28/07/42/european-shorthair-8601492_640.jpg",
        bigImg:
          thumbnail ??
          "https://cdn.pixabay.com/photo/2024/02/28/07/42/european-shorthair-8601492_640.jpg",
        spaceId:data.spaceId,
        platform:platform
      },
    });

    return NextResponse.json({
      ...stream,
      hasUpvoted: false,
      upvotes: 0,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      {
        message: "Error while adding a stream",
      },
      {
        status: 500,
      },
    );
  }
}


export async function getSpotifyTrackDetails(trackId: string): Promise<{
  title: string;
  thumbnail: string;
}> {
  try {
    const token = await getSpotifyAccessToken();

    const trackRes = await fetch(`https://api.spotify.com/v1/tracks/${trackId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!trackRes.ok) {
      throw new Error(`Spotify track not found: ${trackId}`);
    }

    const trackData = await trackRes.json();

    return {
      title: `${trackData.name} - ${trackData.artists.map((a: any) => a.name).join(", ")}`,
      thumbnail: trackData.album.images[0]?.url || "", // Largest image
    };
  } catch (err) {
    console.error("Spotify fetch error:", err);
    return {
      title: "Unknown Spotify Track",
      thumbnail: "https://cdn.pixabay.com/photo/2024/02/28/07/42/european-shorthair-8601492_640.jpg",
    };
  }
}

export async function GET(req: NextRequest) {
  const spaceId = req.nextUrl.searchParams.get("spaceId");
  const session = await getServerSession(authOptions);
  if (!session?.user.id) {
    return NextResponse.json(
      {
        message: "Unauthenticated",
      },
      {
        status: 403,
      },
    );
  }
  const user = session.user;

  if (!spaceId) {
    return NextResponse.json({
        message: "Error"
    }, {
        status: 411
    })
}

  const [space, activeStream] = await Promise.all([
    db.space.findUnique({
      where: {
          id: spaceId,
      },
      include: {
          streams: {
              include: {
                  _count: {
                      select: {
                          upvotes: true
                      }
                  },
                  upvotes: {
                      where: {
                          userId: session?.user.id
                      }
                  }

              },
              where:{
                  played:false
              }
          },
          _count: {
              select: {
                  streams: true
              }
          },                

      }
      
  }),
  db.currentStream.findFirst({
      where: {
          spaceId: spaceId
      },
      include: {
          stream: true
      }
  })
  ]);

  const hostId =space?.hostId;
  const isCreator = session.user.id=== hostId

  return NextResponse.json({
    streams: space?.streams.map(({_count, ...rest}) => ({
        ...rest,
        upvotes: _count.upvotes,
        haveUpvoted: rest.upvotes.length ? true : false
    })),
    activeStream,
    hostId,
    isCreator,
    spaceName:space?.name
});
}
