# Миграция Express → NestJS

Документ для перечитывания после фактической миграции (коммит `31d3244`). Объясняет: что было, что стало, что каждый кусок Nest делает, и почему мы выбрали именно такие решения. Аналогии — для FE-разработчика.

---

## 1. Контекст: что вообще такое NestJS

NestJS — это **DI-контейнер с HTTP-маршрутизацией поверх Node**. Под капотом всё ещё крутится либо Express (по умолчанию), либо Fastify — Nest сам не пишет HTTP-сервер, он берёт чужой и оборачивает в свою архитектуру.

Что Nest приносит сверх Express:

1. **Dependency Injection** — вместо `import { fooService } from "..."` ты пишешь `constructor(private foo: FooService)`. Nest при старте решает, кто кому что подложит.
2. **Декораторы вместо ручной маршрутизации** — `@Get('/:id')` вместо `router.get('/:id', handler)`.
3. **Структурированные кросс-каттинги**: Guards, Pipes, Interceptors, Exception Filters — каждый со своей чёткой ролью, вместо одной кучи Express-middleware.
4. **Модули как DI-границы** — `@Module({...})` декларирует, кто кому видим.
5. **Тестируемость из коробки** — `Test.createTestingModule()` поднимает реальный DI-граф без HTTP-сервера; легко переопределять providers.

### FE-аналогии (опорные)

| FE мир                                  | Nest мир                             |
| --------------------------------------- | ------------------------------------ |
| React Context (`<QueryClientProvider>`) | DI-контейнер (`AppModule`)           |
| `useContext(...)`                       | constructor injection                |
| Redux middleware chain                  | Express middleware / Nest middleware |
| Zod schema на форме                     | `ZodBodyPipe` (Pipe)                 |
| Auth-guard на роутах в React Router     | `@UseGuards(...)` (Guard)            |
| Error boundary                          | `@Catch()` Exception Filter          |
| `useEffect` cleanup                     | `OnModuleDestroy` lifecycle hook     |
| TanStack Query `queryFn`                | Service метод                        |
| Component props interface               | DTO (`@app/shared`)                  |

Запомни одно: **ты декларируешь, что нужно, Nest сам всё собирает и подсовывает**. Это инверсия контроля — паттерн, который ты и так знаешь по React-контексту.

---

## 2. Что было до миграции

`apps/api/src/` (стиль Express):

```
config/env.ts                Zod-валидированный env
db/{models,repositories}/    Mongoose
lib/                         logger, errors, openapi
middleware/                  Express middleware-функции (10 шт.)
  request-id.ts
  request-logger.ts
  errorHandler.ts
  validate.ts
  optional-auth.ts
  require-auth.ts
  require-admin-auth.ts
  require-refresh-session.ts
  require-super-admin.ts
  auth-rate-limit.ts
routes/                      Express Router-ы (9 фич)
  auth.routes.ts            ─┐
  blogs.routes.ts            │ каждая собирает:
  comments.routes.ts         │  - router.get/post/...
  health.routes.ts           │  - middleware на нужных роутах
  posts.routes.ts            │  - controller-функции
  security.routes.ts         │  - registerPaths(...) для OpenAPI
  testing.routes.ts          │
  users.routes.ts            │
  docs.routes.ts            ─┘
controllers/                 функции вида (req,res,next)→...
services/                    бизнес-логика (чистые функции)
app.ts                       buildExpressApp() вручную
bootstrap.ts                 гибрид Nest+Express через ExpressAdapter
index.ts                     entry
```

В качестве промежуточного шага у нас был **гибрид**: Nest бутстрапился через `ExpressAdapter` поверх ручного `buildExpressApp()`. Один модуль (`videos`) уже жил по-новому. Гибрид нужен был, чтобы доказать миграцию на одном модуле, не ломая остальные.

---

## 3. Что стало после миграции

