/** The server must be explicitly enabled before it can consume send jobs. */
export function instagramSendEnabled(value: string | undefined): boolean {
  return value === 'true';
}
