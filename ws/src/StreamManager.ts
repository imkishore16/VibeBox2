import WebSocket from "ws";
import { createClient, RedisClientType } from "redis";
//@ts-ignore
import { Job, Queue, Worker } from "bullmq";
import { PrismaClient } from "@prisma/client";

import { getSpotifyId, getVideoId, isValidSpotifyURL, isValidYoutubeURL ,checkUrlPlatform, getYouTubeVideoDetails, getSpotifyTrack} from "./utils";

const TIME_SPAN_FOR_VOTE = 1200000; // 20min
const TIME_SPAN_FOR_QUEUE = 1200000; // 20min
const TIME_SPAN_FOR_REPEAT = 3600000;
const MAX_QUEUE_LENGTH = 20;

const connection = {
  username: process.env.REDIS_USERNAME || "",
  password: process.env.REDIS_PASSWORD || "",
  host: process.env.REDIS_HOST || "",
  port: parseInt(process.env.REDIS_PORT || "") || 6379,
};

const redisCredentials = {
  // url: `redis://${connection.username}:${connection.password}@${connection.host}:${connection.port}`,
  url:process.env.REDIS_URL
};

export class RoomManager {
  private static instance: RoomManager;
  public spaces: Map<string, Space>;
  public users: Map<string, User>;
  public redisClient: RedisClientType;
  public publisher: RedisClientType;
  public subscriber: RedisClientType;
  public prisma: PrismaClient;
  public queue: Queue;
  public worker: Worker;
  public wstoSpace: Map<WebSocket, string>;

  private constructor() {
    this.spaces = new Map();
    this.users = new Map();
    this.redisClient = createClient(redisCredentials);
    this.publisher = createClient(redisCredentials);
    this.subscriber = createClient(redisCredentials);
    this.prisma = new PrismaClient();
    this.queue = new Queue(process.pid.toString(), {
      connection,
    });
    this.worker = new Worker(process.pid.toString(), this.processJob, {
      connection,
    });
    this.wstoSpace = new Map();
  }

  static getInstance() {
    if (!RoomManager.instance) {
      RoomManager.instance = new RoomManager();
    }

    return RoomManager.instance;
  }

  async processJob(job: Job) {
    const { data, name } = job;
    if (name === "cast-vote") {
      await RoomManager.getInstance().adminCastVote(
        data.creatorId,
        data.userId,
        data.streamId,
        data.vote,
        data.spaceId
      );
    } else if (name === "add-to-queue") {
      await RoomManager.getInstance().adminAddStreamHandler(
        data.spaceId,
        data.userId,
        data.url,
        data.accessToken,
        data.existingActiveStream
      );
    } else if (name === "boost-song") {
      await RoomManager.getInstance().boostSong(
        data.spaceId,
        data.userId,
        data.streamId,
        data.amount
      );
    } else if (name === "play-next") {
      await RoomManager.getInstance().adminPlayNext(data.spaceId, data.userId);
    } else if (name === "remove-song") {
      await RoomManager.getInstance().adminRemoveSong(
        data.spaceId,
        data.userId,
        data.streamId
      );
    } else if (name === "empty-queue") {
      await RoomManager.getInstance().adminEmptyQueue(data.spaceId);
    }
  }

  async initRedisClient() {
    await this.redisClient.connect();
    await this.subscriber.connect();
    await this.publisher.connect();
  }

  onSubscribeRoom(message: string, spaceId: string) {
    console.log("Subscibe Room", spaceId);
    const { type, data } = JSON.parse(message);
    if (type === "new-stream") {
      RoomManager.getInstance().publishNewStream(spaceId, data);
    } else if (type === "new-vote") {
      RoomManager.getInstance().publishNewVote(
        spaceId,
        data.streamId,
        data.vote,
        data.votedBy
      );
    } else if (type === "play-next") {
      RoomManager.getInstance().publishPlayNext(spaceId);
    } else if (type === "remove-song") {
      RoomManager.getInstance().publishRemoveSong(spaceId, data.streamId);
    } else if (type === "empty-queue") {
      RoomManager.getInstance().publishEmptyQueue(spaceId);
    }
  }

