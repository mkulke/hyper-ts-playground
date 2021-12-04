import express from "express";
import { Status, StatusOpen, ResponseEnded } from "hyper-ts";
import * as E from "fp-ts/Either";
import * as M from "hyper-ts/lib/Middleware";
import { toRequestHandler } from "hyper-ts/lib/express";
import { pipe } from "fp-ts/function";
import * as t from "io-ts";
import { failure } from "io-ts/lib/PathReporter";
import { IntFromString } from "io-ts-types/lib/IntFromString";
import { v4 as uuidv4 } from "uuid";

const QueryParams = t.strict({
  name: t.string,
  age: IntFromString,
});

type Query = t.TypeOf<typeof QueryParams>;

interface Ctx {
  query: Query;
  requestId: string;
}

const queryDecoder = M.decodeQuery((q) =>
  pipe(
    QueryParams.decode(q),
    E.mapLeft(
      (errors) => `Invalid query parameters:\n${failure(errors).join("\n")}`
    )
  )
);

const withDefault = (value: unknown): E.Either<never, string> =>
  pipe(
    t.string.decode(value),
    E.orElse(() => E.right(uuidv4()))
  );

const ageValidation = (ctx: Ctx) => {
  const either = ctx.query.age > 41 ? E.left("too old!") : E.right(ctx);
  return M.fromEither(either);
};

interface ErrorCtx {
  message: string;
  requestId: string;
}

function badRequest(
  ctx: ErrorCtx
): M.Middleware<StatusOpen, ResponseEnded, never, void> {
  return pipe(
    M.status(Status.BadRequest),
    M.ichain(() => M.header("X-Request-Id", ctx.requestId)),
    M.ichain(() => M.closeHeaders()),
    M.ichain(() => M.send(ctx.message))
  );
}

const greenPath = (ctx: Ctx) =>
  pipe(
    M.status<string>(Status.OK),
    M.ichain(() => M.header("X-Request-Id", ctx.requestId)),
    M.ichain(() => M.closeHeaders()),
    M.ichain(() => M.send(`Hello ${ctx.query.name}!`))
  );

const hello = pipe(
  M.decodeHeader("x-request-id", withDefault),
  M.ichain((requestId: string) =>
    pipe(
      queryDecoder,
      M.map((query) => ({ query, requestId })),
      M.ichain(ageValidation),
      M.ichain(greenPath),
      M.orElse((message) => badRequest({ message, requestId }))
    )
  )
);

express()
  .get("/hello", toRequestHandler(hello))
  .listen(3000, () =>
    console.log("Express listening on port 3000. Use: GET /hello")
  );
