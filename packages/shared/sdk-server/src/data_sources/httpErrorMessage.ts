export default function httpErrorMessage(
  err: {
    status: number;
    message: string;
  },
  context: string,
  retryMessage?: string
): string {
  let desc;
  if (err.status) {
    desc = `error ${err.status}${err.status === 401 ? ' (invalid SDK key)' : ''}`;
  } else {
    desc = `I/O error (${err.message || err})`;
  }
  const action = retryMessage ?? 'giving up permanently';
  return `Received ${desc} for ${context} - ${action}`;
}
