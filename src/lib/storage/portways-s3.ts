import "server-only";

import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "node:crypto";
import type { AvatarImage } from "@/lib/auth/avatar";

let client: S3Client | undefined;

function storageConfig() {
  const endpoint = process.env.S3_ENDPOINT?.trim();
  const bucket = process.env.S3_BUCKET?.trim();
  const accessKeyId = process.env.S3_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
    throw new Error("Profile photo storage is not configured.");
  }
  return { endpoint, bucket, accessKeyId, secretAccessKey };
}

function getClient() {
  const config = storageConfig();
  if (!client) {
    client = new S3Client({
      endpoint: config.endpoint,
      region: process.env.S3_REGION?.trim() || "auto",
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== "false",
      credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
      maxAttempts: 5,
    });
  }
  return { client, bucket: config.bucket };
}

function extensionFor(mimeType: AvatarImage["mimeType"]) {
  return mimeType === "image/jpeg" ? "jpg" : mimeType === "image/png" ? "png" : "webp";
}

export async function putProfileAvatar(accountId: string, avatar: AvatarImage) {
  const { client: s3, bucket } = getClient();
  const key = `avatars/${accountId}/${randomUUID()}.${extensionFor(avatar.mimeType)}`;
  await s3.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: avatar.bytes,
    ContentType: avatar.mimeType,
    CacheControl: "private, max-age=300",
  }));
  return key;
}

export async function deleteProfileAvatar(key: string) {
  const { client: s3, bucket } = getClient();
  await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

export async function signProfileAvatarGet(key: string) {
  const { client: s3, bucket } = getClient();
  return getSignedUrl(s3, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn: 300 });
}
