export const MAX_AVATAR_BYTES = 512 * 1024;
export const MAX_PROFILE_BODY_BYTES = Math.ceil(MAX_AVATAR_BYTES / 3) * 4 + 256 * 1024;

export type AvatarImage = { bytes: Buffer; mimeType: string };

export class ProfileInputError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "ProfileInputError";
    this.status = status;
  }
}

// Undefined preserves the stored photo; null explicitly removes it.
export function parseAvatar(value: unknown): AvatarImage | null | undefined {
  if (value === undefined || value === null) return value;
  if (typeof value !== "string") throw new ProfileInputError("Choose a JPEG, PNG, or WebP profile photo.");
  if (value.length > Math.ceil(MAX_AVATAR_BYTES / 3) * 4 + 64) {
    throw new ProfileInputError("Your cropped photo must be smaller than 512 KB.", 413);
  }
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match) throw new ProfileInputError("Choose a JPEG, PNG, or WebP profile photo.");
  const [, mimeType, encoded] = match;
  const bytes = Buffer.from(encoded, "base64");
  if (bytes.length > MAX_AVATAR_BYTES) throw new ProfileInputError("Your cropped photo must be smaller than 512 KB.", 413);
  if (bytes.toString("base64") !== encoded) throw new ProfileInputError("The profile photo is not valid image data.");
  const validSignature = mimeType === "image/jpeg"
    ? bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff && bytes[bytes.length - 2] === 0xff && bytes[bytes.length - 1] === 0xd9
    : mimeType === "image/png"
      ? bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      : bytes.length >= 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
  if (!validSignature) throw new ProfileInputError("The profile photo does not match its image format.");
  return { bytes, mimeType };
}

export function avatarDataUrl(bytes: Buffer | null, mimeType: string | null): string | null {
  return bytes && mimeType ? `data:${mimeType};base64,${bytes.toString("base64")}` : null;
}

export async function readProfileBody(request: Request): Promise<Record<string, unknown>> {
  if (Number(request.headers.get("content-length")) > MAX_PROFILE_BODY_BYTES) {
    throw new ProfileInputError("Profile upload is too large. Crop your photo and try again.", 413);
  }
  const reader = request.body?.getReader();
  if (!reader) throw new ProfileInputError("Profile data is required.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_PROFILE_BODY_BYTES) {
        await reader.cancel();
        throw new ProfileInputError("Profile upload is too large. Crop your photo and try again.", 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  let body: unknown;
  try {
    body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new ProfileInputError("Profile data must be valid JSON.");
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new ProfileInputError("Profile data must be an object.");
  return body as Record<string, unknown>;
}
