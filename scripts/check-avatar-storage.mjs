import { randomUUID } from "node:crypto";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { loadPortwaysEnv } from "./portways-env.mjs";

await loadPortwaysEnv();
const endpoint = process.env.S3_ENDPOINT?.trim();
const bucket = process.env.S3_BUCKET?.trim();
const accessKeyId = process.env.S3_ACCESS_KEY_ID?.trim();
const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
const missing = [
  ["S3_ENDPOINT", endpoint], ["S3_BUCKET", bucket],
  ["S3_ACCESS_KEY_ID", accessKeyId], ["S3_SECRET_ACCESS_KEY", secretAccessKey],
].filter(([, value]) => !value).map(([name]) => name);
if (missing.length) {
  console.error(`Storage check missing required variables: ${missing.join(", ")}`);
  process.exit(1);
}

const s3 = new S3Client({
  endpoint,
  region: process.env.S3_REGION?.trim() || "auto",
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== "false",
  credentials: { accessKeyId, secretAccessKey },
  maxAttempts: 5,
});
const key = `health-checks/arcus-${randomUUID()}.txt`;
let uploaded = false;
try {
  await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: "ARCUS storage check", ContentType: "text/plain" }));
  uploaded = true;
  const signedUrl = await getSignedUrl(s3, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn: 300 });
  const response = await fetch(signedUrl);
  if (!response.ok || await response.text() !== "ARCUS storage check") throw new Error("Presigned object read-back did not match.");
  console.log("Portways S3 upload and signed read succeeded.");
} catch (error) {
  const value = typeof error === "object" && error !== null ? error : {};
  const name = "name" in value && typeof value.name === "string" ? value.name : "StorageError";
  const code = "Code" in value && typeof value.Code === "string" ? value.Code : "";
  const status = "$metadata" in value && typeof value.$metadata === "object" && value.$metadata !== null && "httpStatusCode" in value.$metadata
    ? value.$metadata.httpStatusCode : undefined;
  console.error("Portways S3 check failed.", { name, code: code || undefined, status });
  process.exitCode = 1;
} finally {
  if (uploaded) {
    try {
      await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
      console.log("Temporary storage-check object removed.");
    } catch (error) {
      const value = typeof error === "object" && error !== null ? error : {};
      const name = "name" in value && typeof value.name === "string" ? value.name : "StorageError";
      console.warn("Temporary storage-check object cleanup failed.", { name });
      process.exitCode = 1;
    }
  }
  s3.destroy();
}