```
apps/api/src/
├── index.ts                          ← entry: NestFactory.create + listen
├── app.module.ts                     ← корневой модуль: импорты + global middleware
├── config/env.ts                     (без изменений)
├── db/                               (без изменений)
├── lib/
│   ├── guards/                       Nest Guards (заменяют auth-middleware)
│   │   ├── jwt-auth.guard.ts
│   │   ├── optional-jwt-auth.guard.ts
│   │   ├── basic-auth.guard.ts
│   │   ├── refresh-session.guard.ts
│   │   ├── super-admin.guard.ts
│   │   └── auth-rate-limit.guard.ts
│   ├── middleware/                   Nest-style middleware-классы
│   │   ├── request-id.middleware.ts
│   │   └── request-logger.middleware.ts
│   ├── pipes/                        Zod-валидация
│   │   ├── zod-body.pipe.ts
│   │   └── zod-query.pipe.ts
│   ├── openapi-schemas/              общие схемы для OpenAPI
│   ├── http-error.filter.ts          Exception Filter
│   ├── http-error.filter.test.ts
│   ├── errors.ts, logger.ts, ...     (без изменений)
├── modules/                          ← фичи (одна папка = одна фича)
│   ├── auth/
│   │   ├── auth.controller.ts
│   │   ├── auth.controller.test.ts
│   │   ├── auth.service.ts
│   │   ├── auth.module.ts
│   │   └── auth.openapi.ts
│   ├── blogs/         (та же 5-файловая структура)
│   ├── comments/      (+ comments.likes.service.test.ts)
│   ├── posts/         (+ posts.likes.service.test.ts)
│   ├── users/
│   ├── security/
│   ├── health/
│   ├── testing/
│   ├── videos/
│   └── docs/                         (Swagger UI как Nest-controller)
└── test/
    └── create-test-app.ts            ← единственный тест-хелпер
```

**Удалено целиком**: `app.ts`, `bootstrap.ts`, `routes/`, `controllers/`, `middleware/`, `services/`. Все 9 фич живут в `modules/<feature>/` по единой схеме.

---

## 4. Жизнь запроса в новом мире

`GET /api/blogs?pageNumber=1` — что происходит по шагам:

```
HTTP-запрос
  ↓
[Express http-server, который Nest хостит внутри себя]
  ↓
[helmet, compression, cookieParser, json body-parser]      ← глобально через nestApp.use(...)
  ↓
[RequestIdMiddleware]    ← Nest middleware из AppModule.configure()
  ↓
[RequestLoggerMiddleware]
  ↓
[Nest Router] решает: «ага, это BlogsController.listBlogs»
  ↓
[Guards на ручке] (если есть) — проверяют, можно ли пускать
  ↓
[Pipes на параметрах] — @Query(new ZodQueryPipe(...)) парсит req.query
  ↓
[BlogsController.listBlogs(query)] вызывается с уже валидным query
  ↓
return this.blogsService.getAllBlogs(query)
  ↓
[Nest сериализует возвращённое значение в JSON и шлёт ответ]
```

Если на любом шаге кто-то бросил исключение → попадает в **HttpErrorFilter**, который мапит его в JSON-ответ с `requestId`.

Сравни с Express-mental-model: `app.use(mw1); app.use(mw2); router.get('/', mw3, mw4, handler)` — там цепочка вручную, и легко промахнуться (например, повесить логгер после auth, и неавторизованные запросы не залогируются). В Nest порядок приоритетов жёсткий и описан выше.

---

## 5. Bootstrap (`apps/api/src/index.ts`)

```ts
const nestApp = await NestFactory.create<NestExpressApplication>(AppModule, {
  bodyParser: false,
  logger: false,
})

nestApp.useBodyParser('json', { limit: '1mb' })
nestApp.use(helmet())
nestApp.use(compression())
nestApp.use(cookieParser())
nestApp.enableCors({ credentials: true, origin: ... })
nestApp.useGlobalFilters(new HttpErrorFilter())
nestApp.enableShutdownHooks()

await nestApp.listen(env.port)
```

Что происходит:

