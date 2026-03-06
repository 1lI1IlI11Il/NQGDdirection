import { handle } from 'hono/vercel'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { marketRoutes } from './_lib/market'

const app = new Hono().basePath('/api')

app.use('*', cors({ origin: '*' }))
app.route('/market', marketRoutes)
app.get('/health', (c) => c.json({ ok: true }))

export const config = { runtime: 'edge' }

export default handle(app)