  async createRoom(spaceId: string) {
    console.log(process.pid + ": createRoom: ", { spaceId });
    if (!this.spaces.has(spaceId)) {
      this.spaces.set(spaceId, {
        users: new Map<string, User>(),
        creatorId: "",
      });
      // const roomsString = await this.redisClient.get("rooms");
      // if (roomsString) {
      //   const rooms = JSON.parse(roomsString);
      //   if (!rooms.includes(creatorId)) {
      //     await this.redisClient.set(
      //       "rooms",
      //       JSON.stringify([...rooms, creatorId])
      //     , {
      //       EX: 3600 * 24
      //     });
      //   }
      // } else {
      //   await this.redisClient.set("rooms", JSON.stringify([creatorId]));
      // }
      await this.subscriber.subscribe(spaceId, this.onSubscribeRoom);
    }
  }

  async addUser(userId: string, ws: WebSocket, token: string) {
    let user = this.users.get(userId);
    if (!user) {
      this.users.set(userId, {
        userId,
        ws: [ws],
        token,
      });
    } else {
      if (!user.ws.some((existingWs) => existingWs === ws)) {
        user.ws.push(ws);
      }
    }
  }

  async joinRoom(
    spaceId: string,
    creatorId: string,
    userId: string,
    ws: WebSocket,
    token: string
  ) {
    console.log("Join Room" + spaceId);

    let space = this.spaces.get(spaceId);
    let user = this.users.get(userId);

    if (!space) {
      await this.createRoom(spaceId);
      space = this.spaces.get(spaceId);
    }

    if (!user) {
      await this.addUser(userId, ws, token);
      user = this.users.get(userId);
    } else {
      if (!user.ws.some((existingWs) => existingWs === ws)) {
        user.ws.push(ws);
      }
    }

    this.wstoSpace.set(ws, spaceId);

    if (space && user) {
      space.users.set(userId, user);
      this.spaces.set(spaceId, {
        ...space,
        users: new Map(space.users),
        creatorId: creatorId,
      });
    }
  }

  publishEmptyQueue(spaceId: string) {
    const space = this.spaces.get(spaceId);
    space?.users.forEach((user, userId) => {
      user?.ws.forEach((ws) => {
        ws.send(
          JSON.stringify({
            type: `empty-queue/${spaceId}`,
          })
        );
      });
    });
  }

  async adminEmptyQueue(spaceId: string) {
    const room = this.spaces.get(spaceId);
    const userId = this.spaces.get(spaceId)?.creatorId;
    const user = this.users.get(userId as string);

    if (room && user) {
      await this.prisma.stream.updateMany({
        where: {
          played: false,
          spaceId: spaceId,
        },
        data: {
          played: true,
          playedTs: new Date(),
        },
      });
      await this.publisher.publish(
        spaceId,
        JSON.stringify({
          type: "empty-queue",
        })
      );
    }
  }

  publishRemoveSong(spaceId: string, streamId: string) {
    console.log("publishRemoveSong");
    const space = this.spaces.get(spaceId);
    space?.users.forEach((user, userId) => {
      user?.ws.forEach((ws) => {
        ws.send(
          JSON.stringify({
            type: `remove-song/${spaceId}`,
            data: {
              streamId,
              spaceId,
            },
          })
        );
      });
    });
  }

  publishPlayNext(spaceId: string) {
    const space = this.spaces.get(spaceId);
    space?.users.forEach((user, userId) => {
      user?.ws.forEach((ws) => {
        ws.send(
          JSON.stringify({
            type: `play-next/${spaceId}`,
          })
        );
      });
    });
  }

