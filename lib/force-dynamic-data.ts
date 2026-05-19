import { unstable_noStore as noStore } from "next/cache";

/** Server Actions で DB の最新値を必ず読む */
export function forceDynamicData() {
  noStore();
}
