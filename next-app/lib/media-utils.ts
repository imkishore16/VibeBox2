export const getPlatformColor = (platform: "YOUTUBE" | "SPOTIFY"): string => {
    switch (platform) {
      case "YOUTUBE":
        return "text-red-600";
      case "SPOTIFY":
        return "text-green-500";
      default:
        return "text-gray-500";
    }
  };