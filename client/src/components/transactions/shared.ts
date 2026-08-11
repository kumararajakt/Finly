import { ApiError, api } from "@/lib/api";

export function message(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Something went wrong.";
}

export async function ensureTags(names: string[]): Promise<void> {
  for (const name of names) {
    try {
      await api.tags.create(name);
    } catch (error) {
      if (!(error instanceof ApiError && error.code === "DUPLICATE_TAG")) throw error;
    }
  }
}