1. **`NestFactory.create(AppModule)`** — Nest читает дерево модулей (от `AppModule` рекурсивно через `imports`), собирает **DI-граф**: каждый `@Injectable()`-провайдер инстанцируется один раз, и его зависимости (другие провайдеры) подкладываются через конструктор.
2. **`bodyParser: false`** — отключаем дефолтный body-parser Nest, чтобы потом включить вручную через `useBodyParser` с нашими лимитами.
3. **`logger: false`** — отключаем встроенный Nest logger в пользу нашего pino через `lib/logger.ts`.
4. **`nestApp.use(...)`** — Nest проксирует это в Express-app внутри себя. Так подключаем helmet, compression, cookieParser и body-parser.
5. **`useGlobalFilters(...)`** — регистрируем exception filter глобально. Любая ошибка в любом контроллере/сервисе попадёт сюда.
6. **`enableShutdownHooks()`** — Nest подписывается на SIGINT/SIGTERM и при сигнале вызовет `OnModuleDestroy`/`OnApplicationShutdown` у всех providers. **FE-аналогия**: `useEffect`'s cleanup function на unmount.
7. **`listen(env.port)`** — реально запускает HTTP-сервер.

Graceful shutdown в `index.ts` оставлен с явным таймаутом (10 сек), потому что `enableShutdownHooks()` сам по себе не гарантирует force-exit при зависании.

---

## 6. AppModule (`apps/api/src/app.module.ts`)

```ts
@Module({
  imports: [
    HealthModule,
    AuthModule,
    BlogsModule,
    CommentsModule,
    PostsModule,
    SecurityModule,
    UsersModule,
    VideosModule,
    ...(env.enableSwagger ? [DocsModule] : []),
    ...(env.nodeEnv !== "production" || env.enableTestingEndpoints ? [TestingModule] : []),
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware, RequestLoggerMiddleware).forRoutes("*splat");
  }
}
```

### Что делает `@Module({...})`

Это **декларация DI-границ**. Внутри модуля живут свои `providers` и `controllers`. Они автоматически видят друг друга. Чтобы провайдер из модуля A был виден модулю B, модуль A должен:

- иметь его в `providers`
- ДОБАВИТЬ его в `exports: [...]`
- модуль B должен `imports: [ModuleA]`

В нашей миграции этого пока нет, потому что фичи не зависят друг от друга на уровне сервисов (зависят только через репозитории, которые отдельный слой).

**FE-аналогия**: модуль ≈ React Context Provider. `providers` ≈ значения, которые провайдер кладёт в контекст. `imports: [OtherModule]` ≈ обернуть свой компонент в `<OtherProvider>`, чтобы получить доступ к его контексту.

### `configure(consumer)`

Единственное место, где навешиваются глобальные middleware-классы. `forRoutes('*splat')` = «применить ко всем путям». `*splat` — синтаксис именованного wildcard'а в path-to-regexp v6 (используется Express 5 / Nest 11). В старых версиях было просто `'*'`, теперь без имени wildcards не парсятся.

### Условные импорты

```ts
...(env.enableSwagger ? [DocsModule] : [])
```

В отличие от Express, где было `if (env.enableSwagger) app.use('/api/docs', ...)`, в Nest условность вынесена на уровень модулей. Чище: если `enableSwagger=false`, `DocsController` вообще не существует в DI-графе и не получает роут.

---

## 7. Feature module — анатомия

Возьмём `apps/api/src/modules/blogs/`:

```
blogs.module.ts          @Module — декларация DI-границ
blogs.controller.ts      HTTP-эндпоинты
blogs.controller.test.ts тесты через TestingModule + supertest
blogs.service.ts         бизнес-логика
blogs.openapi.ts         registerPaths(...) для Swagger
```

### `blogs.module.ts`

```ts
@Module({
  controllers: [BlogsController],
  providers: [BlogsService],
})
export class BlogsModule {}

registerBlogsOpenApi();
```

- **`controllers`** — классы с роутами. Nest автоматически регистрирует их пути в роутере при старте.
- **`providers`** — всё инжектируемое. По умолчанию — singleton на модуль.
- **`registerBlogsOpenApi()`** — top-level вызов в момент импорта модуля. Регистрирует пути в общем OpenAPI registry, который потом отдаёт `DocsController`.

### `blogs.service.ts`

```ts
@Injectable()
export class BlogsService {
  async getAllBlogs(query: BlogQuery): Promise<Page<BlogVM>> {
    const { items, totalCount } = await blogsRepository.find(query)
    return { items: items.map(toBlogVM), totalCount, ... }
  }
}
```

