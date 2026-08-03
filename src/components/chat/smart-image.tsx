"use client";
import { useState } from "react";

/**
 * Imagen del chat con la técnica Signal de dos capas: se renderiza primero
 * la miniatura (thumb, WebP pequeña) como preview y el `medium` se cruza
 * encima cuando carga — nada de esperar a descargar el original para ver
 * una foto. Al hacer clic se abre el original en una pestaña nueva.
 *
 * Compatible con adjuntos antiguos/reenviados que no tienen variantes
 * derivadas: si falta thumb/medium, `display` cae al original.
 */
export function SmartImage({
  thumb,
  medium,
  original,
  alt,
  className,
}: {
  thumb?: string;
  medium?: string;
  original: string;
  alt: string;
  className?: string;
}) {
  const [loaded, setLoaded] = useState(false);
  const display = medium || original;
  const showThumb = thumb && thumb !== display && !loaded;

  return (
    <a href={original} target="_blank" rel="noopener noreferrer" className={className} aria-label={alt}>
      {showThumb && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={thumb}
          alt=""
          aria-hidden
          className="absolute inset-0 h-full w-full object-cover"
          style={{ filter: "blur(7px)", transform: "scale(1.03)" }}
        />
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={display}
        alt={alt}
        loading="lazy"
        onLoad={() => setLoaded(true)}
        className="relative h-full w-full object-cover"
        style={loaded ? undefined : { opacity: 0 }}
      />
    </a>
  );
}
