import { config } from 'dotenv'
import { defineConfig } from 'prisma/config'

// Next.js loads .env.local on its own, but the Prisma CLI does not, so without
// this `prisma migrate` fails with "datasource.url property is required" even
// when .env.local holds a perfectly good DATABASE_URL. Order matches Next's
// precedence: .env.local wins, .env is the fallback.
config({ path: ['.env.local', '.env'] })

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env['DATABASE_URL'],
  },
})
