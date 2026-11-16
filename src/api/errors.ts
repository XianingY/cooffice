/** Typed client-side error mapped from the server's normalized error shape. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly requestId?: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, requestId?: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.requestId = requestId;
    this.details = details;
  }

  /** Human-readable message safe to show in the UI. */
  get displayMessage(): string {
    const messages: Record<string, string> = {
      UNAUTHORIZED: "登录已过期，请重新登录",
      FORBIDDEN: "你没有权限执行该操作",
      NOT_FOUND: "找不到请求的数据",
      CONFLICT: "数据已被他人修改，请刷新后重试",
      VALIDATION_ERROR: "提交的数据有误，请检查后重试",
      RATE_LIMITED: "操作过于频繁，请稍后再试",
      PAYLOAD_TOO_LARGE: "文件过大，请压缩后再试",
    };
    return messages[this.code] ?? this.message ?? "操作失败，请稍后重试";
  }
}

/** Convert a fetch failure into a stable offline error. */
export function networkError(): ApiError {
  return new ApiError(0, "NETWORK_ERROR", "无法连接到服务器，请检查网络后重试");
}