  async payAndPlayNext(spaceId: string, userId: string, url: string) {
    const creatorId = this.spaces.get(spaceId)?.creatorId;
    console.log("payAndPlayNext", creatorId, userId);
    let targetUser = this.users.get(userId);
    if (!targetUser || !creatorId) {
      return;
    }

    const extractedId = getVideoId(url);

    if (!extractedId) {
      targetUser?.ws.forEach((ws) => {
        ws.send(
          JSON.stringify({
            type: "error",
            data: { message: "Invalid YouTube URL" },
          })
        );
      });
      return;
    }

    const res = await getYouTubeVideoDetails(extractedId);

    if (res.thumbnail) {
      const thumbnails = res.thumbnail.thumbnails;
      thumbnails.sort((a: { width: number }, b: { width: number }) =>
        a.width < b.width ? -1 : 1
      );
      const stream = await this.prisma.stream.create({
        data: {
          id: crypto.randomUUID(),
          userId: creatorId,
          url: url,
          extractedId,
          platform: "YOUTUBE",
          type: "VIDEO",
          addedBy: userId,
          title: res.title ?? "Cant find video",
          // smallImg: video.thumbnails.medium.url,
          // bigImg: video.thumbnails.high.url,
          smallImg:
            (thumbnails.length > 1
              ? thumbnails[thumbnails.length - 2].url
              : thumbnails[thumbnails.length - 1].url) ??
            "https://cdn.pixabay.com/photo/2024/02/28/07/42/european-shorthair-8601492_640.jpg",
          bigImg:
            thumbnails[thumbnails.length - 1].url ??
            "https://cdn.pixabay.com/photo/2024/02/28/07/42/european-shorthair-8601492_640.jpg",
          spaceId: spaceId,
        },
      });
      // update currentStream
      await Promise.all([
        this.prisma.currentStream.upsert({
          where: {
            spaceId: spaceId,
          },
          update: {
            spaceId: spaceId,
            userId,
            streamId: stream.id,
          },
          create: {
            id: crypto.randomUUID(),
            spaceId: spaceId,
            userId,
            streamId: stream.id,
          },
        }),
        this.prisma.stream.update({
          where: {
            id: stream.id,
          },
          data: {
            played: true,
            playedTs: new Date(),
          },
        }),
      ]);
      await this.publisher.publish(
        spaceId,
        JSON.stringify({
          type: "play-next",
        })
      );
    }
  }

  async adminPlayNext(spaceId: string, userId: string) {
    const creatorId = this.spaces.get(spaceId)?.creatorId;
    console.log("adminPlayNext", creatorId, userId);
    let targetUser = this.users.get(userId);
    if (!targetUser) {
      return;
    }

    if (targetUser.userId !== creatorId) {
      targetUser.ws.forEach((ws) => {
        ws.send(
          JSON.stringify({
            type: "error",
            data: {
              message: "You can't perform this action.",
            },
          })
        );
      });
      return;
    }

    const mostUpvotedStream = await this.prisma.stream.findFirst({
      where: {
        played: false,
        spaceId: spaceId,
      },
      orderBy: {
        upvotes: {
          _count: "desc",
        },
      },
    });

    if (!mostUpvotedStream) {
      targetUser.ws.forEach((ws) => {
        ws.send(
          JSON.stringify({
            type: "error",
            data: {
              message: "Please add video in queue",
            },
          })
        );
      });
      return;
    }

    await Promise.all([
      this.prisma.currentStream.upsert({
        where: {
          spaceId: spaceId,
        },
        update: {
          spaceId: spaceId,
          userId,
          streamId: mostUpvotedStream.id,
        },
        create: {
          spaceId: spaceId,
          userId,
          streamId: mostUpvotedStream.id,
        },
      }),
      this.prisma.stream.update({
        where: {
          id: mostUpvotedStream.id,
        },
        data: {
          played: true,
          playedTs: new Date(),
        },
      }),
    ]);

    let previousQueueLength = parseInt(
      (await this.redisClient.get(`queue-length-${spaceId}`)) || "1",
      10
    );
    if (previousQueueLength) {
      await this.redisClient.set(
        `queue-length-${spaceId}`,
        previousQueueLength - 1
      );
    }

    await this.publisher.publish(
      spaceId,
      JSON.stringify({
        type: "play-next",
      })
    );
  }

