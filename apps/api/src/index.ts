import { app } from './app.ts'

const PORT = Number(process.env['PORT'] ?? 3001)

app.listen(PORT, () => {
  console.log(`API server listening on port ${PORT}`)
})
