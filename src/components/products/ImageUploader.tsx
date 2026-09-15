"use client";

import { useRef, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import CloseIcon from "@mui/icons-material/Close";
import AddPhotoAlternateOutlinedIcon from "@mui/icons-material/AddPhotoAlternateOutlined";
import { api, ApiError } from "@/services/api/client";
import { useToast } from "@/context/ToastContext";

/** Uploads through /api/uploads (Web FormData) and returns public URLs. */
export function ImageUploader({
  images,
  onChange,
  max = 6,
}: {
  images: string[];
  onChange: (images: string[]) => void;
  max?: number;
}) {
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const upload = async (files: FileList) => {
    if (images.length + files.length > max) {
      toast.warning(`You can upload up to ${max} images`);
      return;
    }

    const form = new FormData();
    Array.from(files).forEach((file) => form.append("files", file));

    setUploading(true);
    try {
      const response = await api.post("/uploads", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const urls = response.data.data.urls as string[];
      onChange([...images, ...urls]);
      toast.success(response.data.message);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Unable to upload the image");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <Box>
      <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap", mb: 1.5 }}>
        {images.map((url, index) => (
          <Box
            key={url}
            sx={{
              position: "relative",
              width: 96,
              height: 96,
              borderRadius: 2.5,
              overflow: "hidden",
              border: 1,
              borderColor: index === 0 ? "primary.main" : "divider",
            }}
          >
            {/* Uploaded files are served straight from /public */}
            <Box
              component="img"
              src={url}
              alt={`Product image ${index + 1}`}
              sx={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
            {index === 0 && (
              <Box
                sx={{
                  position: "absolute",
                  bottom: 0,
                  left: 0,
                  right: 0,
                  bgcolor: "primary.main",
                  color: "#fff",
                  fontSize: 10.5,
                  fontWeight: 600,
                  textAlign: "center",
                  py: 0.25,
                }}
              >
                MAIN
              </Box>
            )}
            <IconButton
              size="small"
              onClick={() => onChange(images.filter((i) => i !== url))}
              aria-label="Remove image"
              sx={{
                position: "absolute",
                top: 2,
                right: 2,
                bgcolor: "rgba(0,0,0,.55)",
                color: "#fff",
                "&:hover": { bgcolor: "rgba(0,0,0,.75)" },
              }}
            >
              <CloseIcon sx={{ fontSize: 14 }} />
            </IconButton>
          </Box>
        ))}

        {images.length < max && (
          <Button
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            sx={{
              width: 96,
              height: 96,
              border: "1.5px dashed",
              borderColor: "divider",
              borderRadius: 2.5,
              display: "flex",
              flexDirection: "column",
              gap: 0.5,
              color: "text.secondary",
            }}
          >
            {uploading ? (
              <CircularProgress size={20} />
            ) : (
              <>
                <AddPhotoAlternateOutlinedIcon sx={{ fontSize: 22 }} />
                <Typography sx={{ fontSize: 11 }}>Add</Typography>
              </>
            )}
          </Button>
        )}
      </Box>

      <Typography variant="caption">
        JPEG, PNG, WebP or AVIF · up to 5MB each · the first image is the main
        one. Images are compressed automatically on upload.
      </Typography>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        multiple
        hidden
        onChange={(e) => e.target.files && upload(e.target.files)}
      />
    </Box>
  );
}