  publishNewVote(
    spaceId: string,
    streamId: string,
    vote: "upvote" | "downvote",
    votedBy: string
  ) {
    console.log(process.pid + " publishNewVote");
    const spaces = this.spaces.get(spaceId);
    spaces?.users.forEach((user, userId) => {
      user?.ws.forEach((ws) => {
        ws.send(
          JSON.stringify({
            type: `new-vote/${spaceId}`,
            data: {
              vote,
              streamId,
              votedBy,
              spaceId,
            },
          })
        );
      });
    });
  }

  async adminCastVote(
    creatorId: string,
    userId: string,
    streamId: string,
    vote: string,
    spaceId: string
  ) {
    console.log(process.pid + " adminCastVote");
    if (vote === "upvote") {
      await this.prisma.upvote.create({
        data: {
          id: crypto.randomUUID(),
          userId,
          streamId,
        },
      });
    } else {
      await this.prisma.upvote.delete({
        where: {
          userId_streamId: {
            userId,
            streamId,
          },
        },
      });
    }
    await this.redisClient.set(
      `lastVoted-${spaceId}-${userId}`,
      new Date().getTime(),
      {
        EX: TIME_SPAN_FOR_VOTE / 1000,
      }
    );

    await this.publisher.publish(
      spaceId,
      JSON.stringify({
        type: "new-vote",
        data: { streamId, vote, votedBy: userId },
      })
    );
  }

  async castVote(
    userId: string,
    streamId: string,
    vote: "upvote" | "downvote",
    spaceId: string
  ) {
    console.log(process.pid + " castVote");
    const space = this.spaces.get(spaceId);
    const currentUser = this.users.get(userId);
    const creatorId = this.spaces.get(spaceId)?.creatorId;
    const isCreator = currentUser?.userId === creatorId;

    if (!space || !currentUser) {
      return;
    }
    if (!isCreator) {
      const lastVoted = await this.redisClient.get(
        `lastVoted-${spaceId}-${userId}`
      );

      if (lastVoted) {
        currentUser?.ws.forEach((ws) => {
          ws.send(
            JSON.stringify({
              type: "error",
              data: {
                message: "You can vote after 20 mins",
              },
            })
          );
        });
        return;
      }
    }

    await this.queue.add("cast-vote", {
      creatorId,
      userId,
      streamId,
      vote,
      spaceId: spaceId,
    });
  }

  publishNewStream(spaceId: string, data: any) {
    console.log(process.pid + ": publishNewStream");
    console.log("Publish New Stream", spaceId);
    const space = this.spaces.get(spaceId);

    if (space) {
      space?.users.forEach((user, userId) => {
        user?.ws.forEach((ws) => {
          ws.send(
            JSON.stringify({
              type: `new-stream/${spaceId}`,
              data: data,
            })
          );
        });
      });
    }
  }

