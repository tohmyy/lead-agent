import "server-only";

import { createServerSupabaseClient } from "@/infrastructure/supabase/server-session-client";
import { AppError } from "@/domain/shared/errors";

/** The one place server actions/route handlers derive "who is calling" — never trust a client-supplied user id. */
export async function requireCurrentUserId(): Promise<string> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new AppError("UNAUTHORIZED", "You must be signed in.");
  }
  return user.id;
}
