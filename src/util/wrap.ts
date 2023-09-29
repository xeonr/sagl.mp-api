import { ConnectError, Code, type HandlerContext } from '@connectrpc/connect';
import * as Sentry from '@sentry/node';

export function wrap<T, Q>(fn: (request: T, handlerContext: HandlerContext) => Promise<Q>): (request: T, handlerContext: HandlerContext) => Promise<Q> {
	return async (request: T, handlerContext: HandlerContext): Promise<Q> => {
		try {
			const resp = await fn(request, handlerContext);

			return resp;
		} catch(e) {
			Sentry.captureException(e);
			console.error(e);

			if (e instanceof ConnectError) {
				throw e;
			}


			throw new ConnectError('Internal Server Error', Code.Internal);
		}
	}
}
