import "server-only";
import QRCode from "qrcode";

/** An SVG QR code in the design's ink-on-paper colours, e.g. for "MYBOOK:RES:MB-4K7Q". */
export function qrSvg(text: string): Promise<string> {
  return QRCode.toString(text, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#231A1F", light: "#FAF6F0" } });
}
