// Pure formatting helpers shared by the module board pages. Kept in a plain .ts
// module (no components) so Fast Refresh stays happy in the .tsx board files.

export const nice = (s: string) => s.replace(/_/g, " ");

export const fmtDate = (d: string | Date | null | undefined) =>
  d
    ? new Date(d).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "-";
