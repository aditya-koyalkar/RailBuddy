import type { Request } from "express";
import crypto from "crypto"
export function getDeviceFingerPrint(req: Request) {
    const userAgent = req.headers['user-agent'] || ""
    const ip = req.ip || ""
    const accept = req.headers['accept'] || ""

    const raw = `${userAgent}|${ip}|${accept}`

    return crypto.createHash("sha256").update(raw).digest("hex")
}