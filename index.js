var moment = require('moment');

var ONE_HOUR = 60 * 60 * 1000;
var TIMEZONE_OFFSET = -540;

function priorityReducer(previousValue, currentValue) {
	return !previousValue ||
			!previousValue.hasOwnProperty('priority') ||
			previousValue.priority < currentValue.priority ? currentValue : previousValue;
}

function ScheduledResource(resource, schedule, now) {
	now = now || function () { return Date.now(); };

	var cache = {
		slots: {},
		validAfter: 0,
		validUntil: 0
	};

	this.cache = cache;

	function isEntryActive(entry, scheduleTime, timestamp) {
		var activeAfter = Math.max(entry.start || 0, scheduleTime) * 1000;
		var activeUntil = Math.min(entry.end || Infinity, scheduleTime + (entry.duration || 1) * 60 * 60) * 1000;

		return timestamp >= activeAfter && timestamp < activeUntil;
	}

	function getActive(timestamp) {
		timestamp = timestamp || now();

		if (timestamp >= cache.validAfter && timestamp < cache.validUntil) {
			return cache.slots;
		}

		cache.slots = {};
		cache.validAfter = timestamp - timestamp % ONE_HOUR;
		cache.validUntil = cache.validAfter + ONE_HOUR;

		var currentTime = moment(timestamp).zone(TIMEZONE_OFFSET);

		var week = currentTime.format('W');

		for (var dayId in schedule) {
			var day = dayId === '*' ? currentTime.format('E') : dayId;

			for (var hourId in schedule[dayId]) {
				var hour = hourId === '*' ? currentTime.format('H') : hourId;

				var scheduleTime = moment(week + '/' + hour + ' +0900', 'W/H Z').zone(TIMEZONE_OFFSET).add(parseInt(day, 10) - 1, 'days').unix();

				for (var slotId in schedule[dayId][hourId]) {
					if (!cache.slots[slotId]) {
						cache.slots[slotId] = [];
					}

					var entries = schedule[dayId][hourId][slotId];

					for (var i = 0; i < entries.length; i += 1) {
						var entry = entries[i];

						if (isEntryActive(entry, scheduleTime, currentTime.unix() * 1000)) {
							cache.slots[slotId].push({ resource: resource[entry.resourceId], priority: entry.priority });
						}
					}
				}
			}
		}

		return cache.slots;
	}

	this.get = function (slotId, timestamp) {
		var slots = getActive(timestamp);

		if (slotId) {
			if (!slots[slotId] || !slots[slotId].length) {
				return;
			}

			return slots[slotId].reduce(priorityReducer).resource;
		}

		return slots;
	};

	this.getList = function (timestamp) {
		var slots = getActive(timestamp);

		var out = [];

		var slotIds = Object.keys(slots);

		for (var i = 0; i < slotIds.length; i += 1) {
			var slotId = slotIds[i];
			if (slots[slotId].length) {
				out.push(slots[slotId].reduce(priorityReducer).resource);
			}
		}

		return out;
	};

	this.getNextUpdate = function (timestamp) {
		timestamp = timestamp || now();
		return timestamp + ONE_HOUR - timestamp % ONE_HOUR;
	};
}

module.exports = ScheduledResource;
