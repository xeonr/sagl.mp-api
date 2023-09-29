import * as Sentry from "@sentry/node";
import { SentrySpanProcessor, SentryPropagator } from '@sentry/opentelemetry-node';
import * as opentelemetry from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';

Sentry.init({
	dsn: 'https://8fe03676e272550898d41445f1ca9680@broken.prod.wtf/3',
	tracesSampleRate: 1,
	instrumenter: 'otel',
	debug: false,
});
const sdk = new opentelemetry.NodeSDK({
	instrumentations: [getNodeAutoInstrumentations({
		'@opentelemetry/instrumentation-fs': {
			enabled: false,
		},
	})],
	spanProcessor: new SentrySpanProcessor(),
	textMapPropagator: new SentryPropagator(),
});

(async () => {
	const imported = await import('./server.js');
	sdk.start();
	await imported.start();
})();
