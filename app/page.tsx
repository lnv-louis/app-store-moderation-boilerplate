import { ReviewQueue } from "@/components/ReviewQueue";
import { getModerationRun } from "@/lib/moderation/job";

export const dynamic = "force-dynamic";

export default function ReviewQueuePage() {
  const run = getModerationRun();

  return <ReviewQueue rows={run.reviews} checkedAt={run.ranAt} durationMs={run.durationMs} />;
}
