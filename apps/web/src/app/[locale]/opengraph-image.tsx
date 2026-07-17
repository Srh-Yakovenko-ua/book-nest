import { ImageResponse } from "next/og";

export const alt = "book-nest — your personal reading library";
export const contentType = "image/png";
export const size = { height: 630, width: 1200 };

const LINEN = "#F6F0E7";
const TERRACOTTA = "#A96E47";
const INK = "#3A2218";
const MUTED = "#6B5744";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        background: LINEN,
        color: INK,
        display: "flex",
        flexDirection: "column",
        height: "100%",
        justifyContent: "center",
        padding: 96,
        width: "100%",
      }}
    >
      <div
        style={{
          background: TERRACOTTA,
          borderRadius: 999,
          height: 14,
          marginBottom: 48,
          width: 132,
        }}
      />
      <div style={{ display: "flex", fontSize: 132, fontWeight: 700, letterSpacing: -3 }}>
        book-nest
      </div>
      <div style={{ color: MUTED, display: "flex", fontSize: 48, marginTop: 28 }}>
        Your personal reading library
      </div>
    </div>,
    size,
  );
}