`@Injectable()` — единственный декоратор, делающий класс «известным» DI-контейнеру. Сервисы:

- НЕ знают о HTTP (`req`/`res` не существует)
- НЕ зависят от Nest за пределами `@Injectable()`
- Тестируются как обычные классы
- Завтра можно бросить эти же сервисы в очередь / CLI / cron — они работают

Это и есть «слои не смешивать» из CLAUDE.md, выраженное на уровне Nest.

### `blogs.controller.ts`

```ts
@Controller("api/blogs")
export class BlogsController {
  constructor(private readonly blogsService: BlogsService) {}

  @Get()
  listBlogs(@Query(new ZodQueryPipe(BlogQuerySchema)) query: BlogQuery) {
    return this.blogsService.getAllBlogs(query);
  }

  @Get(":id")
  getBlog(@Param("id") id: string) {
    return this.blogsService.getBlogById(id);
  }

  @UseGuards(BasicAuthGuard)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  createBlog(@Body(new ZodBodyPipe(CreateBlogSchema)) body: CreateBlogInput) {
    return this.blogsService.createBlog(body);
  }
}
```

Контроллер — тонкий: `parse → service.call → return`. Никакой бизнес-логики, никакого Mongoose, никакого Express.

`return ...` — Nest сам сериализует возвращённое значение в JSON и шлёт `200 OK` (или указанный `@HttpCode`). Никаких `res.json(...)` руками.

---

## 8. Декораторы — справочник

| Декоратор                                           | Где          | Что делает                                                      |
| --------------------------------------------------- | ------------ | --------------------------------------------------------------- |
| `@Module({...})`                                    | class        | Декларирует DI-границу                                          |
| `@Injectable()`                                     | class        | Регистрирует класс как provider (инжектируемый)                 |
| `@Controller(prefix)`                               | class        | Регистрирует HTTP-handler с префиксом пути                      |
| `@Get(path?)`, `@Post`, `@Put`, `@Delete`, `@Patch` | method       | HTTP-метод + путь относительно префикса                         |
| `@HttpCode(status)`                                 | method       | Кастомный success-статус (по умолчанию POST=201, остальные=200) |
| `@Body(pipe?)`                                      | param        | Извлечь `req.body`, опционально пропустить через pipe           |
| `@Query(key?, pipe?)`                               | param        | Извлечь `req.query` (или конкретный ключ)                       |
| `@Param(key, pipe?)`                                | param        | Извлечь `req.params[key]`                                       |
| `@Headers(key?)`                                    | param        | Извлечь header'ы                                                |
| `@Req()`, `@Res()`                                  | param        | Raw request/response (избегаем — пусть Nest сам шлёт ответ)     |
| `@UseGuards(...)`                                   | class/method | Прикрутить guard'ы                                              |
| `@UseInterceptors(...)`                             | class/method | Прикрутить interceptor'ы                                        |
| `@UseFilters(...)`                                  | class/method | Прикрутить exception filter'ы локально                          |
| `@Catch(ErrorClass?)`                               | class        | Регистрирует exception filter                                   |

**Как декораторы вообще работают.** Это TC39-фича + поддержка TypeScript. Декоратор — это **функция, которая получает класс/метод/параметр и пишет на него метаданные через `Reflect.defineMetadata(...)`**. При старте Nest читает эти метаданные через `Reflect.getMetadata(...)` и собирает по ним роутер, DI-граф, цепочки guard'ов и т.д.

Чтобы это работало, в `tsconfig.json` должно быть:

```json
{
  "experimentalDecorators": true,
  "emitDecoratorMetadata": true
}
```

И импортирован `reflect-metadata` (у нас в `index.ts` он подтягивается через NestFactory).

---

## 9. Guards — авторизация и ACL

Guard отвечает на вопрос: «можно ли пускать запрос дальше?». Возвращает `boolean | Promise<boolean> | Observable<boolean>`. Если `false` — Nest бросает `ForbiddenException`. У нас guards **бросают свои `HttpError`-подклассы**, которые ловит `HttpErrorFilter`.

