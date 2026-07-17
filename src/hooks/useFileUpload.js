import { useState } from "react";
import { base44 } from "@/api/base44Client";

// Shared upload-a-file-to-Base44-storage plumbing — used by every
// attachments UI (TaskAttachments, AttachmentsAndLinks) so the
// isUploading-flag/try-finally boilerplate around
// `base44.integrations.Core.UploadFile` only lives in one place.
export function useFileUpload() {
  const [isUploading, setIsUploading] = useState(false);

  const upload = async (file) => {
    setIsUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      return file_url;
    } finally {
      setIsUploading(false);
    }
  };

  return { isUploading, upload };
}
