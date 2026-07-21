"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";

// Debounced email search that drives the /admin/users query string.
export function UserSearch({ initial }: { initial?: string }) {
  const router = useRouter();
  const [value, setValue] = useState(initial ?? "");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (value === (initial ?? "")) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const qs = new URLSearchParams();
      if (value.trim()) qs.set("search", value.trim());
      router.push(qs.toString() ? `/admin/users?${qs}` : "/admin/users");
    }, 350);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <Input
      value={value}
      onChange={(e) => setValue(e.target.value)}
      placeholder="Search users by email…"
      className="h-9 w-full sm:w-80"
      type="search"
    />
  );
}