```ts
@Injectable()
export class JwtAuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>()
    const token = extractBearer(request.headers.authorization)
    if (!token) throw new UnauthorizedError()
    const payload = await verifyAccessToken(token)
    request.user = { id: payload.userId, login: payload.login, ... }
    return true
  }
}
```

### `ExecutionContext`

Абстракция над разными протоколами (HTTP, WebSocket, gRPC). У нас всегда HTTP, поэтому `context.switchToHttp().getRequest()` — это и есть Express `Request`. Преимущество абстракции: тот же guard завтра сработает и на WS gateway, без переписывания.

### Применение

```ts
// На метод
@UseGuards(JwtAuthGuard)
@Get('me')
getMe(@Req() req: Request) { return req.user }

// На весь контроллер
@UseGuards(BasicAuthGuard)
@Controller('api/users')
export class UsersController { ... }

// Глобально
nestApp.useGlobalGuards(new SomeGuard())
```

У нас глобальных guard'ов нет — разные роуты требуют разной защиты, поэтому навешиваем точечно.

### Наши 6 guards

| Guard                  | Что делает                                       | Заменил Express middleware   |
| ---------------------- | ------------------------------------------------ | ---------------------------- |
| `JwtAuthGuard`         | Требует валидный access token, кладёт user в req | `require-auth.ts`            |
| `OptionalJwtAuthGuard` | Не бросает; кладёт user, если есть токен         | `optional-auth.ts`           |
| `BasicAuthGuard`       | HTTP Basic для legacy admin flow                 | `require-admin-auth.ts`      |
| `RefreshSessionGuard`  | Валидирует refreshToken cookie + sessionId       | `require-refresh-session.ts` |
| `SuperAdminGuard`      | После JwtAuthGuard — проверяет роль              | `require-super-admin.ts`     |
| `AuthRateLimitGuard`   | In-memory rate-limiter на login/registration     | `auth-rate-limit.ts`         |

### Чем guard лучше middleware

Express middleware ничего не знает о ручке — он видит только `req/res/next`. Guard через `context.getHandler()`/`getClass()` + `Reflector` может **читать декораторы на ручке**:

```ts
@Public()  // кастомный декоратор
@Get('public-endpoint')

// в guard:
const isPublic = this.reflector.get<boolean>('isPublic', context.getHandler())
if (isPublic) return true
```

Это позволяет писать «глобальный JwtAuthGuard, который пропускает помеченные `@Public()` ручки» — недостижимо в чистом Express без отдельного списка whitelisted-путей.

---

## 10. Pipes — валидация и трансформация

Pipe = «преобразовать или провалидировать значение перед передачей в handler».

```ts
export class ZodBodyPipe<T> implements PipeTransform<unknown, T> {
  constructor(private schema: ZodSchema<T>) {}
  transform(value: unknown): T {
    return this.schema.parse(value);
  }
}
```

`schema.parse(...)` либо вернёт типизированный объект, либо бросит `ZodError`, который `HttpErrorFilter` отобразит как 422 с массивом `errorsMessages`. Это и есть «Zod на границе» из CLAUDE.md, выраженное в Nest-стиле.

### Применение

```ts
@Post()
createBlog(@Body(new ZodBodyPipe(CreateBlogSchema)) body: CreateBlogInput) { ... }

@Get()
listBlogs(@Query(new ZodQueryPipe(BlogQuerySchema)) query: BlogQuery) { ... }

@Get(':id')
getBlog(@Param('id') id: string) { ... }     // без pipe — id остаётся string
```

У нас два pipe'а: `ZodBodyPipe` и `ZodQueryPipe`. `Param` обычно валидируется внутри service (для Mongo ObjectID — там же мы должны бросить 404 на невалидный id, что естественнее в сервисе).

### Когда что выбирать

| Хочу…                                         | Использовать                                         |
| --------------------------------------------- | ---------------------------------------------------- |
| Валидировать всё body                         | `@Body(new ZodBodyPipe(...))`                        |
| Валидировать всю query-строку                 | `@Query(new ZodQueryPipe(...))`                      |
| Преобразовать `:id` в число и провалидировать | `@Param('id', new ParseIntPipe())` (встроенный Nest) |
| Кастомная трансформация                       | свой `PipeTransform`                                 |

