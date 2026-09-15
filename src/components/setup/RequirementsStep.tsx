"use client";

import { useEffect, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import Typography from "@mui/material/Typography";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import CancelRoundedIcon from "@mui/icons-material/CancelRounded";
import WarningRoundedIcon from "@mui/icons-material/WarningRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import { fetchRequirements, SetupError } from "@/services/api/setup";
import type { CheckResult, CheckStatus, RequirementReport } from "@/types/setup";

const ICONS: Record<CheckStatus, typeof CheckCircleRoundedIcon> = {
  pass: CheckCircleRoundedIcon,
  warn: WarningRoundedIcon,
  fail: CancelRoundedIcon,
};

const COLOURS: Record<CheckStatus, string> = {
  pass: "success.main",
  warn: "warning.main",
  fail: "error.main",
};

function CheckRow({ check }: { check: CheckResult }) {
  const Icon = ICONS[check.status];
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "flex-start",
        gap: 1.5,
        py: 1.25,
        borderBottom: "1px solid",
        borderColor: "divider",
        "&:last-of-type": { borderBottom: "none" },
      }}
    >
      <Icon sx={{ color: COLOURS[check.status], fontSize: 21, mt: 0.2, flexShrink: 0 }} />
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Box
          sx={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "baseline",
            columnGap: 1,
            rowGap: 0.25,
          }}
        >
          <Typography sx={{ fontWeight: 600, fontSize: 14.5 }}>{check.label}</Typography>
          <Typography sx={{ fontSize: 12.5, color: "text.secondary" }}>
            {check.requirement}
          </Typography>
        </Box>
        <Typography
          sx={{
            fontSize: 13.5,
            color: check.status === "fail" ? "error.main" : "text.primary",
            mt: 0.25,
            wordBreak: "break-word",
          }}
        >
          {check.detail}
        </Typography>
        {check.hint && check.status !== "pass" && (
          <Typography sx={{ fontSize: 12.5, color: "text.secondary", mt: 0.5 }}>
            {check.hint}
          </Typography>
        )}
      </Box>
    </Box>
  );
}

export function RequirementsStep({ onContinue }: { onContinue: () => void }) {
  const [report, setReport] = useState<RequirementReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Runs once on mount. State is only touched after the await, so the effect
  // itself stays synchronous — React warns about cascading renders otherwise.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const result = await fetchRequirements();
        if (!cancelled) setReport(result);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof SetupError ? err.message : "Could not run the checks.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /** "Check again" — an event handler, so it may set state immediately. */
  const recheck = async () => {
    setLoading(true);
    setError(null);
    try {
      setReport(await fetchRequirements());
    } catch (err) {
      setError(err instanceof SetupError ? err.message : "Could not run the checks.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      <Typography variant="h2" sx={{ fontSize: 21, fontWeight: 700, mb: 0.5 }}>
        Server requirements
      </Typography>
      <Typography sx={{ color: "text.secondary", fontSize: 14, mb: 2.5 }}>
        Everything this application needs in order to run, checked on the machine
        it is running on.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {loading && !report ? (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, py: 5, justifyContent: "center" }}>
          <CircularProgress size={22} />
          <Typography sx={{ color: "text.secondary" }}>Checking this server…</Typography>
        </Box>
      ) : (
        report && (
          <>
            {report.groups.map((group) => (
              <Box key={group.title} sx={{ mb: 2.5 }}>
                <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, mb: 0.5 }}>
                  <Typography sx={{ fontWeight: 700, fontSize: 13, textTransform: "uppercase", letterSpacing: 0.6 }}>
                    {group.title}
                  </Typography>
                  <Typography sx={{ fontSize: 12.5, color: "text.secondary" }}>
                    {group.description}
                  </Typography>
                </Box>
                <Box
                  sx={{
                    border: "1px solid",
                    borderColor: "divider",
                    borderRadius: 2,
                    px: 2,
                  }}
                >
                  {group.checks.map((check) => (
                    <CheckRow key={check.id} check={check} />
                  ))}
                </Box>
              </Box>
            ))}

            <Divider sx={{ my: 2 }} />

            <Box
              sx={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                gap: 1,
                mb: 2,
              }}
            >
              <Chip size="small" color="success" variant="outlined" label={`${report.passed} ready`} />
              {report.warnings > 0 && (
                <Chip size="small" color="warning" variant="outlined" label={`${report.warnings} to note`} />
              )}
              {report.failures > 0 && (
                <Chip size="small" color="error" variant="outlined" label={`${report.failures} blocking`} />
              )}
            </Box>

            {report.ok ? (
              report.warnings > 0 && (
                <Alert severity="info" sx={{ mb: 2 }}>
                  Nothing is blocking the installation. The items marked in amber
                  are worth knowing about, but setup can continue.
                </Alert>
              )
            ) : (
              <Alert severity="error" sx={{ mb: 2 }}>
                Resolve the items marked in red, then check again. Setup cannot
                continue until they pass.
              </Alert>
            )}

            <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap" }}>
              <Button
                variant="contained"
                size="large"
                disabled={!report.ok}
                onClick={onContinue}
              >
                Continue to database
              </Button>
              <Button
                variant="outlined"
                size="large"
                onClick={() => void recheck()}
                loading={loading}
                startIcon={<RefreshRoundedIcon />}
              >
                Check again
              </Button>
            </Box>
          </>
        )
      )}
    </Box>
  );
}
