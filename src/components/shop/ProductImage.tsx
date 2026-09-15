import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import type { SxProps, Theme } from "@mui/material/styles";

/**
 * Product photography is optional in this catalogue — the admin can create a
 * product without images. Rather than render a broken tile, fall back to a
 * branded monogram derived from the product name, so a photo-less shop still
 * looks deliberate.
 */
export function ProductImage({
  src,
  alt,
  ratio = "1 / 1",
  sx,
}: {
  src?: string | null;
  alt: string;
  ratio?: string;
  sx?: SxProps<Theme>;
}) {
  const monogram = alt
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <Box
      sx={{
        position: "relative",
        width: "100%",
        maxWidth: "100%",
        aspectRatio: ratio,
        borderRadius: 2,
        overflow: "hidden",
        bgcolor: "primary.light",
        display: "grid",
        placeItems: "center",
        ...sx,
      }}
    >
      {src ? (
        <Box
          component="img"
          src={src}
          alt={alt}
          loading="lazy"
          sx={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : (
        <Typography
          aria-hidden
          sx={{
            fontWeight: 700,
            fontSize: "clamp(22px, 12cqw, 46px)",
            color: "primary.main",
            opacity: 0.55,
            letterSpacing: "0.04em",
          }}
        >
          {monogram || "·"}
        </Typography>
      )}
    </Box>
  );
}
