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
import { Todo, getTodo } from "./service";

const QueryParams = t.strict({
  name: t.string,
  age: IntFromString,
});

type ReaderMW<
  R,
  I = StatusOpen,
  O = StatusOpen,
  E = string
> = R.ReaderMiddleware<string, I, O, E, R>;

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

const ok = (response: string): ReaderMW<void, StatusOpen, ResponseEnded> =>
  pipe(
    R.status<string>(Status.OK),
    R.ichain(() => R.ask<string, HeadersOpen>()),
    R.ichain((requestId) => R.header("X-Request-Id", requestId)),
    R.ichain(() => R.closeHeaders()),
    R.ichain(() => R.send(response))
  );

const performCall = (query: Query) =>
  pipe(
    R.ask<string>(),
    R.ichain(
      (requestId): ReaderMW<Todo> => pipe(getTodo(requestId), R.fromTaskEither)
    ),
    R.map<Todo, string>((todo) => `Hello ${query.name}, title: ${todo.title}`),
    R.ichain(ok)
  );

const badRequest = (
  message: string
): ReaderMW<void, StatusOpen, ResponseEnded, never> =>
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
  R.ichain(performCall),
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
