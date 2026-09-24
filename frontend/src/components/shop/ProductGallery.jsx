import { useMemo, useRef, useState } from "react";
import { X, ChevronLeft, ChevronRight, ZoomIn } from "lucide-react";

const LENS_SIZE = 160;
const ZOOM = 2.2;

export default function ProductGallery({ images, collectionInitial, alt }) {
  const photos = useMemo(() => (images || []).filter(Boolean), [images]);
  const [active, setActive] = useState(0);
  const [hovering, setHovering] = useState(false);
  const [lensPos, setLensPos] = useState({ x: 0, y: 0, bgX: 0, bgY: 0 });
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const mainRef = useRef(null);

  if (photos.length === 0) {
    return (
      <div className="bg-[#F1EEE8] aspect-square overflow-hidden">
        <div className="w-full h-full flex items-center justify-center font-serif-display text-8xl text-[#C0B9AE]">
          {collectionInitial}
        </div>
      </div>
    );
  }

  const current = photos[active];

  const handleMouseMove = (e) => {
    const rect = mainRef.current.getBoundingClientRect();
    let x = e.clientX - rect.left;
    let y = e.clientY - rect.top;
    x = Math.max(0, Math.min(x, rect.width));
    y = Math.max(0, Math.min(y, rect.height));
    const bgX = -(x * ZOOM - LENS_SIZE / 2);
    const bgY = -(y * ZOOM - LENS_SIZE / 2);
    setLensPos({
      x: Math.min(Math.max(x - LENS_SIZE / 2, -LENS_SIZE / 4), rect.width - LENS_SIZE * 0.75),
      y: Math.min(Math.max(y - LENS_SIZE / 2, -LENS_SIZE / 4), rect.height - LENS_SIZE * 0.75),
      bgX,
      bgY,
      w: rect.width * ZOOM,
      h: rect.height * ZOOM,
    });
  };

  return (
    <div>
      <div className="flex gap-4" data-testid="pdp-gallery">
        {photos.length > 1 && (
          <div className="hidden sm:flex flex-col gap-3 w-20 flex-shrink-0">
            {photos.map((src, i) => (
              <button
                key={i}
                type="button"
                data-testid={`pdp-thumb-${i}`}
                onClick={() => setActive(i)}
                className={`w-20 h-20 bg-[#F1EEE8] overflow-hidden border-2 transition-colors ${
                  i === active ? "border-[#C05A3E]" : "border-transparent hover:border-[#C0B9AE]"
                }`}
              >
                <img src={src} alt={`${alt} ${i + 1}`} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}

        <div
          ref={mainRef}
          className="relative bg-[#F1EEE8] aspect-square overflow-hidden flex-1 cursor-zoom-in"
          onMouseEnter={() => setHovering(true)}
          onMouseLeave={() => setHovering(false)}
          onMouseMove={handleMouseMove}
          onClick={() => setLightboxOpen(true)}
          data-testid="pdp-main-image"
        >
          <img src={current} alt={alt} className="w-full h-full object-cover" />

          {hovering && (
            <div
              className="hidden md:block absolute rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.15),0_8px_24px_rgba(0,0,0,0.25)] pointer-events-none overflow-hidden"
              style={{
                width: LENS_SIZE,
                height: LENS_SIZE,
                left: lensPos.x,
                top: lensPos.y,
                backgroundImage: `url(${current})`,
                backgroundSize: `${lensPos.w}px ${lensPos.h}px`,
                backgroundPosition: `${lensPos.bgX}px ${lensPos.bgY}px`,
              }}
            />
          )}

          <div className="absolute bottom-3 right-3 flex items-center gap-1.5 bg-black/70 text-white text-xs px-3 py-1.5">
            <ZoomIn className="w-3.5 h-3.5" /> Clic per anteprima
          </div>

          {photos.length > 1 && (
            <div className="sm:hidden absolute bottom-3 left-0 right-0 flex justify-center gap-1.5">
              {photos.map((_, i) => (
                <span key={i} className={`w-1.5 h-1.5 rounded-full ${i === active ? "bg-white" : "bg-white/40"}`} />
              ))}
            </div>
          )}
        </div>
      </div>

      {photos.length > 1 && (
        <div className="sm:hidden flex gap-2 mt-3">
          {photos.map((src, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setActive(i)}
              className={`w-16 h-16 bg-[#F1EEE8] overflow-hidden border-2 flex-shrink-0 ${
                i === active ? "border-[#C05A3E]" : "border-transparent"
              }`}
            >
              <img src={src} alt={`${alt} ${i + 1}`} className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}

      {lightboxOpen && (
        <div
          className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightboxOpen(false)}
          data-testid="pdp-lightbox"
        >
          <button
            type="button"
            onClick={() => setLightboxOpen(false)}
            className="absolute top-5 right-5 text-white/80 hover:text-white"
            data-testid="pdp-lightbox-close"
          >
            <X className="w-8 h-8" />
          </button>

          {photos.length > 1 && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setActive((a) => (a - 1 + photos.length) % photos.length); }}
              className="absolute left-3 sm:left-8 text-white/70 hover:text-white p-2"
            >
              <ChevronLeft className="w-9 h-9" />
            </button>
          )}

          <img
            src={photos[active]}
            alt={alt}
            onClick={(e) => e.stopPropagation()}
            className="max-w-full max-h-[85vh] object-contain"
          />

          {photos.length > 1 && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setActive((a) => (a + 1) % photos.length); }}
              className="absolute right-3 sm:right-8 text-white/70 hover:text-white p-2"
            >
              <ChevronRight className="w-9 h-9" />
            </button>
          )}

          {photos.length > 1 && (
            <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-2">
              {photos.map((_, i) => (
                <span
                  key={i}
                  onClick={(e) => { e.stopPropagation(); setActive(i); }}
                  className={`w-2 h-2 rounded-full cursor-pointer ${i === active ? "bg-white" : "bg-white/40"}`}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
