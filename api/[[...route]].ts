import { handle } from 'hono/vercel'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { marketRoutes } from '../server/src/routes/market.ts'

const app = new Hono()

app.use('*', cors({ origin: '*' }))
app.route('/api/market', marketRoutes)
app.get('/api/health', (c) => c.json({ ok: true }))

export const config = { runtime: 'edge' }

export default handle(app)
