"use server";

import { revalidatePath } from "next/cache";

import { runModeration } from "./job";

export async function rerunModeration(): Promise<void> {
  runModeration();
  revalidatePath("/");
}
