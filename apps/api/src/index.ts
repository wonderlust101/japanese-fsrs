import { app } from './app.ts'
import { env } from './lib/env.ts'

app.listen(env.PORT, () => {
  console.log(`API server listening on port ${env.PORT}`)
})
