import { notFound } from "next/navigation";

import { ListingDetail } from "@/components/ListingDetail";
import { getApp } from "@/lib/fanvue/api";
import { getModerationRun } from "@/lib/moderation/job";

export const dynamic = "force-dynamic";

export default async function ListingDetailPage({ params }: { params: Promise<{ uuid: string }> }) {
  const { uuid } = await params;
  const listing = getApp(uuid);
  if (!listing) notFound();

  const review = getModerationRun().byUuid.get(listing.uuid);

  return <ListingDetail listing={listing} issues={review?.issues ?? []} />;
}