  async adminAddStreamHandler(
    spaceId: string,
    userId: string,
    url: string,
    accessToken:string,
    existingActiveStream: number
  ) {
    console.log(process.pid + " adminAddStreamHandler ");
    console.log(accessToken + " access token ");

    console.log("adminAddStreamHandler", spaceId);
    const room = this.spaces.get(spaceId);
    const currentUser = this.users.get(userId);
    if (!room || typeof existingActiveStream !== "number") {
      return;
    }
    const platform = checkUrlPlatform(url)
    const extractedId = platform==="youtube"?getVideoId(url):getSpotifyId(url);

    if (!extractedId) {
      currentUser?.ws.forEach((ws) => {
        ws.send(
          JSON.stringify({
            type: "error",
            data: { message: "Invalid URL" },
          })
        );
      });
      return;
    }

    await this.redisClient.set(
      `queue-length-${spaceId}`,
      existingActiveStream + 1
    );

    let res;
    try{
      res = platform==="youtube"?await getYouTubeVideoDetails(extractedId):await getSpotifyTrack(extractedId,accessToken);
      console.log(platform)
      console.log(res)
    }
    catch(e)
    {
      console.log(e)
    }
    
    console.log("in ws adminAddhandler ",extractedId)
    //handle spotify
    if(platform==="spotify")
      {
        console.log("user" , userId)
        console.log("handling spotify url")
        const thumbnails = res.body.album.images;
        thumbnails.sort((a: { width: number }, b: { width: number }) =>
        a.width < b.width ? -1 : 1
          );
          console.log(res.body)
          console.log(res.body.external_urls)
          let stream ;
          try{
            stream = await this.prisma.stream.create({
              data: {
                id: crypto.randomUUID(),
                url: res.body.external_urls.spotify,
                extractedId,
                type: "AUDIO",
                platform:"SPOTIFY",
                userId: userId,
                addedBy: userId,
                title: res.body.album.name ?? "Cant find video",
                smallImg:
                  (thumbnails.length > 1
                    ? thumbnails[thumbnails.length - 2].url
                    : thumbnails[thumbnails.length - 1].url) ??
                  "https://cdn.pixabay.com/photo/2024/02/28/07/42/european-shorthair-8601492_640.jpg",
                bigImg:
                  thumbnails[thumbnails.length - 1].url ??
                  "https://cdn.pixabay.com/photo/2024/02/28/07/42/european-shorthair-8601492_640.jpg",
                spaceId: spaceId,
              },
            });
          }
          catch(e){
            console.log("error" , e)
          }
        

      await this.redisClient.set(`${spaceId}-${url}`, new Date().getTime(), {
        EX: TIME_SPAN_FOR_REPEAT / 1000,
      });

      await this.redisClient.set(
        `lastAdded-${spaceId}-${userId}`,
        new Date().getTime(),
        {
          EX: TIME_SPAN_FOR_QUEUE / 1000,
        }
      );

      await this.publisher.publish(
        spaceId,
        JSON.stringify({
          type: "new-stream",
          data: {
            ...stream,
            hasUpvoted: false,
            upvotes: 0,
          },
        })
      );
    }
    
    // handle yt url
    // if (res.thumbnail) {
    else if (platform=="youtube"){
      console.log("handling yt")
      console.log(res)
      
      const thumbnails = res.thumbnail.thumbnails;
      thumbnails.sort((a: { width: number }, b: { width: number }) =>
        a.width < b.width ? -1 : 1
      );
      console.log(thumbnails[0])
      const stream = await this.prisma.stream.create({
        data: {
          id: crypto.randomUUID(),
          userId: userId,
          url: url,
          extractedId,
          type: "VIDEO",
          platform:"YOUTUBE",
          addedBy: userId,
          title: res.title ?? "Cant find video",
          smallImg:
            (thumbnails.length > 1
              ? thumbnails[thumbnails.length - 2].url
              : thumbnails[thumbnails.length - 1].url) ??
            "https://cdn.pixabay.com/photo/2024/02/28/07/42/european-shorthair-8601492_640.jpg",
          bigImg:
            thumbnails[thumbnails.length - 1].url ??
            "https://cdn.pixabay.com/photo/2024/02/28/07/42/european-shorthair-8601492_640.jpg",
          spaceId: spaceId,
        },
      });

      await this.redisClient.set(`${spaceId}-${url}`, new Date().getTime(), {
        EX: TIME_SPAN_FOR_REPEAT / 1000,
      });

      await this.redisClient.set(
        `lastAdded-${spaceId}-${userId}`,
        new Date().getTime(),
        {
          EX: TIME_SPAN_FOR_QUEUE / 1000,
        }
      );

      await this.publisher.publish(
        spaceId,
        JSON.stringify({
          type: "new-stream",
          data: {
            ...stream,
            hasUpvoted: false,
            upvotes: 0,
          },
        })
      );
    } 
    
    else {
      currentUser?.ws.forEach((ws) => {
        ws.send(
          JSON.stringify({
            type: "error",
            data: {
              message: "Video not found",
            },
          })
        );
      });
    }
  }

