function badRequest(msg) {
  const e = new Error(msg);
  e.statusCode = 400;
  e.expose = true;
  return e;
}

function parseJSONParam(v, fallback) {
  if (v === undefined) return fallback;
  try {
    return JSON.parse(v);
  } catch {
    throw badRequest("Invalid JSON in query parameter");
  }
}

function parseCommonQueryParams(req, { defaultLimit } = {}) {
  const where = parseJSONParam(req.query.where ?? req.query.filter, {});
  const sort = parseJSONParam(req.query.sort, undefined);
  const select = parseJSONParam(req.query.select, undefined);

  const skip = req.query.skip !== undefined ? parseInt(req.query.skip, 10) : undefined;
  const limit =
    req.query.limit !== undefined ? parseInt(req.query.limit, 10) : defaultLimit;

  if (
    (skip !== undefined && Number.isNaN(skip)) ||
    (limit !== undefined && Number.isNaN(limit))
  ) {
    throw badRequest("skip/limit must be valid integers");
  }

  const count = String(req.query.count).toLowerCase() === "true";
  return { where, sort, select, skip, limit, count };
}

module.exports = { parseJSONParam, parseCommonQueryParams };
