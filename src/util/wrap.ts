import { ConnectError, Code } from '@connectrpc/connect';

export function wrap<T, Q>(fn: (request: T) => Promise<Q>): (request: T) => Promise<Q> {
	return async (request: T): Promise<Q> => {
		try {
			const resp = await fn(request);

			return resp;
		} catch(e) {
			console.error(e);

			if (e instanceof ConnectError) {
				throw e;
			}


			throw new ConnectError('Internal Server Error', Code.Internal);
		}
	}
}