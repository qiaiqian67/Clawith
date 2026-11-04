import { useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { MAX_UPLOAD_BYTES, UPLOAD_DIRECTORY } from '../../shared/uploads.ts';
import type { Attachment, AttachmentsApi } from '../../shared/use-attachments.ts';
import './attachment-picker.css';

/**
 * The attachments of a message.
 *
 * The file goes into the workspace of the agent before the message is sent,
 * so the agent reads it from its own files. The upload of a drop and the
 * upload of the picker are the same operation.
 */

export interface AttachmentPickerProps {
  /** The attachments of the message. */
  attachments: Attachment[];
  /** The upload, shared with the drop zone of the chat. */
  uploads: AttachmentsApi;
}

export function AttachmentPicker(props: AttachmentPickerProps) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement | null>(null);

  return (
    <div className="zx-attachments">
      {props.attachments.length > 0 ? (
        <ul className="zx-attachments-list">
          {props.attachments.map((attachment) => (
            <li key={attachment.path} className="zx-attachment">
              <span className="zx-attachment-name" title={attachment.path}>
                {attachment.name}
              </span>
              <span className="zx-attachment-size">{formatSize(attachment.size)}</span>
              <button
                type="button"
                className="zx-attachment-remove"
                aria-label={t('chat.attachmentRemove')}
                onClick={() => props.uploads.remove(attachment.path)}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {props.uploads.error ? <p className="zx-attachments-error">{props.uploads.error}</p> : null}

      <input
        ref={inputRef}
        className="zx-attachments-input"
        type="file"
        multiple
        disabled={props.uploads.busy}
        onChange={(event) => {
          void props.uploads.add(event.target.files);
          if (inputRef.current) inputRef.current.value = '';
        }}
      />
      <button
        type="button"
        className="zx-attachments-button"
        disabled={props.uploads.busy}
        title={t('chat.attachmentAdd')}
        aria-label={t('chat.attachmentAdd')}
        onClick={() => inputRef.current?.click()}
      >
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
          <path
            d="M21.4 11.1 12.3 20.2a5.5 5.5 0 0 1-7.8-7.8l9.2-9.1a3.7 3.7 0 1 1 5.2 5.2l-9.2 9.1a1.8 1.8 0 0 1-2.6-2.6l8.5-8.4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export { MAX_UPLOAD_BYTES, UPLOAD_DIRECTORY };
