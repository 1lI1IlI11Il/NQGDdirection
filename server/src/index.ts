import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { marketRoutes } from './routes/market.ts'

const app = new Hono()

app.use('*', cors({ origin: 'http://localhost:5173' }))
app.route('/api/market', marketRoutes)

app.get('/health', (c) => c.json({ ok: true }))

serve({ fetch: app.fetch, port: 3001 }, () => {
  console.log('Market Compass API running on http://localhost:3001')
})
