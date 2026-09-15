"use client";

import { useState } from "react";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import { PageHeader } from "@/components/common/PageHeader";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { post, put, ApiError } from "@/services/api/client";
import { formatDateTime, initials } from "@/lib/format";

export default function ProfilePage() {
  const { user, refresh } = useAuth();
  const toast = useToast();

  const [profile, setProfile] = useState({ name: "", email: "", phone: "" });
  const [passwords, setPasswords] = useState({
    currentPassword: "",
    password: "",
    confirmPassword: "",
  });
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  // Mirror the signed-in user into the editable form during render rather
  // than via an effect, which would cause a second render pass.
  const [syncedFrom, setSyncedFrom] = useState<typeof user>(null);
  if (user && user !== syncedFrom) {
    setSyncedFrom(user);
    setProfile({ name: user.name, email: user.email, phone: user.phone ?? "" });
  }

  const saveProfile = async () => {
    setSavingProfile(true);
    try {
      const result = await put("/profile", profile);
      toast.success(result.message);
      await refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Unable to update your profile");
    } finally {
      setSavingProfile(false);
    }
  };

  const changePassword = async () => {
    if (passwords.password !== passwords.confirmPassword) {
      toast.error("The new passwords do not match");
      return;
    }
    setSavingPassword(true);
    try {
      const result = await post("/auth/change-password", passwords);
      toast.success(result.message);
      setPasswords({ currentPassword: "", password: "", confirmPassword: "" });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Unable to change your password");
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <>
      <PageHeader
        title="My Profile"
        subtitle="Your account details and password"
        breadcrumbs={[{ label: "Settings", href: "/settings" }, { label: "Profile" }]}
      />

      <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", md: "300px 1fr" }, alignItems: "start" }}>
        <Card>
          <CardContent sx={{ textAlign: "center" }}>
            <Avatar
              sx={{ width: 78, height: 78, bgcolor: "primary.main", fontSize: 26, mx: "auto", mb: 1.5 }}
            >
              {user ? initials(user.name) : "?"}
            </Avatar>
            <Typography sx={{ fontSize: 17, fontWeight: 600 }}>{user?.name}</Typography>
            <Typography variant="caption" sx={{ display: "block", mb: 1 }}>
              {user?.email}
            </Typography>
            <Chip size="small" color="primary" label={user?.roleLabel} />
            {user?.lastLoginAt && (
              <Typography variant="caption" sx={{ display: "block", mt: 2 }}>
                Last signed in {formatDateTime(user.lastLoginAt)}
              </Typography>
            )}
          </CardContent>
        </Card>

        <Box sx={{ display: "grid", gap: 2 }}>
          <Card>
            <CardContent>
              <Typography variant="h5" sx={{ mb: 2 }}>Account details</Typography>
              <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" } }}>
                <TextField label="Name" value={profile.name} onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))} />
                <TextField label="Phone" value={profile.phone} onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))} />
                <Box sx={{ gridColumn: { sm: "span 2" } }}>
                  <TextField label="Email" value={profile.email} onChange={(e) => setProfile((p) => ({ ...p, email: e.target.value }))} />
                </Box>
              </Box>
              <Button
                variant="contained"
                startIcon={<SaveOutlinedIcon />}
                loading={savingProfile}
                onClick={saveProfile}
                sx={{ mt: 2 }}
              >
                Save profile
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Typography variant="h5" sx={{ mb: 0.5 }}>Change password</Typography>
              <Typography variant="caption" sx={{ display: "block", mb: 2 }}>
                Use at least 8 characters, including a letter and a number.
              </Typography>
              <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" } }}>
                <Box sx={{ gridColumn: { sm: "span 2" } }}>
                  <TextField
                    label="Current password"
                    type="password"
                    value={passwords.currentPassword}
                    onChange={(e) => setPasswords((p) => ({ ...p, currentPassword: e.target.value }))}
                  />
                </Box>
                <TextField
                  label="New password"
                  type="password"
                  value={passwords.password}
                  onChange={(e) => setPasswords((p) => ({ ...p, password: e.target.value }))}
                />
                <TextField
                  label="Confirm new password"
                  type="password"
                  value={passwords.confirmPassword}
                  onChange={(e) => setPasswords((p) => ({ ...p, confirmPassword: e.target.value }))}
                />
              </Box>
              <Button
                variant="contained"
                loading={savingPassword}
                disabled={!passwords.currentPassword || !passwords.password}
                onClick={changePassword}
                sx={{ mt: 2 }}
              >
                Change password
              </Button>
            </CardContent>
          </Card>
        </Box>
      </Box>
    </>
  );
}
