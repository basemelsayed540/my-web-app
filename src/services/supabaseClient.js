import { useMemo } from "react";

let supabaseClient = null;

export function setSupabaseClient(client) {
  supabaseClient = client;
}

export function getSupabaseClient() {
  if (!supabaseClient) {
    throw new Error("Supabase client has not been configured.");
  }

  return supabaseClient;
}

export function useSupabase() {
  return useMemo(() => getSupabaseClient(), []);
}
