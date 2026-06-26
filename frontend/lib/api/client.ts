const configuredApiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://it-solution-code-hr-app-backend.vercel.app/api";

function resolveApiBaseUrl() {
  if (
    typeof window !== "undefined" &&
    /https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/api$/i.test(configuredApiBaseUrl)
  ) {
    // Route browser traffic through Next.js so local backend access keeps working
    // even when the frontend is opened through a LAN/dev hostname.
    return "/backend-api";
  }

  return configuredApiBaseUrl;
}

export function resolveApiPath(path: string) {
  return `${resolveApiBaseUrl()}${path}`;
}

type RequestOptions = RequestInit & {
  path: string;
};

function extractErrorMessage(payload: unknown): string | null {
  if (!payload) {
    return null;
  }

  if (typeof payload === "string") {
    return payload;
  }

  if (typeof payload === "object" && "detail" in payload) {
    const detail = (payload as { detail?: unknown }).detail;
    if (typeof detail === "string") {
      return detail;
    }
  }

  return null;
}

export async function apiRequest<T>({ path, ...options }: RequestOptions): Promise<T> {
  const isFormData = options.body instanceof FormData;
  let response: Response;

  try {
    response = await fetch(resolveApiPath(path), {
      ...options,
      credentials: "include",
      headers: {
        ...(isFormData ? {} : { "Content-Type": "application/json" }),
        ...(options.headers ?? {}),
      },
      cache: "no-store",
    });
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? `Could not reach the API: ${error.message}`
        : "Could not reach the API.",
    );
  }

  if (!response.ok) {
    const rawBody = await response.text();
    let parsedBody: unknown = null;

    try {
      parsedBody = rawBody ? JSON.parse(rawBody) : null;
    } catch {
      parsedBody = null;
    }

    const message = extractErrorMessage(parsedBody);
    throw new Error(message || rawBody || `API request failed with status ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}
