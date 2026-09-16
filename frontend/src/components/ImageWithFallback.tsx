import { useEffect, useState, type ReactNode } from "react";

interface ImageWithFallbackProps {
  src?: string | null;
  alt: string;
  fallback: ReactNode;
  className?: string;
  onLoadError?: () => void;
}

export default function ImageWithFallback({ src, alt, fallback, className, onLoadError }: ImageWithFallbackProps) {
  const [failed, setFailed] = useState(false);

  useEffect(() => setFailed(false), [src]);

  if (!src || failed) return <>{fallback}</>;
  return <img src={src} alt={alt} className={className} onError={() => { setFailed(true); onLoadError?.(); }} />;
}
