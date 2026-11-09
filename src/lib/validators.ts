import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(200),
});

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  orgName: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email(),
  phone: z.string().trim().regex(/^\+?[0-9 ()-]{9,20}$/),
  service: z.enum(["SCHOOL", "HOME", "FARM"]),
  password: z.string().min(8).max(200),
  plan: z.string().optional(),
});

export const contactSchema = z.object({
  name: z.string().trim().min(2).max(80),
  phone: z.string().trim().regex(/^\+?[0-9 ()-]{9,20}$/),
  email: z.string().trim().email().optional().or(z.literal("")),
  service: z.enum(["SCHOOL", "HOME", "FARM"]).optional(),
  message: z.string().trim().min(5).max(2000),
});

export const cameraSchema = z.object({
  name: z.string().trim().min(2).max(60),
  code: z.string().trim().min(1).max(20),
  location: z.string().trim().max(80).optional(),
  protocol: z.enum(["RTSP", "ONVIF"]),
  sourceUrl: z
    .string()
    .trim()
    .max(300)
    .regex(/^(rtsp|rtsps|http|https):\/\//i)
    .optional()
    .or(z.literal("")),
  // browser-playable stream (HLS/MP4) — only http(s), never javascript:/data:
  streamUrl: z.string().trim().max(500).regex(/^https?:\/\/[^\s"'<>]+$/i).optional().or(z.literal("")),
  scene: z.enum(["gate", "classroom", "corridor", "parking", "house", "barn"]),
});

export const edgeEventSchema = z.object({
  events: z
    .array(
      z.object({
        camera: z.string().min(1).max(20), // camera code e.g. "Cam 01"
        type: z.enum(["ENTRY", "EXIT", "PERSON", "UNKNOWN_PERSON", "OCCUPANCY", "SAFETY", "CAMERA_STATUS", "LIVESTOCK", "VEHICLE", "FIRE_SMOKE", "INTRUSION", "FALL", "ZONE", "STUDENT", "TAMPER", "LOITER", "CAMERA_HEALTH", "CORRIDOR", "ANIMAL_OUT"]),
        // recognised student id (school attendance)
        student: z.string().max(40).optional(),
        // licence plate read on the Edge (letters and digits only)
        plate: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{3,12}$/).optional(),
        severity: z.enum(["INFO", "WARNING", "CRITICAL"]).default("INFO"),
        confidence: z.number().min(0).max(1).optional(),
        trackId: z.string().max(20).optional(),
        value: z.number().int().optional(),
        occurredAt: z.string().datetime().optional(),
        // base64 JPEG face / head crop (≈ 10–40 KB)
        snapshot: z.string().max(400_000).regex(/^[A-Za-z0-9+/=]+$/).optional(),
      }),
    )
    .max(500)
    // bound the total payload: at most 50 snapshots per batch
    .refine((evs) => evs.filter((e) => e.snapshot).length <= 50, { message: "too many snapshots in one batch (max 50)" }),
});

export const heartbeatSchema = z.object({
  cpu: z.number().int().min(0).max(100).optional(),
  gpu: z.number().int().min(0).max(100).optional(),
  firmware: z.string().max(20).optional(),
  cameras: z
    .array(
      z.object({
        code: z.string(),
        status: z.enum(["ONLINE", "WEAK", "OFFLINE"]),
        signal: z.number().int().min(0).max(100),
        fps: z.number().int().min(0).max(120).optional(),
        // annotated MJPEG stream published by the agent (boxes drawn in)
        streamUrl: z.string().max(500).regex(/^https?:\/\/[^\s"'<>]+$/i).optional(),
        nightVision: z.boolean().optional(),
        // heatmap: people counts on a 32×18 grid since the last report
        heat: z.array(z.number().min(0).max(100000)).length(576).optional(),
      }),
    )
    .max(64)
    .optional(),
});
