import { VideoCardLink } from "@/components/video-card-link";
import { hasFootage } from "@/lib/video/footage";
import type { VideoRecord } from "@/lib/video/schema";

export const VideoCard = ({ video }: { video: VideoRecord }) => {
  const failed = video.status === "failed" || !video.plan;
  const href = failed ? `/videos/${video.id}` : `/editor/open/${video.id}`;

  return (
    <VideoCardLink
      video={video}
      href={href}
      failed={failed}
      footageUrl={hasFootage(video.id) ? `/api/videos/${video.id}/file` : undefined}
    />
  );
};
