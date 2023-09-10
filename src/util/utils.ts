import type { Moment } from 'moment';
import moment from 'moment';

export const roundTo30Minutes = (date: Moment): Moment => {
	return moment(date)
		.set('minutes', Math.floor(date.minutes() / 30) * 30)
		.set('seconds', 0)
		.set('milliseconds', 0);
};

export const getRecentDataTimestamp = (): Date => {
	return moment().subtract(1, 'week').toDate();
}