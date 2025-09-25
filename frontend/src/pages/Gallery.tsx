import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactElement,
} from "react";

type SortMode = "recent" | "popular" | "trending";

type ImageOut = {
  id: number;
  author_name?: string | null;
  image_name?: string | null;
  original_filename: string;
  stored_filename: string;
  content_type?: string | null;
  size?: number | null;
  created_at: string; // ISO
  likes_count: number;
  liked_by_user: boolean;
  image_url: string;
};

const API_URL = (import.meta.env.VITE_API_URL as string) ?? "";

// key used in localStorage for the persisted user hash
const USER_HASH_KEY = "pixel_app_user_hash";

function ensureUserHash(): string {
  try {
    const existing = localStorage.getItem(USER_HASH_KEY);
    if (existing) return existing;
    const newHash =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? (crypto as any).randomUUID()
        : `anon-${Date.now().toString(36)}-${Math.random()
            .toString(36)
            .slice(2, 9)}`;
    localStorage.setItem(USER_HASH_KEY, newHash);
    return newHash;
  } catch (e) {
    const fallback = `anon-${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 9)}`;
    try {
      localStorage.setItem(USER_HASH_KEY, fallback);
    } catch {}
    return fallback;
  }
}

export function Gallery(): ReactElement {
  const userHashRef = useRef<string | null>(null);
  const [images, setImages] = useState<ImageOut[]>([]);
  const [page, setPage] = useState<number>(1);
  const pageRef = useRef<number>(1);
  const [limit] = useState<number>(20);
  const [loading, setLoading] = useState<boolean>(false);
  const loadingRef = useRef<boolean>(false);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const loadingMoreRef = useRef<boolean>(false);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const hasMoreRef = useRef<boolean>(true);
  const [sort, setSort] = useState<SortMode>("recent");
  const [error, setError] = useState<string | null>(null);

  // sentinel ref for intersection observer
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // keep a set of loaded ids to avoid duplicates if backend returns overlapping pages
  const loadedIdsRef = useRef<Set<number>>(new Set());

  // sync refs with state to avoid stale closures
  useEffect(() => {
    pageRef.current = page;
  }, [page]);
  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);
  useEffect(() => {
    loadingMoreRef.current = loadingMore;
  }, [loadingMore]);
  useEffect(() => {
    hasMoreRef.current = hasMore;
  }, [hasMore]);

  // initialize user hash once
  useEffect(() => {
    userHashRef.current = ensureUserHash();
  }, []);

  // fetch a page of images
  const fetchPage = useCallback(
    async (pageToLoad: number) => {
      if (!hasMoreRef.current && pageToLoad !== 1) return [];
      const url = new URL(`${API_URL}/images`, location.origin);
      url.searchParams.set("page", String(pageToLoad));
      url.searchParams.set("limit", String(limit));
      url.searchParams.set("sort", sort);
      if (userHashRef.current)
        url.searchParams.set("user_hash", userHashRef.current);

      const resp = await fetch(url.toString());
      if (!resp.ok) {
        const txt = await resp.text().catch(() => resp.statusText);
        throw new Error(txt || "Failed to fetch images");
      }
      const data = (await resp.json()) as ImageOut[];
      return data;
    },
    [limit, sort],
  );

  // load initial page or when sort changes
  useEffect(() => {
    let mounted = true;
    async function loadInitial() {
      setError(null);
      setLoading(true);
      setHasMore(true);
      loadedIdsRef.current.clear();
      setPage(1);
      try {
        const data = await fetchPage(1);
        if (!mounted) return;
        const unique = data.filter((d) => !loadedIdsRef.current.has(d.id));
        unique.forEach((d) => loadedIdsRef.current.add(d.id));
        setImages(unique);
        setHasMore(data.length >= limit);
        setPage(1);
      } catch (err: any) {
        setError(err?.message ?? "Unknown error");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadInitial();
    return () => {
      mounted = false;
    };
  }, [fetchPage, sort, limit]);

  // load next page (uses pageRef to avoid stale page)
  const loadMore = useCallback(async () => {
    // don't run if already loading or no more
    if (loadingRef.current || loadingMoreRef.current) return;
    if (!hasMoreRef.current) return;

    setLoadingMore(true);
    try {
      const nextPage = pageRef.current + 1;
      const data = await fetchPage(nextPage);
      const unique = data.filter((d) => !loadedIdsRef.current.has(d.id));
      unique.forEach((d) => loadedIdsRef.current.add(d.id));
      setImages((prev) => [...prev, ...unique]);
      setPage(nextPage);
      setHasMore(data.length >= limit);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load more");
    } finally {
      setLoadingMore(false);
    }
  }, [fetchPage, limit]);

  // ensure refs track state for the time loadMore runs
  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);
  useEffect(() => {
    loadingMoreRef.current = loadingMore;
  }, [loadingMore]);
  useEffect(() => {
    hasMoreRef.current = hasMore;
  }, [hasMore]);

  // intersection observer to trigger loadMore when sentinel is visible
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    // Only observe when we actually have more to load
    if (!hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (
            entry.isIntersecting &&
            hasMoreRef.current && // double-check via ref (avoid races)
            !loadingRef.current &&
            !loadingMoreRef.current
          ) {
            void loadMore();
          }
        }
      },
      { root: null, rootMargin: "200px", threshold: 0.1 },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore, hasMore]);

  // like/unlike handler (optimistic)
  const toggleLike = useCallback(
    async (imageId: number, currentlyLiked: boolean) => {
      // optimistic update
      setImages((prev) =>
        prev.map((img) =>
          img.id === imageId
            ? {
                ...img,
                liked_by_user: !currentlyLiked,
                likes_count: img.likes_count + (currentlyLiked ? -1 : 1),
              }
            : img,
        ),
      );

      const action = currentlyLiked ? "unlike" : "like";
      try {
        const res = await fetch(`${API_URL}/api/images/${imageId}/like`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            user_hash: userHashRef.current,
            action,
          }),
        });
        if (!res.ok) {
          const txt = await res.text().catch(() => res.statusText);
          throw new Error(txt || "Failed to update like");
        }
        const json = await res.json();
        // server returned authoritative likes_count / liked_by_user, so sync
        setImages((prev) =>
          prev.map((img) =>
            img.id === imageId
              ? {
                  ...img,
                  likes_count: json.likes_count,
                  liked_by_user: json.liked_by_user,
                }
              : img,
          ),
        );
      } catch (err) {
        // rollback optimistic update on error
        setImages((prev) =>
          prev.map((img) =>
            img.id === imageId
              ? {
                  ...img,
                  liked_by_user: currentlyLiked,
                  likes_count: img.likes_count + (currentlyLiked ? 1 : -1), // revert
                }
              : img,
          ),
        );
        setError((err as any)?.message ?? "Failed to like image");
        setTimeout(() => setError(null), 4000);
      }
    },
    [],
  );

  const formatDate = useCallback((iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleString();
    } catch {
      return iso;
    }
  }, []);

  return (
    <div className="mx-auto max-w-6xl sm:p-4">
      <div className="mb-4 flex flex-col items-center justify-between gap-4 sm:flex-row">
        <h1 className="text-2xl font-semibold">Gallery</h1>

        <div className="flex items-center gap-2">
          <label className="hidden text-sm sm:inline">Sort:</label>
          <div
            className="inline-flex rounded-md shadow-sm"
            role="tablist"
            aria-label="Sort images"
          >
            {(["recent", "popular", "trending"] as SortMode[]).map((s) => {
              const active = s === sort;
              return (
                <button
                  key={s}
                  onClick={() => {
                    if (s === sort) return;
                    setSort(s);
                  }}
                  className={`border px-3 py-1 text-sm leading-5 ${
                    active
                      ? "border-blue-700 bg-blue-600 text-white"
                      : "border-gray-200 bg-white text-gray-700"
                  } first:rounded-l-md last:rounded-r-md`}
                  aria-pressed={active}
                >
                  {s === "recent"
                    ? "Recent"
                    : s === "popular"
                      ? "Popular"
                      : "Trending"}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded border border-red-100 bg-red-50 p-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {images.map((img) => (
          <article
            key={img.id}
            className="overflow-hidden rounded bg-white shadow-sm"
          >
            <div className="relative aspect-square bg-gray-100">
              <img
                src={img.image_url}
                alt={img.image_name ?? img.original_filename}
                className="h-full w-full object-cover"
                loading="lazy"
                draggable={false}
              />
            </div>

            <div className="flex items-end justify-between gap-2 p-2">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">
                  {img.image_name ?? "Untitled"}
                </div>
                <div className="truncate text-sm text-gray-500">
                  {img.author_name ?? "Unknown author"}
                </div>
                <div className="truncate text-xs text-gray-500">
                  {formatDate(img.created_at)}
                </div>
              </div>

              <div className="ml-2 flex items-center gap-2">
                <button
                  onClick={() => void toggleLike(img.id, img.liked_by_user)}
                  className={`inline-flex items-center gap-1 rounded px-2 py-1 text-sm font-medium transition-colors focus:outline-none ${
                    img.liked_by_user
                      ? "bg-red-600 text-white"
                      : "bg-gray-100 text-gray-800"
                  }`}
                  aria-pressed={img.liked_by_user}
                  aria-label={img.liked_by_user ? "Unlike" : "Like"}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className={`h-4 w-4 ${img.liked_by_user ? "fill-current" : "stroke-current"}`}
                    viewBox="0 0 24 24"
                    fill={img.liked_by_user ? "currentColor" : "none"}
                    stroke="currentColor"
                    strokeWidth="1.5"
                  >
                    <path d="M12 21s-7.5-4.5-10-7a5 5 0 010-7c2.1-2.2 5.4-2 7.6-.6L12 6.5l2.4-0.1c2.2-1.4 5.5-1.6 7.6.6a5 5 0 010 7c-2.5 2.6-10 7-10 7z" />
                  </svg>
                  <span>{img.likes_count}</span>
                </button>
              </div>
            </div>
          </article>
        ))}

        {loading &&
          Array.from({ length: 8 }).map((_, i) => (
            <div
              key={`skeleton-${i}`}
              className="animate-pulse overflow-hidden rounded bg-white shadow-sm"
            >
              <div className="aspect-square bg-gray-200" />
              <div className="p-2">
                <div className="mb-2 h-3 w-3/4 rounded bg-gray-200" />
                <div className="h-3 w-1/2 rounded bg-gray-200" />
              </div>
            </div>
          ))}

        {loadingMore &&
          Array.from({ length: 3 }).map((_, i) => (
            <div
              key={`more-skel-${i}`}
              className="animate-pulse overflow-hidden rounded bg-white shadow-sm"
            >
              <div className="aspect-square bg-gray-200" />
              <div className="p-2">
                <div className="mb-2 h-3 w-3/4 rounded bg-gray-200" />
                <div className="h-3 w-1/2 rounded bg-gray-200" />
              </div>
            </div>
          ))}
      </div>

      {/* sentinel that triggers loading more when in view.
          Observer is only attached while hasMore === true so we won't endlessly trigger when content is short */}
      <div ref={sentinelRef} className="h-6" />

      {!loading && !loadingMore && !hasMore && (
        <div className="mt-6 text-center text-sm text-gray-500">
          You've reached the end.
        </div>
      )}

      {loadingMore && (
        <div className="mt-4 flex items-center justify-center">
          <svg
            className="h-6 w-6 animate-spin text-gray-600"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
            />
          </svg>
        </div>
      )}
    </div>
  );
}
