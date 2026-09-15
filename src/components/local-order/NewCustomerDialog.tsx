"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import TextField from "@mui/material/TextField";
import { post, ApiError } from "@/services/api/client";
import { useToast } from "@/context/ToastContext";
import type { CustomerDto } from "@/types/models";

const schema = z.object({
  name: z.string().trim().min(2, "Name is required"),
  phone: z
    .string()
    .trim()
    .regex(/^[0-9+\-\s()]{7,20}$/, "Enter a valid phone number"),
  email: z.string().trim().email("Enter a valid email").or(z.literal("")),
  line1: z.string().trim().max(200).optional(),
  city: z.string().trim().max(80).optional(),
  state: z.string().trim().max(80).optional(),
  postalCode: z.string().trim().max(10).optional(),
});

type Values = z.infer<typeof schema>;

export function NewCustomerDialog({
  open,
  onClose,
  onCreated,
  initialPhone = "",
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (customer: CustomerDto) => void;
  initialPhone?: string;
}) {
  const toast = useToast();

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    values: {
      name: "",
      phone: initialPhone,
      email: "",
      line1: "",
      city: "",
      state: "",
      postalCode: "",
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      const result = await post<CustomerDto>("/customers/quick", values);
      toast.success(result.message);
      onCreated(result.data);
      reset();
      onClose();
    } catch (error) {
      if (error instanceof ApiError && error.fields) {
        for (const [field, messages] of Object.entries(error.fields)) {
          setError(field as keyof Values, { message: messages[0] });
        }
        return;
      }
      toast.error(error instanceof ApiError ? error.message : "Unable to add the customer");
    }
  });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>New customer</DialogTitle>
      <Box component="form" onSubmit={onSubmit} noValidate>
        <DialogContent>
          <Box
            sx={{
              display: "grid",
              gap: 2,
              gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
              pt: 0.5,
            }}
          >
            <TextField
              {...register("name")}
              label="Customer name"
              autoFocus
              error={!!errors.name}
              helperText={errors.name?.message}
            />
            <TextField
              {...register("phone")}
              label="Phone"
              error={!!errors.phone}
              helperText={errors.phone?.message}
            />
            <Box sx={{ gridColumn: { sm: "span 2" } }}>
              <TextField
                {...register("email")}
                label="Email (optional)"
                error={!!errors.email}
                helperText={errors.email?.message}
              />
            </Box>
            <Box sx={{ gridColumn: { sm: "span 2" } }}>
              <TextField {...register("line1")} label="Address (optional)" />
            </Box>
            <TextField {...register("city")} label="City" />
            <TextField {...register("state")} label="State" />
            <TextField {...register("postalCode")} label="Postal code" />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} color="inherit">
            Cancel
          </Button>
          <Button type="submit" variant="contained" loading={isSubmitting}>
            Add customer
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
