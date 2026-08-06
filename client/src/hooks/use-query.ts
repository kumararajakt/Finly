import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "@/lib/api";

type QueryState<T> =
  | { status: "loading"; data: undefined; error: undefined }
  | { status: "success"; data: T; error: undefined }
  | { status: "error"; data: undefined; error: ApiError };

type QueryResult<T> = QueryState<T> & {
  refetch: () => void;
};

export function useQuery<T>(fetcher: () => Promise<T>, deps: readonly unknown[] = []): QueryResult<T> {
  const [state, setState] = useState<QueryState<T>>({
    status: "loading",
    data: undefined,
    error: undefined,
  });
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const load = useCallback(() => {
    let cancelled = false;
    setState((previous) =>
      previous.status === "success" || previous.status === "error"
        ? { status: "loading", data: undefined, error: undefined }
        : previous
    );
    fetcherRef
      .current()
      .then((data) => {
        if (!cancelled) setState({ status: "success", data, error: undefined });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof ApiError) {
          setState({ status: "error", data: undefined, error });
        } else {
          setState({
            status: "error",
            data: undefined,
            error: new ApiError(error instanceof Error ? error.message : "Something went wrong.", 0),
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { ...state, refetch: load };
}