---

## 11. Middleware — глобальные кросс-каттинги

Это **Express-style middleware**, обёрнутая в Nest-класс с интерфейсом:

```ts
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const id = req.header("x-request-id") ?? randomUUID();
    req.requestId = id;
    res.setHeader("x-request-id", id);
    next();
  }
}
```

Применяется в `AppModule.configure(consumer)`.

### Когда middleware, когда guard, когда pipe?

| Задача                                   | Что использовать             |
| ---------------------------------------- | ---------------------------- |
| Назначить `req.requestId` всем запросам  | **Middleware**               |
| Залогировать каждый запрос               | **Middleware**               |
| Спарсить body                            | **Middleware** (body-parser) |
| Проверить авторизацию                    | **Guard**                    |
| Провалидировать входной DTO              | **Pipe**                     |
| Засечь время handler'а                   | **Interceptor**              |
| Замапить ответ на унифицированный формат | **Interceptor**              |
| Поймать ошибку и отдать как HTTP-ответ   | **Exception Filter**         |

Иерархия исполнения:

```
Middleware → Guards → Interceptors (pre) → Pipes → Handler → Interceptors (post) → Exception Filter (если throw)
```

---

## 12. Exception Filter — централизованная обработка ошибок

```ts
@Catch()
export class HttpErrorFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const res = ctx.getResponse<Response>()
    const req = ctx.getRequest<Request>()

    if (exception instanceof HttpError) { ... }
    else if (exception instanceof ZodError) { ... }
    else if (exception instanceof mongoose.Error.CastError) { ... }
    else if (exception instanceof HttpException) { ... }   // 404 от Nest
    else { /* 500 — неизвестная */ }

    res.status(status).json({ ..., requestId: req.requestId })
  }
}
```

`@Catch()` без аргументов = ловит абсолютно всё. Можно сузить: `@Catch(HttpError, ZodError)` — тогда только эти. У нас один глобальный filter, он внутри различает типы.

**FE-аналогия**: это как `<ErrorBoundary>` в React, обёртывающий всё приложение и показывающий разный UI в зависимости от типа ошибки.

### Что он покрывает

- `HttpError` (наши `NotFoundError`, `BadRequestError`, `UnauthorizedError`, ...) → их кастомный JSON
- `ZodError` → 422 с массивом `{ field, message }`
- mongoose `CastError` (например, кривой ObjectID в `:id`) → 404
- `HttpException` от Nest (например, дефолтный 404 на несуществующий путь) → пробрасывается с кодом
- body-parser errors (некорректный JSON) → 400
- всё остальное → 500 с requestId

---

## 13. DI на пальцах — как Nest решает, что инжектить

```ts
@Injectable()
export class BlogsService {
  constructor(private blogsRepository: BlogsRepository) {}
}
```

Шаги:

1. TS компилятор видит `@Injectable()` и `emitDecoratorMetadata: true` в `tsconfig`. Он **записывает в metadata типы параметров конструктора**: `design:paramtypes = [BlogsRepository]`.
2. Nest при инстанцировании читает метадату через `Reflect.getMetadata('design:paramtypes', BlogsService)` → получает массив `[BlogsRepository]`.
3. Идёт в DI-контейнер модуля и спрашивает: «дай мне `BlogsRepository`».
4. Если `BlogsRepository` зарегистрирован в `providers` этого модуля или импортированного → достаёт singleton.
5. Если нет → выбрасывает `Nest can't resolve dependencies of BlogsService (?). Please make sure that...`

> **Это объясняет, почему `tsx watch` ломал DI до миграции.** esbuild (которым tsx транспилирует) **не эмитит `design:paramtypes`**. Без них Nest получает `undefined` вместо типов и не может ничего инжектить — `this.blogsService` оказывается `undefined`. Симптом: `TypeError: Cannot read properties of undefined (reading 'getAllBlogs')` на любом эндпоинте.
>
> Лечение — `@swc-node/register`: SWC уважает `emitDecoratorMetadata`. Поэтому dev-скрипт теперь:
>
> ```
> node --import @swc-node/register/esm-register --watch src/index.ts
> ```
>
> Vitest этой проблемой не страдает, потому что Vite/esbuild для тестов настроен так, чтобы метадату эмитить (через специальный transformer).

