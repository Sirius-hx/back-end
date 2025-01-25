export function formatResponse(status, message, ...data) {
  return { status, message, ...data };
}
