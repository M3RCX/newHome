// Reduz a foto no navegador antes do upload (como o shrink do design): JPEG, lado maior ≤ maxSide.
// Mantém o envio bem abaixo do limite de ~6 MB das Netlify Functions.
export async function shrinkImage(file: File, maxSide = 1400, quality = 0.82): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("Não deu pra ler a imagem."));
      i.src = url;
    });
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#fff"; // PNG transparente vira fundo branco, como nos cartões
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Não deu pra converter a imagem."))), "image/jpeg", quality),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}
