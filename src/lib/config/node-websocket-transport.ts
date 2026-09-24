import WebSocketImpl from "ws";

/**
 * supabase-js always constructs a RealtimeClient inside createClient(),
 * even when no realtime feature is used, and that construction throws on
 * Node < 22 ("native WebSocket not found") unless a WebSocket-like
 * transport is supplied explicitly. This is a pure Node-side compatibility
 * shim (no secrets), safe to import from standalone scripts as well as the
 * app — see the "server_role_client"/"server_session_client" usages.
 */
export const nodeWebSocketTransport = WebSocketImpl as unknown as typeof WebSocket;