  async addToQueue(spaceId: string, currentUserId: string, url: string , accessToken:string) {
    console.log(process.pid + ": addToQueue");

    const space = this.spaces.get(spaceId);
    const currentUser = this.users.get(currentUserId);
    const creatorId = this.spaces.get(spaceId)?.creatorId;
    const isCreator = currentUserId === creatorId;

    if (!space || !currentUser) {
      console.log("433: Room or User not defined");
      return;
    }

    if (!isValidYoutubeURL(url) && !isValidSpotifyURL(url)) {
      currentUser?.ws.forEach(( ws) => {
        ws.send(
          JSON.stringify({
            type: "error",
            data: { message: "Invalid YouTube URL" },
          })
        );
      });
      return;
    }

    let previousQueueLength = parseInt(
      (await this.redisClient.get(`queue-length-${spaceId}`)) || "0",
      10
    );

    // Checking if its zero that means there was no record in
    if (!previousQueueLength) {
      previousQueueLength = await this.prisma.stream.count({
        where: {
          spaceId: spaceId,
          played: false,
        },
      });
    }

    if (!isCreator) {
      let lastAdded = await this.redisClient.get(
        `lastAdded-${spaceId}-${currentUserId}`
      );

      if (lastAdded) {
        currentUser.ws.forEach((ws) => {
          ws.send(
            JSON.stringify({
              type: "error",
              data: {
                message: "You can add again after 20 min.",
              },
            })
          );
        });
        return;
      }
      let alreadyAdded = await this.redisClient.get(`${spaceId}-${url}`);

      if (alreadyAdded) {
        currentUser.ws.forEach((ws) => {
          ws.send(
            JSON.stringify({
              type: "error",
              data: {
                message: "This song is blocked for 1 hour",
              },
            })
          );
        });
        return;
      }

      if (previousQueueLength >= MAX_QUEUE_LENGTH) {
        currentUser.ws.forEach((ws) => {
          ws.send(
            JSON.stringify({
              type: "error",
              data: {
                message: "Queue limit reached",
              },
            })
          );
        });
        return;
      }
    }

    await this.queue.add("add-to-queue", {
      spaceId,
      userId: currentUser.userId,
      url,
      accessToken,
      existingActiveStream: previousQueueLength,
    });
  }

  disconnect(ws: WebSocket) {
    console.log(process.pid + ": disconnect");
    let userId: string | null = null;
    const spaceId = this.wstoSpace.get(ws);
    this.users.forEach((user, id) => {
      const wsIndex = user.ws.indexOf(ws);

      if (wsIndex !== -1) {
        userId = id;
        user.ws.splice(wsIndex, 1);
      }
      if (user.ws.length === 0) {
        this.users.delete(id);
      }
    });

    if (userId && spaceId) {
      const space = this.spaces.get(spaceId);
      if (space) {
        const updatedUsers = new Map(
          Array.from(space.users).filter(([usrId]) => userId !== usrId)
        );
        this.spaces.set(spaceId, {
          ...space,
          users: updatedUsers,
        });
      }
    }
  }

  publishBoost(spaceId: string, streamId: string, amount: number, totalPaidAmount: number) {
    const space = this.spaces.get(spaceId);
    space?.users.forEach((user) => {
      user?.ws.forEach((ws) => {
        ws.send(
          JSON.stringify({
            type: `boost-song/${spaceId}`,
            data: {
              streamId,
              amount,
              paidAmount: totalPaidAmount
            }
          })
        );
      });
    });
  }

  publishTokenUpdate(userId: string, newTokenAmount: number) {
    const user = this.users.get(userId);
    user?.ws.forEach((ws) => {
      ws.send(
        JSON.stringify({
          type: "token-update",
          data: {
            tokens: newTokenAmount
          }
        })
      );
    });
  }

