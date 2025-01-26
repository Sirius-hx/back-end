export function formatResponse(status, message, ...data) {
  return { success: status, message, ...data };
}
