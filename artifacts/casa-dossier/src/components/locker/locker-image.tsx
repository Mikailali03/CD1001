import { useEffect, useState } from "react";
import { useAuth } from "@clerk/react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function photoSrc(objectPath: string) {
  return `${BASE}/api/storage${objectPath}`;
}

// Locker documents are private on the server, so they can't be loaded by a
// bare <img src>; fetch with the session token and show a blob URL instead.
// It's a binary download, so it stays a raw fetch rather than the API client.
export function LockerImage({ objectPath, ...props }: { objectPath: string } & React.ImgHTMLAttributes<HTMLImageElement>) {
  const { getToken } = useAuth();
  const [src, setSrc] = useState<string>();

  useEffect(() => {
    let objectUrl: string | undefined;
    let cancelled = false;
    getToken()
      .then((token) => fetch(photoSrc(objectPath), token ? { headers: { Authorization: `Bearer ${token}` } } : undefined))
      .then((res) => (res.ok ? res.blob() : Promise.reject(new Error(String(res.status)))))
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
    // getToken identity can change between renders; the path is what matters.
  }, [objectPath]);

  return src ? <img src={src} {...props} /> : <div className={props.className} />;
}