### FE-аналогия

DI = `useContext`, но **типизированный через TypeScript**. Когда ты пишешь `const queryClient = useContext(QueryClientContext)` — React по runtime ищет ближайший провайдер. В Nest то же самое, только «провайдер» определяется типом параметра в конструкторе, а не строковым ключом. Это сильно лучше: компилятор сам проверяет, что зависимость существует.

---

## 14. Тесты (`apps/api/src/test/create-test-app.ts`)

### Хелпер

```ts
export async function createTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();
  app.useBodyParser("json", { limit: "1mb" });
  app.use(cookieParser());
  app.useGlobalFilters(new HttpErrorFilter());
  await app.init();
  return app;
}
```

`Test.createTestingModule(...)` поднимает тот же DI-граф, что в проде, но **без `listen()`**. Можно передавать в supertest через `app.getHttpServer()`.

### Использование

```ts
describe('GET /api/blogs', () => {
  let app: INestApplication
  beforeAll(async () => { app = await createTestApp() })
  afterAll(async () => { await app.close() })

  it('returns paginated blogs', async () => {
    const res = await request(app.getHttpServer()).get('/api/blogs').expect(200)
    expect(res.body.items).toEqual(...)
  })
})
```

### Override providers

Главная фишка `Test.createTestingModule`:

```ts
const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
  .overrideProvider(MailerService)
  .useValue(fakeMailer)
  .compile();
```

Вместо `vi.mock(...)` ты переопределяешь зависимость на уровне DI-контейнера. Чище и типобезопаснее.

---

## 15. OpenAPI / Swagger

Каждая фича имеет свой `<feature>.openapi.ts`:

```ts
// apps/api/src/modules/blogs/blogs.openapi.ts
export function registerBlogsOpenApi() {
  registerPaths({
    '/api/blogs': { get: { ... }, post: { ... } },
    '/api/blogs/{id}': { get: { ... }, put: { ... }, delete: { ... } },
  })
}
```

Вызывается top-level в `<feature>.module.ts`:

```ts
@Module({...})
export class BlogsModule {}
registerBlogsOpenApi()
```

При старте все вызовы `registerPaths(...)` накапливаются в общем in-memory registry в `lib/openapi.ts`. `DocsController` отдаёт его как JSON по `/api/docs/json` и Swagger UI HTML по `/api/docs`.

> **Альтернатива, которой мы НЕ пользуемся**: `@nestjs/swagger` с декораторами `@ApiTags`, `@ApiOperation`, `@ApiResponse`. Не используем по двум причинам:
>
> 1. У нас уже работает `zod-openapi` пакет, и Zod-схемы — single source of truth (правило «Zod на каждой границе»).
> 2. `@nestjs/swagger` навязывает дубликат: ApiResponse-декоратор + DTO-класс + class-validator. У нас Zod это всё уже даёт.

---

## 16. Главные ловушки этой миграции

### 1. `tsx watch` несовместим с Nest DI

**Симптом**: `TypeError: Cannot read properties of undefined (reading '<метод сервиса>')` на любом эндпоинте.

**Причина**: tsx использует esbuild, который не эмитит `design:paramtypes` метадату. Nest получает `undefined` вместо типов конструктора и не может ничего инжектить.

**Лечение**: переключить dev-скрипт на `@swc-node/register`:

```json
"dev": "node --import @swc-node/register/esm-register --watch src/index.ts"
```

Vitest от этого не страдает — там отдельный transform-pipeline.

### 2. `forRoutes('*splat')` вместо `forRoutes('*')`

**Причина**: Nest 11 + Express 5 + path-to-regexp v6 требуют **именованный** wildcard. Старый синтаксис `'*'` бросает `Missing parameter name at 1`.

**Лечение**: `consumer.apply(...).forRoutes('*splat')` — `splat` это просто имя параметра, можно любое.

### 3. Порядок методов в контроллере = порядок маршрутизации

```ts
@Get(':id')
getBlog(@Param('id') id: string) { ... }

@Get('lookup')   // ❌ не сработает: попадёт в getBlog с id="lookup"
listLookup() { ... }
```

