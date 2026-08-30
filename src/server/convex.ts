import { ConvexHttpClient } from 'convex/browser'
import { api } from '../../convex/_generated/api'

export class RequestError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message)
    this.name = 'RequestError'
  }
}

function getBearerToken(request: Request) {
  const authorization = request.headers.get('authorization')
  if (!authorization?.startsWith('Bearer ')) {
    throw new RequestError(401, 'Sign in with Google to access your files.')
  }

  const token = authorization.slice('Bearer '.length).trim()
  if (!token) throw new RequestError(401, 'Your sign-in session is invalid.')
  return token
}

function getConvexUrl(value: string | undefined) {
  const url = value?.trim()
  if (!url) throw new Error('CONVEX_URL is not configured.')
  return url
}

export async function authenticateRequest(request: Request, convexUrl: string | undefined) {
  const token = getBearerToken(request)
  const client = new ConvexHttpClient(getConvexUrl(convexUrl), {
    auth: token,
    logger: false
  })

  try {
    const userId = await client.mutation(api.users.ensureCurrent, {})
    return { client, userId }
  } catch (error) {
    if (error instanceof Error && /Unauthenticated|authentication/i.test(error.message)) {
      throw new RequestError(401, 'Your sign-in session has expired. Sign in again.')
    }
    throw error
  }
}
