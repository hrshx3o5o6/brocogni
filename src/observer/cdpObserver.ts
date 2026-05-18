import type { Page } from "playwright";
import type { RawCapture } from "../types/schema.js";

export async function captureRawPageState(page: Page): Promise<RawCapture> {
  const client = await page.context().newCDPSession(page);
  await client.send("Accessibility.enable");

  const [domSnapshot, axTree] = await Promise.all([
    client.send("DOMSnapshot.captureSnapshot", {
      computedStyles: ["display", "visibility", "pointer-events"],
      includeDOMRects: true,
      includePaintOrder: true
    }),
    client.send("Accessibility.getFullAXTree", {})
  ]);

  return { domSnapshot, axTree };
}
