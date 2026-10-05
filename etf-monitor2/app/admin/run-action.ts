import { revalidatePath } from "next/cache";
import type { AdminActionState } from "@/components/admin/action-state";

const GENERIC_ERROR: AdminActionState = { status: "error", messageKey: "genericError" };

export const INVALID_REQUEST: AdminActionState = { status: "error", messageKey: "invalidRequest" };

export async function runAdminAction<T>(
  run: () => Promise<T>,
  toState: (result: T) => AdminActionState,
  paths: (result: T) => readonly string[] = () => [],
): Promise<AdminActionState> {
  try {
    const result = await run();
    for (const path of paths(result)) revalidatePath(path);
    return toState(result);
  } catch {
    return GENERIC_ERROR;
  }
}
