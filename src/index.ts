import 'dotenv/config';

import * as Sentry from "@sentry/node";
import { nodeProfilingIntegration } from '@sentry/profiling-node';
Sentry.init({
	dsn: 'https://8fe03676e272550898d41445f1ca9680@broken.prod.wtf/3',
	tracesSampleRate: 1,
	profilesSampleRate: 1,
	integrations: [
		nodeProfilingIntegration(),
	],
});

(async () => {
	const imported = await import('./server.js');
	await imported.start();
})();
