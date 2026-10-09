import { NextResponse } from "next/server";
import { getCurrentAccount } from "@/lib/auth/server";
import { generateSecret, generateURI } from "otplib";
import qrcode from "qrcode";

export async function POST(request: Request) {
  try {
    const user = await getCurrentAccount();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const secret = generateSecret();
    const otpauthUrl = generateURI({
      issuer: "Arcus",
      label: user.email,
      secret,
    });
    const qrCodeDataUrl = await qrcode.toDataURL(otpauthUrl);

    return NextResponse.json({ secret, qrCodeDataUrl });
  } catch (error) {
    console.error("MFA Setup Error:", error);
    return NextResponse.json({ error: "Failed to setup MFA" }, { status: 500 });
  }
}

