const { issueTicket, redeemTicket, subscribe } = require('../services/events.service');
const { asyncHandler, sendSuccess } = require('../utils/http');
const ApiError = require('../utils/ApiError');

// Step 1 (authenticated): exchange the access token for a one-time stream ticket.
exports.ticket = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: { ticket: issueTicket(req.user._id) } });
});

// Step 2: EventSource connects with the ticket and receives live updates.
exports.stream = (req, res, next) => {
  const userId = redeemTicket(String(req.query.ticket || ''));
  if (!userId) return next(ApiError.unauthorized('Invalid or expired event ticket.'));

  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();
  const write = (chunk) => {
    res.write(chunk);
    // The compression middleware buffers output unless flushed explicitly.
    if (typeof res.flush === 'function') res.flush();
  };
  write('retry: 10000\n\n');

  const unsubscribe = subscribe(userId, (event) => write(`event: update\ndata: ${JSON.stringify(event)}\n\n`));
  const heartbeat = setInterval(() => write(': ping\n\n'), 25000);
  req.on('close', () => {
    clearInterval(heartbeat);
    unsubscribe();
  });
  return undefined;
};