Правильно:

```ts
@Get('lookup')   // ✅ конкретные пути сначала
listLookup() { ... }

@Get(':id')      // динамические — после
getBlog(@Param('id') id: string) { ... }
```

Из-за этого мы выключили `perfectionist/sort-classes` для `modules/**/*.controller.ts` — иначе линтер хочет алфавитного порядка методов, и порядок маршрутов сломается.

### 4. `useBodyParser('json', ...)` вместо `import { json } from 'express'`

Правильный Nest-API. Не требует прямого импорта Express, не светит зависимостью на платформу. На Fastify-платформе тот же вызов будет работать.

### 5. Условные модули

Express:

```ts
if (env.enableSwagger) app.use("/api/docs", docsRouter);
```

Nest:

```ts
@Module({
  imports: [
    ...(env.enableSwagger ? [DocsModule] : []),
  ],
})
```

Иначе `DocsController` всегда будет в DI-графе и нарушит «вообще не существует, если флаг выключен».

---

## 17. Что ещё стоит знать (на будущее)

### Interceptors

Не использовали в миграции, но стоит знать. Это обёртка вокруг handler'а — может смотреть на input, на output, замерять время:

```ts
@Injectable()
export class TimingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const start = Date.now();
    return next
      .handle()
      .pipe(tap(() => log.info({ duration: Date.now() - start }, "request handled")));
  }
}
```

Применяется так же, как guard: `@UseInterceptors(TimingInterceptor)` или глобально.

### Custom decorators через `Reflector`

Можно завести свои декораторы для метаданных и читать их в guard'ах:

```ts
export const Public = () => SetMetadata("isPublic", true);

// в guard:
const isPublic = this.reflector.get<boolean>("isPublic", context.getHandler());
```

Это путь к «глобальный JwtAuthGuard, пропускающий помеченные `@Public()` роуты».

### Lifecycle hooks

- `OnModuleInit` — после того как DI-контейнер собрался (но до `listen`)
- `OnModuleDestroy` — при shutdown
- `OnApplicationBootstrap` — после полного старта (после `listen`)
- `OnApplicationShutdown(signal?)` — при shutdown с указанием сигнала

Используются для подключений к внешним системам (DB, очереди), которые надо корректно закрыть.

### Phase 2 (NestJS + Postgres) — что изменится

Чисто архитектурно — ничего радикального:

- `db/repositories/` останутся, но переедут на TypeORM/Prisma/Drizzle
- Сервисы получат инъекцию репозитория через DI (а не прямой import)
- Mongoose-схемы заменятся на ORM-сущности
- Контроллеры, guards, pipes, filters — **не меняются**

Это и было главной целью «layered architecture is sacred» из CLAUDE.md: phase 1 готовил почву так, чтобы phase 2 был механической заменой data-слоя, а не переписыванием всего.

---

## 18. Краткий чек-лист «как добавить новый эндпоинт в Nest-эре»

1. Добавить request/response типы в `packages/shared/src/index.ts`
2. Добавить Mongoose model в `apps/api/src/db/models/<feature>.model.ts` (если новая сущность)
3. Создать папку `apps/api/src/modules/<feature>/`:
   - `<feature>.service.ts` с `@Injectable()`
   - `<feature>.controller.ts` с `@Controller('api/<feature>')`
   - `<feature>.module.ts` с `@Module({ controllers, providers })`
   - `<feature>.openapi.ts` с `registerPaths(...)`
4. Импортировать `<Feature>Module` в `app.module.ts`
5. Тесты в `<feature>.controller.test.ts` через `createTestApp()` + supertest
6. FE использует через `fetch('/api/<feature>')` с типами из `@app/shared`

---

## Приложение: команды

```bash
pnpm dev:api               # запуск с hot-reload (через @swc-node/register)
pnpm typecheck             # TS strict
pnpm lint                  # ESLint
pnpm test                  # Vitest
pnpm knip                  # dead code

curl -i http://localhost:4000/api/health        # должно быть 200 + x-request-id
open http://localhost:4000/api/docs             # Swagger UI (если ENABLE_SWAGGER=true)
```
