# Folio Project Guidelines

## NocoDB Expertise

You are an expert in NocoDB's REST API v2. Always follow these practices when writing code that interacts with NocoDB.

### API Conventions

- Auth: `xc-token` header (NOT query param, NOT `xc-auth`)
- All data endpoints: `/api/v2/tables/{tableId}/records`
- GET single record uses path param: `/records/{rowId}`
- PATCH/DELETE use body params: `{Id: rowId}` posted to `/records` (NOT `/records/{rowId}`)
- Bulk create vs single create: same endpoint, array body vs object body
- Count endpoint: `/api/v2/tables/{tableId}/records/count?where=...`

### Where Clause Syntax

- Basic: `(ColumnName,operator,value)`
- **Date fields use 4-part syntax**: `(dateField,operator,subOperator,value)` where sub-operators include `exactDate`, `today`, `tomorrow`, `yesterday`, `oneWeekAgo`, `oneMonthAgo`, `daysAgo`, `daysFromNow`, etc. Example: `(date,eq,exactDate,2025-01-15)`. The `exactDate` sub-operator matches at day level (ignores time).
- Combine: `(field1,eq,value1)~and(field2,gt,100)` or `~or`
- **NULL checks**: Use `(field,blank)` and `(field,notblank)` -- NEVER use `(field,is,null)` or `(field,isnot,null)` as these are broken in v2 (treats "null" as literal string)
- Operators: `eq`, `neq`, `gt`, `ge`, `lt`, `le`, `like`, `nlike`, `in`, `btw`, `blank`, `notblank`
- **Nested groups bug**: Multiple sequential nested groups fail in v2 parser. Prefix `@` to use v3 parser: `where=@(f1,eq,a)~and((f2,gte,100)~and(f2,lte,200))`
- **Special characters in values**: Commas/parentheses in values break v2 parser. Use `@` prefix with quoted values: `where=@("Name",eq,"Laptop, 15-inch")`
- Sort: `sort=field` (ASC) or `sort=-field` (DESC)
- URL encoding happens automatically via `URLSearchParams.set()`

### Data Types

- Numbers return as JSON numbers or `null`
- Dates: ISO 8601 (`YYYY-MM-DD` or `YYYY-MM-DDTHH:mm:ss.sssZ`), always UTC
- Null is `null`, empty string is `""` (distinct)
- Omitting a field in PATCH leaves it unchanged; setting `null` clears it
- `CreatedAt`/`UpdatedAt` are auto-managed system fields; sending them is silently ignored
- `Id` is auto-incremented, read-only on create, required in body for updates
- Linked record fields return only a count in list responses, not actual data

### Pagination & Query Optimization

- Default page size: 25, max: 1000 (self-hosted). Project uses 200.
- Always use `fields` param to select only needed columns
- Paginate with `limit` + `offset`; check `pageInfo.isLastPage`

### Bulk Operations

- Batch size: 50 records per request (project standard, safe limit)
- Bulk writes to same table: always sequential (parallel causes deadlocks)
- Reads from different tables: safe to parallelize (mind 5 req/s rate limit)
- Bulk writes to different tables: safe to parallelize if each table batches sequentially
- Bulk update: each object MUST include `Id` field
- Bulk delete: body is `[{Id: N}, {Id: N}, ...]`

### Rate Limiting

- Default: 5 requests/second per user, HTTP 429 with 30s retry window
- Be mindful when using `fetchParallel` across many tables simultaneously

### Existing Client

- Custom REST client at `src/lib/nocodb.ts` -- use it, don't bypass it
- `server-only` import prevents client-side token exposure
- Available: `listRecords`, `getAllRecords`, `getRecord`, `createRecord`, `createRecords`, `updateRecord`, `updateRecords`, `deleteRecords`, `fetchParallel`
- Types at `src/lib/types.ts` -- all interfaces end with `Record` suffix
- 8 tables: symbols, transactions, options, deposits, dividends, monthly_snapshots, price_history, settings

### Common Mistakes to Avoid

1. Using `(field,is,null)` instead of `(field,blank)` for null checks
2. Using path param for PATCH: `/records/{id}` -- must use body `{Id: N}`
3. Forgetting `Id` in bulk update payloads
4. Parallel bulk writes to the same table
5. Assuming linked record fields contain actual data (they return counts)
6. Exceeding 5 req/s rate limit with parallel fetches
