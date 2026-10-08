import { MAX_WORKOUT_MEDIA, MAX_WORKOUT_MEDIA_DATA_LENGTH, type WorkoutMedia } from "./model";

function readDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("This file could not be read. Choose it again."));
    reader.readAsDataURL(file);
  });
}

export async function prepareWorkoutMedia(file: File, existing: WorkoutMedia[]): Promise<WorkoutMedia> {
  if (existing.length >= MAX_WORKOUT_MEDIA) throw new Error("You can attach up to three photos or clips.");
  const available = MAX_WORKOUT_MEDIA_DATA_LENGTH - existing.reduce((sum, item) => sum + item.dataUrl.length, 0);
  let dataUrl: string;
  let mimeType = file.type;
  const type = mimeType.startsWith("image/") ? "image" : "video";
  if (type === "image") {
    if (file.size > 20 * 1024 * 1024) throw new Error("Choose a photo smaller than 20 MB.");
    const source = URL.createObjectURL(file);
    try {
      const image = new Image();
      image.src = source;
      await image.decode().catch(() => { throw new Error("Choose a supported photo such as JPEG, PNG or WebP."); });
      const canvas = document.createElement("canvas");
      const scale = Math.min(1, 1200 / Math.max(image.naturalWidth, image.naturalHeight));
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext("2d");
      if (!context) throw new Error("This browser cannot prepare photos.");
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      dataUrl = canvas.toDataURL("image/jpeg", .8);
      for (const quality of [.65, .5, .35]) {
        if (dataUrl.length <= Math.min(available, 400000)) break;
        dataUrl = canvas.toDataURL("image/jpeg", quality);
      }
      mimeType = "image/jpeg";
    } finally { URL.revokeObjectURL(source); }
  } else {
    if (!["video/mp4", "video/webm", "video/quicktime"].includes(mimeType)) throw new Error("Choose an MP4, WebM or MOV video clip.");
    if (file.size > 400 * 1024 || Math.ceil(file.size / 3) * 4 + 64 > available) throw new Error("Choose a short video smaller than 400 KB, or attach a photo.");
    dataUrl = await readDataUrl(file);
  }
  if (dataUrl.length > available) throw new Error("These attachments are too large together. Remove one or choose a smaller photo.");
  return { id: crypto.randomUUID(), type, name: file.name.slice(0, 200), mimeType, dataUrl };
}
