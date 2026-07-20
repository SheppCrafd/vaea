import { useState } from "react";

// Shared upload-a-file plumbing — used by every non-chat attachments UI
// (TaskAttachments, AttachmentsAndLinks). Files are read as data URLs and
// stored inline (in the attaching record's `attachments` array in
// localStorage) since there's no backend file store anymore. Chat
// attachments are unrelated to this hook — see useChatController.js, which
// still uploads via base44.
export function useFileUpload() {
  const [isUploading, setIsUploading] = useState(false);

  const upload = async (file) => {
    setIsUploading(true);
    try {
      const file_url = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      return file_url;
    } finally {
      setIsUploading(false);
    }
  };

  return { isUploading, upload };
}
