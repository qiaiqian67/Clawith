import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { isUploadAccepted, uploadAttachment } from './uploads.ts';

/**
 * The files a message carries.
 *
 * The upload is one operation whether the file comes from the picker or from a
 * drop, so the two paths cannot disagree about what is accepted.
 */

/** One attachment of a message. */
export interface Attachment {
  /** The path of the file in the workspace of the agent. */
  path: string;
  /** The name the user sees. */
  name: string;
  /** The size in bytes. */
  size: number;
  /** Whether the file is an image. */
  image: boolean;
}

export interface UseAttachmentsOptions {
  baseUrl: string;
  token: string | null;
  agentId: string | null;
  attachments: Attachment[];
  onChange: (attachments: Attachment[]) => void;
}

export interface AttachmentsApi {
  /** Add the files of a picker or a drop. */
  add: (files: FileList | File[] | null) => Promise<void>;
  /** Whether an upload is in flight. */
  busy: boolean;
  /** The failure of the last upload, when there was one. */
  error: string | null;
  /** Remove one attachment. */
  remove: (path: string) => void;
  /** Clear the failure. */
  clearError: () => void;
}

export function useAttachments(options: UseAttachmentsOptions): AttachmentsApi {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const add = useCallback(
    async (files: FileList | File[] | null) => {
      if (!files) return;
      const list = Array.from(files);
      if (list.length === 0) return;
      if (!options.token || !options.agentId) return;
      setError(null);
      setBusy(true);
      const added: Attachment[] = [];
      try {
        for (const file of list) {
          if (!isUploadAccepted(file)) {
            setError(t('chat.attachmentRejected'));
            continue;
          }
          const result = await uploadAttachment(
            options.baseUrl,
            options.token,
            options.agentId,
            file,
          );
          added.push({
            path: result.path,
            name: result.filename,
            size: result.size,
            image: file.type.startsWith('image/'),
          });
        }
        if (added.length > 0) {
          options.onChange([...options.attachments, ...added]);
        }
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : t('chat.attachmentFailed'));
      } finally {
        setBusy(false);
      }
    },
    [options, t],
  );

  const remove = useCallback(
    (path: string) => {
      options.onChange(options.attachments.filter((item) => item.path !== path));
    },
    [options],
  );

  return { add, busy, error, remove, clearError: () => setError(null) };
}
