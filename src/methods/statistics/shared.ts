import { Server } from '../../models';
import { getRecentDataTimestamp } from '../../util/utils';

export async function aggregate<T extends string>(property: string, extra: T[]): Promise<({ key: string; value: number; } & { [key in T]: any })[]> {
	const extraProps: { [key: string]: any } = {};
	for (const e of extra) {
		extraProps[e as any] = { $first: `$${e}` };
	}

	const resp = await Server.aggregate([
		{ $match: { lastUpdatedAt: { $gte: getRecentDataTimestamp() }  } },
		{ $group: { _id: { [property]: `$${property}`, }, ...extraProps, count: { $sum: 1 } } },
		{ $sort: { count: -1 }},
	]);

	return resp.map(val => <any>({
		key: val._id[property],
		value: val.count,
		...extra.reduce((acc, cur) => ({ ...acc, [cur]: val[cur] }), {}),
	}))
}
