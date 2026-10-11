import { z } from "zod";
export const plainText = (max: number) => z.string().trim().max(max).refine(value => !/[<>]/.test(value), "HTML is not allowed.");
export const searchSchema = plainText(80);
export const targetSchema = z.object({ ownerId: z.string().uuid(), workoutId: z.string().uuid() }).strict();
export const followSchema = z.object({ userId: z.string().uuid(), following: z.boolean() }).strict();
export const likeSchema = targetSchema.extend({ liked: z.boolean() });
export const commentSchema = targetSchema.extend({ text: plainText(500).min(1) });
export type PublicUser = { id: string; name: string; handle: string; avatarUrl: string | null; following: boolean };
export type FeedWorkout = {
  id: string; ownerId: string; user: PublicUser; title: string; completedAt: string;
  durationMinutes: number; volumeKg: number; exercises: { name: string; sets: number }[];
  likes: number; comments: number; liked: boolean;
};
export type FeedComment = { id: string; user: Pick<PublicUser, "id" | "name" | "handle">; text: string; createdAt: string };
