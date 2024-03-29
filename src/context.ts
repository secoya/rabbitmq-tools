import { ConnectionManager, ConnectionOptions } from './ConnectionManager.js';
import { Message } from './Consumer.js';
import { Publisher } from './Publisher.js';
import type { Span } from '@opentelemetry/api';
import { ContextCreator } from '@secoya/context-helpers/assignment.js';
import { FullLogContext, LogContext, RootLogContext } from '@secoya/context-helpers/log.js';
import { ServiceNameContext } from '@secoya/context-helpers/servicename.js';
import { ShutdownHandlingContext } from '@secoya/context-helpers/shutdown.js';
import {
	buildSpanOptions,
	createSpan,
	isTraceContext,
	isTracerContext,
	SpanContext,
	SpanOptions,
	traceFn,
	TracerContext,
	extractSpan,
} from '@secoya/context-helpers/trace.js';
import { MaybeContext } from '@secoya/context-helpers/utils.js';
import type amqplib from 'amqplib';

export interface RabbitMQContext {
	readonly rabbitmq: ConnectionManager;
}

export interface RabbitMQOptions extends Partial<ConnectionOptions> {
	clientProperties?: { capabilities: { connection_name: undefined } };
}

export interface RabbitMQConsumerWrapperContext<Context> {
	readonly wrapRabbitMQConsumer: RabbitMQConsumerWrapper<Context>;
}

export interface RabbitMQPublisherWrapperContext {
	readonly wrapRabbitMQPublisher: RabbitMQPublisherWrapper;
}

export function setupRabbitMQContext(
	{ log, rootLog, serviceName, shutdown }: ServiceNameContext & ShutdownHandlingContext & RootLogContext & LogContext,
	options: RabbitMQOptions = {},
): RabbitMQContext {
	log.verbose('connect to rabbitmq');
	const rabbitmq = new ConnectionManager({
		hostname: options.hostname ?? process.env.RABBITMQ_HOST,
		port: options.port ?? (process.env.RABBITMQ_PORT ? Number(process.env.RABBITMQ_PORT) : undefined),
		username: options.username ?? process.env.RABBITMQ_USER,
		password: options.password ?? process.env.RABBITMQ_PASSWORD,
		vhost: options.vhost ?? process.env.RABBITMQ_VHOST,
		clientProperties: {
			connection_name: serviceName,
		},
	});
	shutdown.handlers.append('close rabbitmq connection', () => rabbitmq.close.bind(rabbitmq));
	rabbitmq.onDisconnected((err) => {
		if (err) {
			rootLog.error(err);
		}
	});
	return { rabbitmq };
}

export type RabbitMQConsumerWrapper<Context> = {
	(fn: (runtimeContext: Context, message: Message) => any): (message: Message) => ReturnType<typeof fn>;
	(spanOptionsOrFn: string | Pick<SpanOptions, 'name'>, fn: (runtimeContext: Context, message: Message) => any): (
		message: Message,
	) => ReturnType<typeof fn>;
};

export function createRabbitMQConsumerWrapper<Destination extends FullLogContext<any>>(
	source: MaybeContext<TracerContext>,
	_destination: unknown,
	destinationCreator: ContextCreator<Destination>,
): { wrapRabbitMQConsumer: RabbitMQConsumerWrapper<Destination> } {
	return {
		wrapRabbitMQConsumer: (<F extends (runtimeContext: Destination, message: Message) => any>(
			spanOptionsOrFn: F | string | Pick<SpanOptions, 'name'>,
			fn?: F,
		) => {
			return (message: Message) => {
				const [_spanOptions, _fn] = buildSpanOptions(spanOptionsOrFn, fn);
				if (isTracerContext(source)) {
					const { tracer } = source;
					let span: Span;
					const parentSpan = extractSpan(message.message.properties.headers);
					if (parentSpan) {
						span = createSpan(tracer, { ..._spanOptions, relation: 'follow' }, parentSpan.spanContext());
					} else {
						span = createSpan(tracer, { ..._spanOptions, relation: 'new' });
					}
					span.setAttributes({
						'initiator.transport': 'rabbitmq',
						'initiator.method': 'wrapRabbitMQConsumer',
					});
					const { containErrors } = destinationCreator({ span });
					return containErrors(_spanOptions.name, (dst) => traceFn(span, _fn, dst, message));
				} else {
					const { containErrors } = destinationCreator({});
					return containErrors(_spanOptions.name, (dst) => _fn(dst, message));
				}
			};
		}) as RabbitMQConsumerWrapper<Destination>,
	};
}

export type RabbitMQPublisherWrapper = (publisher: Publisher) => Publisher;

type PublishingOptions = Omit<amqplib.Options.Publish, 'persistent'>;
export function createRabbitMQPublisherWrapper(
	_source: unknown,
	destination: MaybeContext<SpanContext>,

	_contextCreator: unknown,
): { wrapRabbitMQPublisher: RabbitMQPublisherWrapper } {
	return {
		wrapRabbitMQPublisher: (publisher: Publisher) => {
			const wrappedPublisher = (msg: Buffer, options: PublishingOptions = {}, timeout?: number) => {
				if (isTraceContext(destination)) {
					const { extendWithSpanId } = destination;
					options.headers = extendWithSpanId(options.headers ?? {});
					return publisher(msg, options, timeout);
				} else {
					return publisher(msg, options, timeout);
				}
			};
			wrappedPublisher.closePublisher = publisher.closePublisher;
			return wrappedPublisher;
		},
	};
}

export function isRabbitMQContext(obj: any): obj is RabbitMQContext {
	if (!obj.rabbitmq) {
		return false;
	}
	if (typeof obj.rabbitmq.addQueueTopology !== 'function') {
		return false;
	}
	return true;
}
