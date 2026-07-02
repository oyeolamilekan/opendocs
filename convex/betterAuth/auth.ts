import { createAuth } from '../auth'

// Static instance used only by the Better Auth schema generator.
export const auth = createAuth({} as never)
