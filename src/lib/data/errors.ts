/**
 * The vocabulary every mutation answers in.
 *
 * A Server Action runs on the server and its exceptions carry server details:
 * absolute paths, driver messages, stack frames. Returning `error.message`
 * straight to the browser is how `ENOENT: no such file or directory, mkdir
 * '/var/task/.impasto-demo'` ended up rendered on a public page.
 *
 * So failures cross the boundary as a *code*. The client looks the code up in
 * its own message catalog, which means the user sees a localized sentence and
 * the server keeps its internals. `detail` exists only for text that was
 * already written for the user -- a validation message the app itself
 * composed -- and never for a caught exception.
 */
export type ActionErrorCode =
  | 'readonly'
  | 'validation'
  | 'not_found'
  | 'conflict'
  | 'cycle'
  | 'rate_limited'
  | 'unauthorized'
  | 'unknown'

export interface ActionError {
  code: ActionErrorCode
  /** Already user-facing text the app composed itself. Never an exception message. */
  detail?: string
}

/**
 * What a screen is allowed to render.
 *
 * The provider-facing flows -- import, scan, translate -- answer with sentences
 * this codebase wrote itself, describing which key is missing or which URL was
 * refused, so those stay plain strings. Everything derived from a caught
 * exception is a code.
 */
export type DisplayError = ActionError | string

const MESSAGE_KEYS: Record<ActionErrorCode, string> = {
  readonly: 'errors.readOnly',
  validation: 'errors.validation',
  not_found: 'errors.notFound',
  conflict: 'errors.conflict',
  cycle: 'errors.cycle',
  rate_limited: 'errors.rateLimited',
  unauthorized: 'errors.unauthorized',
  unknown: 'errors.generic',
}

/** The message key a client should translate for this code. */
export function messageKeyFor(code: ActionErrorCode): string {
  return MESSAGE_KEYS[code]
}

export function actionError(code: ActionErrorCode, detail?: string): ActionError {
  return detail ? { code, detail } : { code }
}

/** The read-only refusal, which is a normal answer rather than a fault. */
export const READ_ONLY_ERROR: ActionError = { code: 'readonly' }

/**
 * Marker for a backend that will not accept writes at all.
 *
 * Thrown before any I/O is attempted, so there is never a partially applied
 * change and never a platform error message to leak.
 */
export class ReadOnlyStoreError extends Error {
  readonly code = 'readonly' as const

  constructor(message = 'This deployment is read-only') {
    super(message)
    this.name = 'ReadOnlyStoreError'
  }
}
