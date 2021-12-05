import express from "express";
import { Status, HeadersOpen, StatusOpen, ResponseEnded } from "hyper-ts";
import * as E from "fp-ts/Either";
import * as M from "hyper-ts/lib/Middleware";
import * as R from "hyper-ts/lib/ReaderMiddleware";
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

const queryDecoder = (u: unknown) =>
  pipe(
    QueryParams.decode(u),
    E.mapLeft(
      (errors) => `Invalid query parameters:\n${failure(errors).join("\n")}`
    )
  );

const withDefault = (value: unknown): E.Either<never, string> =>
  pipe(
    t.string.decode(value),
    E.orElse(() => E.right(uuidv4()))
  );

const ageValidation = (query: Query) =>
  pipe(query.age > 41 ? E.left("too old!") : E.right(query), R.fromEither);

const greenPath = (
  query: Query
): R.ReaderMiddleware<string, StatusOpen, ResponseEnded, string, void> =>
  pipe(
    R.status<string>(Status.OK),
    R.ichain(() => R.ask<string, HeadersOpen>()),
    R.ichain((requestId) => R.header("X-Request-Id", requestId)),
    R.ichain(() => R.closeHeaders()),
    R.ichain(() => R.send(`Hello ${query.name}!`))
  );

const badRequest = (
  message: string
): R.ReaderMiddleware<string, StatusOpen, ResponseEnded, never, void> =>
  pipe(
    R.status(Status.BadRequest),
    R.ichain(() => R.ask<string, HeadersOpen>()),
    R.ichain((requestId) => R.header("X-Request-Id", requestId)),
    R.ichain(() => R.closeHeaders()),
    R.ichain(() => R.send(message))
  );

const withRequestId = pipe(
  R.decodeQuery(queryDecoder),
  R.ichain(ageValidation),
  R.ichain(greenPath),
  R.orElse(badRequest)
);

const hello = pipe(
  M.decodeHeader("x-request-id", withDefault),
  M.ichain(withRequestId)
);

express()
  .get("/hello", toRequestHandler(hello))
  .listen(3000, () =>
    console.log("Express listening on port 3000. Use: GET /hello")
  );