  async boostSong(spaceId: string, userId: string, streamId: string, amount: number) {
    const currentUser = this.users.get(userId);
    if (!currentUser) return;

    try {
      const updatedStream = await this.prisma.$transaction(async (tx) => {
        // Get the stream and verify ownership and played status
        const stream = await tx.stream.findUnique({
          where: { id: streamId },
          select: { 
            addedBy: true,
            played: true,
            paidAmount: true
          }
        });

        if (!stream) {
          throw new Error("Stream not found");
        }

        if (stream.addedBy !== userId) {
          throw new Error("Only the song owner can boost it");
        }

        if (stream.played) {
          throw new Error("Cannot boost a song that has already been played");
        }

        // Get user's current tokens
        const user = await tx.user.findUnique({
          where: { id: userId },
          select: { tokens: true }
        });

        if (!user || user.tokens < amount) {
          throw new Error("Insufficient tokens");
        }

        // Update user's tokens
        const updatedUser = await tx.user.update({
          where: { id: userId },
          data: { tokens: { decrement: amount } }
        });

        // Create transaction record
        await tx.transaction.create({
          data: {
            userId,
            amount: -amount,
            type: "PRIORITY_BOOST",
            description: `Boosted song in queue (${streamId})`
          }
        });

        // Update stream's paid amount and return both updated stream and user
        const updatedStream = await tx.stream.update({
          where: { id: streamId },
          data: { paidAmount: { increment: amount } }
        });

        return { stream: updatedStream, userTokens: updatedUser.tokens };
      });

      // Publish both the boost update and token update
      this.publishBoost(spaceId, streamId, amount, updatedStream.stream.paidAmount);
      this.publishTokenUpdate(userId, updatedStream.userTokens);

    } catch (error) {
      console.error("Error boosting song:", error);
      currentUser.ws.forEach((ws) => {
        ws.send(
          JSON.stringify({
            type: "error",
            data: {
              message: error instanceof Error ? error.message : "Error boosting song"
            }
          })
        );
      });
    }
  }

  async adminRemoveSong(spaceId: string, userId: string, streamId: string) {
    console.log("adminRemoveSong");
    const user = this.users.get(userId);
    const creatorId = this.spaces.get(spaceId)?.creatorId;

    if (user && userId === creatorId) {
      try {
        const result = await this.prisma.$transaction(async (tx) => {
          // Get the stream to check for tokens to refund
          const stream = await tx.stream.findUnique({
            where: { id: streamId },
            select: { 
              addedBy: true,
              paidAmount: true,
              title: true
            }
          });

          if (!stream) {
            throw new Error("Stream not found");
          }

          // Delete the stream first
          await tx.stream.delete({
            where: {
              id: streamId,
            },
          });

          // Send notification to song owner
          const songOwner = this.users.get(stream.addedBy);
          if (songOwner) {
            songOwner.ws.forEach((ws) => {
              ws.send(
                JSON.stringify({
                  type: "notification",
                  data: {
                    message: `Your song "${stream.title}" has been removed by the host${stream.paidAmount > 0 ? `. ${stream.paidAmount} tokens have been refunded to your account` : ''}`
                  }
                })
              );
            });
          }

          if (stream.paidAmount > 0) {
            // Refund tokens to the song owner
            const updatedUser = await tx.user.update({
              where: { id: stream.addedBy },
              data: { tokens: { increment: stream.paidAmount } }
            });

            // Create refund transaction record
            await tx.transaction.create({
              data: {
                userId: stream.addedBy,
                amount: stream.paidAmount,
                type: "PRIORITY_BOOST",
                description: `Refund for removed song (${streamId})`
              }
            });

            return { 
              songOwner: stream.addedBy,
              refundAmount: stream.paidAmount,
              newTokenBalance: updatedUser.tokens
            };
          }

          return null;
        });

        // If there was a refund, notify the user about their updated token balance
        if (result) {
          this.publishTokenUpdate(result.songOwner, result.newTokenBalance);
        }

        // Notify about song removal
        await this.publisher.publish(
          spaceId,
          JSON.stringify({
            type: "remove-song",
            data: {
              streamId,
              spaceId,
            },
          })
        );

      } catch (error) {
        console.error("Error removing song:", error);
        user.ws.forEach((ws) => {
          ws.send(
            JSON.stringify({
              type: "error",
              data: {
                message: error instanceof Error ? error.message : "Error removing song"
              }
            })
          );
        });
      }
    } else {
      user?.ws.forEach((ws) => {
        ws.send(
          JSON.stringify({
            type: "error",
            data: {
              message: "You can't remove the song. You are not the host",
            },
          })
        );
      });
    }
  }
}

type User = {
  userId: string;
  ws: WebSocket[];
  token: string;
};

type Space = {
  creatorId: string;
  users: Map<String, User>;
};
