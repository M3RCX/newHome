import { useState } from "react";
import { GALLERY_LABEL, galleries, type GalleryKey, type Photo } from "../content";
import Modal from "./Modal";

export default function Gallery({ name }: { name: GalleryKey }) {
  const photos = galleries[name];
  const [open, setOpen] = useState<Photo | null>(null);

  if (!photos.length) {
    return (
      <div className="gallery">
        {["em breve", "fotos", "aqui"].map((t) => (
          <div className="slot" key={t}>
            {t}
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="gallery" aria-label={GALLERY_LABEL[name]}>
        {photos.map((p) => (
          <figure className="ph" key={p.src}>
            <button type="button" className="open" aria-label="Ampliar foto" onClick={() => setOpen(p)}>
              <img src={p.src} alt={p.caption || GALLERY_LABEL[name]} loading="lazy" />
            </button>
            {p.caption && <figcaption>{p.caption}</figcaption>}
          </figure>
        ))}
      </div>
      {open && (
        <Modal label={open.caption || "Foto"} onClose={() => setOpen(null)}>
          <img className="big-photo" src={open.src} alt={open.caption || "Foto"} />
          {open.caption && (
            <p className="hand" style={{ textAlign: "center" }}>
              {open.caption}
            </p>
          )}
        </Modal>
      )}
    </>
  );
}
