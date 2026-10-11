import { z } from "zod";
const base64url = z.string().min(1).max(200000).regex(/^[A-Za-z0-9_-]+$/);
export const loginSchema = z.object({ username:z.string().trim().min(1).max(32),password:z.string().min(1).max(1024) });
export const signupSchema = loginSchema.extend({
  username:z.string().trim().regex(/^[A-Za-z0-9_]{3,32}$/),
  password:z.string().min(8).max(1024),email:z.string().trim().email().max(254),
  name:z.string().trim().min(1).max(80).refine(value=>!/[<>]/.test(value),"HTML is not allowed."),
});
export const passkeyResponseSchema = z.object({
  challengeId:z.string().uuid(),
  response:z.object({
    id:base64url,rawId:base64url,type:z.literal("public-key"),
    response:z.object({ clientDataJSON:base64url }).passthrough(),
    clientExtensionResults:z.record(z.string(),z.unknown()),
  }).passthrough(),
});
export const registrationResponseSchema = passkeyResponseSchema.extend({ response:passkeyResponseSchema.shape.response.extend({
  response:z.object({ clientDataJSON:base64url,attestationObject:base64url,transports:z.array(z.enum(["ble","cable","hybrid","internal","nfc","smart-card","usb"])).optional() }).passthrough(),
}) });
export const authenticationResponseSchema = passkeyResponseSchema.extend({ response:passkeyResponseSchema.shape.response.extend({
  response:z.object({ clientDataJSON:base64url,authenticatorData:base64url,signature:base64url,userHandle:base64url.optional() }).passthrough(),
}) });
