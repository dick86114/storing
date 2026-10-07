export type AuthTelemetryInput = {
  userId?: number;
  sessionId?: string;
  clientType?: string;
  event: string;
  errorCode?: string;
  durationMs?: number;
};

/** 输出单行结构化认证事件，字段固定，避免上游误传敏感凭据。 */
export function logAuthEvent(input: AuthTelemetryInput) {
  console.info(JSON.stringify({
    channel: 'storing.auth',
    userId: input.userId,
    sessionId: input.sessionId,
    clientType: input.clientType,
    event: input.event,
    errorCode: input.errorCode,
    durationMs: input.durationMs,
  }));
}
