"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useState, useTransition, useEffect } from "react";
import { Input } from "@/components/ui/input";

export function SearchInput({ placeholder }: { placeholder?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const initialQuery = searchParams?.get("q") || "";
  const [value, setValue] = useState(initialQuery);
  const [isPending, startTransition] = useTransition();

  // Sync value when the search parameter changes (e.g. back navigation or page load)
  useEffect(() => {
    const t = setTimeout(() => {
      setValue(searchParams?.get("q") || "");
    }, 0);
    return () => clearTimeout(t);
  }, [searchParams]);

  const handleSearch = (term: string) => {
    setValue(term);

    startTransition(() => {
      const params = new URLSearchParams(searchParams?.toString() || "");
      if (term) {
        params.set("q", term);
      } else {
        params.delete("q");
      }
      router.replace(`${pathname}?${params.toString()}`);
    });
  };

  return (
    <div className="relative max-w-xs w-full">
      <Input
        value={value}
        onChange={(e) => handleSearch(e.target.value)}
        placeholder={placeholder || "Search files..."}
        className="max-w-xs bg-background"
      />
      {isPending && (
        <span className="absolute right-3 top-2.5 flex h-4 w-4 items-center justify-center">
          <svg className="animate-spin h-3.5 w-3.5 text-muted-foreground" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </span>
      )}
    </div>
  );
}
