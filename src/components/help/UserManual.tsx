"use client";

import { Fragment, useMemo, useState } from "react";
import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import InputAdornment from "@mui/material/InputAdornment";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import { useAuth } from "@/context/AuthContext";
import { MANUAL, type ManualBlock, type ManualSection } from "./manual-content";

/** Turns *emphasis* into bold, so the content stays plain strings. */
function inline(text: string) {
  return text.split(/(\*[^*]+\*)/g).map((part, index) =>
    part.startsWith("*") && part.endsWith("*") && part.length > 2 ? (
      <Box key={index} component="strong" sx={{ fontWeight: 600 }}>
        {part.slice(1, -1)}
      </Box>
    ) : (
      <Fragment key={index}>{part}</Fragment>
    )
  );
}

const PROSE = { fontSize: 14.75, lineHeight: 1.7, color: "text.primary" } as const;

function Block({ block }: { block: ManualBlock }) {
  switch (block.kind) {
    case "text":
      return <Typography sx={{ ...PROSE, mb: 1.75 }}>{inline(block.text)}</Typography>;

    case "steps":
      return (
        <Box component="ol" sx={{ pl: 0, m: 0, mb: 2, listStyle: "none", counterReset: "step" }}>
          {block.items.map((item, index) => (
            <Box
              component="li"
              key={index}
              sx={{ display: "flex", gap: 1.5, alignItems: "flex-start", mb: 1.25 }}
            >
              <Box
                sx={{
                  flexShrink: 0,
                  width: 23,
                  height: 23,
                  borderRadius: "50%",
                  bgcolor: "primary.main",
                  color: "#fff",
                  fontSize: 12.5,
                  fontWeight: 700,
                  display: "grid",
                  placeItems: "center",
                  mt: 0.25,
                }}
              >
                {index + 1}
              </Box>
              <Typography sx={PROSE}>{inline(item)}</Typography>
            </Box>
          ))}
        </Box>
      );

    case "list":
      return (
        <Box component="ul" sx={{ pl: 2.5, m: 0, mb: 2 }}>
          {block.items.map((item, index) => (
            <Box component="li" key={index} sx={{ mb: 0.85 }}>
              <Typography sx={PROSE}>{inline(item)}</Typography>
            </Box>
          ))}
        </Box>
      );

    case "table":
      return (
        <Paper variant="outlined" sx={{ mb: 2.25, borderRadius: 2, overflowX: "auto" }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                {block.head.map((cell) => (
                  <TableCell key={cell} sx={{ fontWeight: 700, fontSize: 13, whiteSpace: "nowrap" }}>
                    {cell}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {block.rows.map((row, index) => (
                <TableRow key={index}>
                  {row.map((cell, cellIndex) => (
                    <TableCell
                      key={cellIndex}
                      sx={{
                        fontSize: 13.75,
                        lineHeight: 1.55,
                        fontWeight: cellIndex === 0 ? 600 : 400,
                        color: cell === "—" ? "text.disabled" : "text.primary",
                      }}
                    >
                      {inline(cell)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      );

    case "note":
      return (
        <Alert severity={block.tone} sx={{ mb: 2.25, fontSize: 14, alignItems: "flex-start" }}>
          {block.title && <AlertTitle sx={{ fontSize: 14, fontWeight: 700 }}>{block.title}</AlertTitle>}
          <Box sx={{ lineHeight: 1.65 }}>{inline(block.text)}</Box>
        </Alert>
      );

    default:
      return null;
  }
}

/** Everything in a section that search should look at. */
function haystack(section: ManualSection): string {
  const parts = [section.title, section.summary];
  for (const block of section.blocks) {
    if (block.kind === "text") parts.push(block.text);
    else if (block.kind === "steps" || block.kind === "list") parts.push(...block.items);
    else if (block.kind === "table") parts.push(...block.head, ...block.rows.flat());
    else if (block.kind === "note") parts.push(block.title ?? "", block.text);
  }
  return parts.join(" ").toLowerCase().replace(/\*/g, "");
}

export function UserManual() {
  const { can, user } = useAuth();
  const [query, setQuery] = useState("");

  const index = useMemo(
    () => new Map(MANUAL.flatMap((c) => c.sections).map((s) => [s.id, haystack(s)])),
    []
  );

  const term = query.trim().toLowerCase();
  const chapters = useMemo(() => {
    if (!term) return MANUAL;
    return MANUAL.map((chapter) => ({
      ...chapter,
      sections: chapter.sections.filter((s) => (index.get(s.id) ?? "").includes(term)),
    })).filter((chapter) => chapter.sections.length > 0);
  }, [term, index]);

  const matches = chapters.reduce((sum, c) => sum + c.sections.length, 0);

  return (
    <Box sx={{ pb: 6 }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h1" sx={{ fontSize: 28, fontWeight: 700, mb: 0.75 }}>
          User manual
        </Typography>
        <Typography sx={{ color: "text.secondary", fontSize: 15, maxWidth: 680, lineHeight: 1.65 }}>
          How to run the shop from this application — taking orders, keeping stock
          straight, and everything customers see on the website.
        </Typography>
        {user && (
          <Typography sx={{ color: "text.secondary", fontSize: 13.5, mt: 1.25 }}>
            You are signed in as {user.name} ({user.roleLabel}). Sections your role
            cannot open are marked, so you can see what a colleague would do.
          </Typography>
        )}
      </Box>

      <TextField
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search the manual — try “expiry”, “coupon”, “refund”"
        fullWidth
        size="small"
        sx={{ mb: term ? 1.5 : 3, maxWidth: 520 }}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchRoundedIcon fontSize="small" />
              </InputAdornment>
            ),
          },
        }}
      />

      {term && (
        <Typography sx={{ fontSize: 13.5, color: "text.secondary", mb: 3 }}>
          {matches === 0
            ? "Nothing in the manual matches that."
            : `${matches} section${matches === 1 ? "" : "s"} mention “${query.trim()}”.`}
        </Typography>
      )}

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1fr) 260px" },
          gap: { xs: 0, lg: 5 },
          alignItems: "start",
        }}
      >
        {/* ---- Content ---- */}
        <Box sx={{ minWidth: 0, order: { xs: 2, lg: 1 } }}>
          {chapters.map((chapter) => (
            <Box key={chapter.title} sx={{ mb: 4 }}>
              <Typography
                sx={{
                  fontSize: 12.5,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: 0.8,
                  color: "primary.main",
                  mb: 1.5,
                }}
              >
                {chapter.title}
              </Typography>

              {chapter.sections.map((section) => {
                const locked = Boolean(section.permission) && !can(section.permission!);
                return (
                  <Paper
                    key={section.id}
                    id={section.id}
                    variant="outlined"
                    sx={{
                      p: { xs: 2.25, sm: 3 },
                      mb: 2.5,
                      borderRadius: 3,
                      // Clears the fixed top bar when jumped to by anchor.
                      scrollMarginTop: 88,
                    }}
                  >
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "baseline",
                        flexWrap: "wrap",
                        gap: 1,
                        mb: 0.5,
                      }}
                    >
                      <Typography variant="h2" sx={{ fontSize: 20, fontWeight: 700 }}>
                        {section.title}
                      </Typography>
                      {locked && (
                        <Chip
                          size="small"
                          variant="outlined"
                          icon={<LockOutlinedIcon sx={{ fontSize: 14 }} />}
                          label="Not available to your role"
                          sx={{ fontSize: 11.5, height: 22 }}
                        />
                      )}
                    </Box>
                    <Typography sx={{ color: "text.secondary", fontSize: 14, mb: 2.25 }}>
                      {section.summary}
                    </Typography>
                    <Divider sx={{ mb: 2.25 }} />
                    {section.blocks.map((block, index) => (
                      <Block key={index} block={block} />
                    ))}
                  </Paper>
                );
              })}
            </Box>
          ))}
        </Box>

        {/* ---- Contents ---- */}
        <Box
          component="nav"
          aria-label="Manual contents"
          sx={{
            order: { xs: 1, lg: 2 },
            position: { lg: "sticky" },
            top: { lg: 88 },
            mb: { xs: 3, lg: 0 },
            maxHeight: { lg: "calc(100vh - 120px)" },
            overflowY: { lg: "auto" },
          }}
        >
          <Typography
            sx={{
              fontSize: 12,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: 0.8,
              color: "text.secondary",
              mb: 1,
            }}
          >
            On this page
          </Typography>
          {chapters.map((chapter) => (
            <Box key={chapter.title} sx={{ mb: 1.5 }}>
              <Typography sx={{ fontSize: 12.5, fontWeight: 700, mb: 0.5 }}>
                {chapter.title}
              </Typography>
              {chapter.sections.map((section) => (
                <Box
                  key={section.id}
                  component="a"
                  href={`#${section.id}`}
                  sx={{
                    display: "block",
                    fontSize: 13.25,
                    lineHeight: 1.5,
                    py: 0.4,
                    color: "text.secondary",
                    textDecoration: "none",
                    borderLeft: "2px solid",
                    borderColor: "divider",
                    pl: 1.25,
                    "&:hover": { color: "primary.main", borderColor: "primary.main" },
                  }}
                >
                  {section.title}
                </Box>
              ))}
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  );
}
