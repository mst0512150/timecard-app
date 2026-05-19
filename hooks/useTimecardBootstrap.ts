"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchBootstrapAction } from "@/actions/timecard";
import type { Staff, TimeEntry } from "@/types/timecard";

export function useTimecardBootstrap() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const openByStaff = useMemo(() => {
    const map = new Map<string, TimeEntry>();
    for (const e of entries) {
      if (!e.clockOut) map.set(e.staffId, e);
    }
    return map;
  }, [entries]);

  const completedEntries = useMemo(
    () => entries.filter((e) => e.clockOut),
    [entries],
  );

  const load = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) {
      setLoading(true);
    }
    setError(null);
    const res = await fetchBootstrapAction();
    if (!res.ok) {
      setError(res.error);
      if (!options?.silent) {
        setStaff([]);
        setEntries([]);
      }
    } else {
      setStaff(res.staff);
      setEntries(res.entries);
    }
    if (!options?.silent) {
      setLoading(false);
    }
  }, []);

  const patchStaff = useCallback((staffId: string, patch: Partial<Staff>) => {
    setStaff((prev) =>
      prev.map((s) => (s.id === staffId ? { ...s, ...patch } : s)),
    );
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    staff,
    entries,
    loading,
    error,
    message,
    setError,
    setMessage,
    load,
    patchStaff,
    openByStaff,
    completedEntries,
  };
}
