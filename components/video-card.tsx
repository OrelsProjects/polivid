import { DeleteVideoButton } from "@/components/delete-video-button";
import { VideoCardLink } from "@/components/video-card-link";
import { hasFootage } from "@/lib/video/footage";
import type { VideoRecord } from "@/lib/video/schema";

export const VideoCard = async ({ video }: { video: VideoRecord }) => {
  const failed = video.status === "failed" || !video.plan;
  const href = failed ? `/videos/${video.id}` : `/editor/open/${video.id}`;
  const footageUrl = !failed && (await hasFootage(video.id)) ? `/api/videos/${video.id}/file` : undefined;

  return (
    <div className="relative">
      <VideoCardLink video={video} href={href} failed={failed} footageUrl={footageUrl} />
      <div className="pointer-events-none absolute top-2 right-2 left-2 z-20 flex justify-end">
        <DeleteVideoButton id={video.id} title={video.title} compact />
      </div>
    </div>
  );
};
