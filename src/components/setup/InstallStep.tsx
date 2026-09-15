"use client";

import { useRef, useState } from "react";
import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Collapse from "@mui/material/Collapse";
import Typography from "@mui/material/Typography";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import CancelRoundedIcon from "@mui/icons-material/CancelRounded";
import RadioButtonUncheckedRoundedIcon from "@mui/icons-material/RadioButtonUncheckedRounded";
import { fetchStatus, runInstall, SetupError } from "@/services/api/setup";
import type { InstallEvent, StepId, StepStatus } from "@/types/setup";

const STEPS: { id: StepId; label: string }[] = [
  { id: "connect", label: "Checking the database server" },
  { id: "database", label: "Creating the database" },
  { id: "schema", label: "Creating tables" },
  { id: "defaults", label: "Loading roles, permissions and store settings" },
  { id: "administrator", label: "Creating the administrator account" },
  { id: "configure", label: "Writing configuration" },
];

type Phase = "review" | "running" | "done" | "failed";

interface Props {
  summary: { host: string; port: number; database: string; storeName: string; adminEmail: string };
  payload: unknown;
  onBack: () => void;
}

export function InstallStep({ summary, payload, onBack }: Props) {
  const [phase, setPhase] = useState<Phase>("review");
  const [states, setStates] = useState<Record<string, { status: StepStatus; detail?: string }>>({});
  const [logs, setLogs] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showLogs, setShowLogs] = useState(false);
  const finished = useRef(false);

  const start = async () => {
    setPhase("running");
    setError(null);
    setStates({});
    setLogs([]);
    finished.current = false;

    const handle = (event: InstallEvent) => {
      if (event.kind === "step") {
        setStates((prev) => ({
          ...prev,
          [event.id]: { status: event.status, detail: event.detail },
        }));
      } else if (event.kind === "log") {
        setLogs((prev) => [...prev.slice(-200), event.line]);
      } else if (event.kind === "done") {
        finished.current = true;
        setPhase("done");
      } else if (event.kind === "error") {
        finished.current = true;
        setError(event.message);
        if (event.stepId) {
          setStates((prev) => ({ ...prev, [event.stepId!]: { status: "failed" } }));
        }
        setPhase("failed");
      }
    };

    try {
      await runInstall(payload, handle);
    } catch (err) {
      if (!finished.current) {
        setError(err instanceof SetupError ? err.message : "The installation could not be started.");
        setPhase("failed");
      }
      return;
    }

    // The stream can end without a final message — writing .env restarts the
    // development server, which drops the connection at the last moment. Ask
    // the server directly rather than reporting a failure that did not happen.
    if (!finished.current) {
      try {
        const status = await fetchStatus();
        if (!status.required) {
          setPhase("done");
          return;
        }
      } catch {
        // Fall through to the error below.
      }
      setError("The connection to the server ended before setup finished. Check the server console.");
      setPhase("failed");
    }
  };

  if (phase === "done") {
    return (
      <Box>
        <Box sx={{ textAlign: "center", py: 2 }}>
          <CheckCircleRoundedIcon sx={{ fontSize: 56, color: "success.main" }} />
          <Typography variant="h2" sx={{ fontSize: 23, fontWeight: 700, mt: 1.5 }}>
            {summary.storeName} is ready
          </Typography>
          <Typography sx={{ color: "text.secondary", fontSize: 14.5, mt: 1, maxWidth: 460, mx: "auto" }}>
            The database has been created and your administrator account is
            active. Sign in to add products, staff accounts and delivery
            settings.
          </Typography>
        </Box>

        <Alert severity="info" sx={{ my: 2.5 }}>
          <AlertTitle>Setup is now closed</AlertTitle>
          This page will not appear again. To install somewhere else, or to start
          over, delete <code>.setup-complete.json</code> from the application
          folder.
        </Alert>

        <Button
          variant="contained"
          size="large"
          fullWidth
          onClick={() => {
            // A full page load, not a client navigation. This app was rendered
            // when no database existed; every cached route payload above it
            // was produced in that state and should be discarded.
            // eslint-disable-next-line @next/next/no-location-assign-relative-destination
            window.location.href = "/login";
          }}
        >
          Sign in as {summary.adminEmail}
        </Button>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h2" sx={{ fontSize: 21, fontWeight: 700, mb: 0.5 }}>
        {phase === "review" ? "Ready to install" : "Installing"}
      </Typography>
      <Typography sx={{ color: "text.secondary", fontSize: 14, mb: 2.5 }}>
        {phase === "review"
          ? "Nothing has been changed yet. This is the last point at which you can go back."
          : "This takes up to a minute. Please leave this page open."}
      </Typography>

      {phase === "review" && (
        <Box
          sx={{
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 2,
            p: 2,
            mb: 2.5,
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "auto 1fr" },
            columnGap: 3,
            rowGap: 1,
            fontSize: 14,
          }}
        >
          {[
            ["Store", summary.storeName],
            ["Database", `${summary.database} on ${summary.host}:${summary.port}`],
            ["Administrator", summary.adminEmail],
          ].map(([label, value]) => (
            <Box key={label} sx={{ display: "contents" }}>
              <Typography sx={{ fontSize: 13.5, color: "text.secondary" }}>{label}</Typography>
              <Typography sx={{ fontSize: 14, fontWeight: 500, wordBreak: "break-word" }}>
                {value}
              </Typography>
            </Box>
          ))}
        </Box>
      )}

      {phase !== "review" && (
        <Box sx={{ mb: 2.5 }}>
          {STEPS.map((step) => {
            const state = states[step.id]?.status ?? "pending";
            return (
              <Box
                key={step.id}
                sx={{ display: "flex", alignItems: "flex-start", gap: 1.5, py: 1 }}
              >
                <Box sx={{ width: 22, display: "grid", placeItems: "center", mt: 0.2 }}>
                  {state === "running" && <CircularProgress size={17} />}
                  {state === "done" && (
                    <CheckCircleRoundedIcon sx={{ fontSize: 20, color: "success.main" }} />
                  )}
                  {state === "failed" && (
                    <CancelRoundedIcon sx={{ fontSize: 20, color: "error.main" }} />
                  )}
                  {state === "pending" && (
                    <RadioButtonUncheckedRoundedIcon sx={{ fontSize: 18, color: "action.disabled" }} />
                  )}
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography
                    sx={{
                      fontSize: 14.5,
                      fontWeight: state === "running" ? 600 : 500,
                      color: state === "pending" ? "text.disabled" : "text.primary",
                    }}
                  >
                    {step.label}
                  </Typography>
                  {states[step.id]?.detail && (
                    <Typography sx={{ fontSize: 13, color: "text.secondary" }}>
                      {states[step.id]?.detail}
                    </Typography>
                  )}
                </Box>
              </Box>
            );
          })}
        </Box>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          <AlertTitle>Setup did not finish</AlertTitle>
          <Box sx={{ whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: 13.5 }}>
            {error}
          </Box>
        </Alert>
      )}

      {logs.length > 0 && (
        <Box sx={{ mb: 2 }}>
          <Button size="small" onClick={() => setShowLogs((v) => !v)}>
            {showLogs ? "Hide" : "Show"} server output ({logs.length} lines)
          </Button>
          <Collapse in={showLogs}>
            <Box
              component="pre"
              sx={{
                mt: 1,
                p: 1.5,
                bgcolor: "grey.900",
                color: "grey.100",
                borderRadius: 2,
                fontSize: 12,
                maxHeight: 220,
                overflow: "auto",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {logs.join("\n")}
            </Box>
          </Collapse>
        </Box>
      )}

      <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap" }}>
        <Button
          variant="contained"
          size="large"
          onClick={() => void start()}
          loading={phase === "running"}
        >
          {phase === "failed" ? "Try again" : "Install now"}
        </Button>
        <Button size="large" onClick={onBack} disabled={phase === "running"} sx={{ ml: "auto" }}>
          Back
        </Button>
      </Box>
    </Box>
  );
}
