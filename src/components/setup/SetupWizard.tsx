"use client";

import { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Step from "@mui/material/Step";
import StepLabel from "@mui/material/StepLabel";
import Stepper from "@mui/material/Stepper";
import Typography from "@mui/material/Typography";
import StorefrontIcon from "@mui/icons-material/Storefront";
import { RequirementsStep } from "./RequirementsStep";
import { DatabaseStep } from "./DatabaseStep";
import { AdministratorStep, type AdministratorFormValues } from "./AdministratorStep";
import { InstallStep } from "./InstallStep";
import { fetchStatus } from "@/services/api/setup";
import type { DatabaseFormValues } from "@/types/setup";

const LABELS = ["Requirements", "Database", "Administrator", "Install"];

const DEFAULT_DATABASE: DatabaseFormValues = {
  host: "localhost",
  port: 5432,
  user: "postgres",
  password: "",
  database: "fmcg_admin",
  ssl: false,
};

const DEFAULT_ADMIN: AdministratorFormValues = {
  storeName: "",
  name: "",
  email: "",
  phone: "",
  password: "",
  confirmPassword: "",
};

export function SetupWizard() {
  const [step, setStep] = useState(0);
  const [database, setDatabase] = useState<DatabaseFormValues>(DEFAULT_DATABASE);
  const [administrator, setAdministrator] = useState<AdministratorFormValues>(DEFAULT_ADMIN);
  const [setupKey, setSetupKey] = useState("");
  const [keyRequired, setKeyRequired] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchStatus()
      .then((status) => {
        if (!cancelled) setKeyRequired(status.keyRequired);
      })
      .catch(() => {
        // The field stays hidden; the server still rejects a missing key and
        // says so, which is a clearer failure than an input nobody can fill.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: "background.default",
        py: { xs: 3, md: 6 },
        px: 2,
      }}
    >
      <Box sx={{ maxWidth: 760, mx: "auto" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 3 }}>
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: 2.5,
              bgcolor: "primary.main",
              color: "#fff",
              display: "grid",
              placeItems: "center",
            }}
          >
            <StorefrontIcon sx={{ fontSize: 23 }} />
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 700, fontSize: 17, lineHeight: 1.2 }}>
              FMCG Admin
            </Typography>
            <Typography sx={{ fontSize: 13, color: "text.secondary" }}>
              First-time setup
            </Typography>
          </Box>
        </Box>

        <Paper
          variant="outlined"
          sx={{ p: { xs: 2.5, sm: 4 }, borderRadius: 3, overflow: "hidden" }}
        >
          <Stepper activeStep={step} alternativeLabel sx={{ mb: 4 }}>
            {LABELS.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>

          {step === 0 && <RequirementsStep onContinue={() => setStep(1)} />}

          {step === 1 && (
            <DatabaseStep
              defaultValues={database}
              setupKey={setupKey}
              keyRequired={keyRequired}
              onKeyChange={setSetupKey}
              onBack={() => setStep(0)}
              onContinue={(values) => {
                setDatabase(values);
                setStep(2);
              }}
            />
          )}

          {step === 2 && (
            <AdministratorStep
              defaultValues={administrator}
              onBack={() => setStep(1)}
              onContinue={(values) => {
                setAdministrator(values);
                setStep(3);
              }}
            />
          )}

          {step === 3 && (
            <InstallStep
              summary={{
                host: database.host,
                port: database.port,
                database: database.database,
                storeName: administrator.storeName,
                adminEmail: administrator.email,
              }}
              payload={{
                key: setupKey || undefined,
                storeName: administrator.storeName,
                database,
                administrator: {
                  name: administrator.name,
                  email: administrator.email,
                  phone: administrator.phone,
                  password: administrator.password,
                  confirmPassword: administrator.confirmPassword,
                },
              }}
              onBack={() => setStep(2)}
            />
          )}
        </Paper>

        <Typography
          sx={{ fontSize: 12.5, color: "text.secondary", textAlign: "center", mt: 3 }}
        >
          Anyone who can reach this page before setup finishes could install over
          the top of it. Complete setup before exposing this server publicly.
        </Typography>
      </Box>
    </Box>
  );
}
