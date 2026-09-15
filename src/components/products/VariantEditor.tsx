"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import Switch from "@mui/material/Switch";
import FormControlLabel from "@mui/material/FormControlLabel";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";
import StarIcon from "@mui/icons-material/Star";
import StarBorderIcon from "@mui/icons-material/StarBorder";
import type {
  Control,
  FieldErrors,
  UseFieldArrayReturn,
  UseFormRegister,
  UseFormSetValue,
  UseFormWatch,
} from "react-hook-form";
import type { ProductFormValues } from "./productSchema";

export function VariantEditor({
  fieldArray,
  register,
  errors,
  watch,
  setValue,
  isEdit,
}: {
  fieldArray: UseFieldArrayReturn<ProductFormValues, "variants", "id">;
  register: UseFormRegister<ProductFormValues>;
  errors: FieldErrors<ProductFormValues>;
  watch: UseFormWatch<ProductFormValues>;
  setValue: UseFormSetValue<ProductFormValues>;
  control?: Control<ProductFormValues>;
  isEdit: boolean;
}) {
  const { fields, append, remove } = fieldArray;
  const variants = watch("variants");

  const makeDefault = (index: number) => {
    fields.forEach((_, i) => setValue(`variants.${i}.isDefault`, i === index));
  };

  return (
    <Box>
      <Box sx={{ display: "grid", gap: 2 }}>
        {fields.map((field, index) => {
          const variantErrors = errors.variants?.[index];
          const existing = !!variants?.[index]?.id;

          return (
            <Card key={field.id} variant="outlined" sx={{ p: 2, bgcolor: "#FCFCFD" }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
                <Tooltip title={variants?.[index]?.isDefault ? "Default variant" : "Make default"}>
                  <IconButton size="small" onClick={() => makeDefault(index)}>
                    {variants?.[index]?.isDefault ? (
                      <StarIcon sx={{ fontSize: 18, color: "warning.main" }} />
                    ) : (
                      <StarBorderIcon sx={{ fontSize: 18 }} />
                    )}
                  </IconButton>
                </Tooltip>

                <Typography sx={{ fontSize: 14, fontWeight: 600, flex: 1 }}>
                  Variant {index + 1}
                  {existing && (
                    <Typography component="span" variant="caption" sx={{ ml: 1 }}>
                      (existing — stock is managed in Inventory)
                    </Typography>
                  )}
                </Typography>

                <FormControlLabel
                  control={
                    <Switch
                      size="small"
                      checked={variants?.[index]?.isActive ?? true}
                      onChange={(e) => setValue(`variants.${index}.isActive`, e.target.checked)}
                    />
                  }
                  label={<Typography sx={{ fontSize: 13 }}>Active</Typography>}
                />

                {fields.length > 1 && (
                  <Tooltip title="Remove variant">
                    <IconButton
                      size="small"
                      sx={{ color: "error.main" }}
                      onClick={() => remove(index)}
                    >
                      <DeleteOutlinedIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                  </Tooltip>
                )}
              </Box>

              <Box
                sx={{
                  display: "grid",
                  gap: 1.5,
                  gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", lg: "repeat(4, 1fr)" },
                }}
              >
                <TextField
                  {...register(`variants.${index}.name`)}
                  label="Variant name"
                  placeholder="1 L"
                  error={!!variantErrors?.name}
                  helperText={variantErrors?.name?.message}
                />
                <TextField
                  {...register(`variants.${index}.sku`)}
                  label="SKU"
                  error={!!variantErrors?.sku}
                  helperText={variantErrors?.sku?.message}
                />
                <TextField {...register(`variants.${index}.barcode`)} label="Barcode" />
                <TextField
                  {...register(`variants.${index}.mrp`)}
                  label="MRP"
                  type="number"
                  error={!!variantErrors?.mrp}
                  helperText={variantErrors?.mrp?.message}
                  slotProps={{ input: { startAdornment: <InputAdornment position="start">₹</InputAdornment> } }}
                />
                <TextField
                  {...register(`variants.${index}.sellingPrice`)}
                  label="Selling price"
                  type="number"
                  error={!!variantErrors?.sellingPrice}
                  helperText={variantErrors?.sellingPrice?.message}
                  slotProps={{ input: { startAdornment: <InputAdornment position="start">₹</InputAdornment> } }}
                />
                <TextField
                  {...register(`variants.${index}.discountPrice`)}
                  label="Discount price"
                  type="number"
                  error={!!variantErrors?.discountPrice}
                  helperText={variantErrors?.discountPrice?.message ?? "Charged instead of the selling price"}
                  slotProps={{ input: { startAdornment: <InputAdornment position="start">₹</InputAdornment> } }}
                />
                <TextField
                  {...register(`variants.${index}.weightGrams`)}
                  label="Weight (g)"
                  type="number"
                />
                <TextField
                  {...register(`variants.${index}.volumeMl`)}
                  label="Volume (ml)"
                  type="number"
                />
                {!existing && (
                  <TextField
                    {...register(`variants.${index}.openingStock`)}
                    label="Opening stock"
                    type="number"
                    helperText={isEdit ? "New variant only" : undefined}
                  />
                )}
                <TextField
                  {...register(`variants.${index}.minStock`)}
                  label="Min stock"
                  type="number"
                />
                <TextField
                  {...register(`variants.${index}.maxStock`)}
                  label="Max stock"
                  type="number"
                />
              </Box>
            </Card>
          );
        })}
      </Box>

      {typeof errors.variants?.message === "string" && (
        <Typography sx={{ color: "error.main", fontSize: 12.5, mt: 1 }}>
          {errors.variants.message}
        </Typography>
      )}

      <Button
        startIcon={<AddIcon />}
        onClick={() =>
          append({
            name: "",
            sku: "",
            barcode: "",
            mrp: 0,
            sellingPrice: 0,
            discountPrice: "",
            weightGrams: "",
            volumeMl: "",
            imageUrl: "",
            isDefault: fields.length === 0,
            isActive: true,
            sortOrder: fields.length,
            openingStock: 0,
            minStock: 10,
            maxStock: 1000,
          })
        }
        sx={{ mt: 2 }}
      >
        Add another variant
      </Button>
    </Box>
  );
}
