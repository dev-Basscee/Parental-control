'use strict';

/**
 * lib/scheduler.js
 *
 * Evaluates whether a 'scheduled' rule is currently in its block window,
 * using the device's local time.
 *
 * Kept in its own file so it can be unit-tested independently and so
 * agent.js stays focused on I/O.
 */

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

/**
 * Returns true if `now` falls inside the block window defined by `rule`.
 *
 * @param {Object}   rule
 * @param {string[]} rule.schedule_days   e.g. ['mon','tue','wed']
 * @param {string}   rule.schedule_start  "HH:MM" 24-hour local time
 * @param {string}   rule.schedule_end    "HH:MM" 24-hour local time
 * @param {Date}     [now]                injectable for testing; defaults to new Date()
 * @returns {boolean}
 */
function isWithinScheduleWindow(rule, now = new Date()) {
  if (!rule || !rule.schedule_days || !rule.schedule_start || !rule.schedule_end) {
    return false;
  }

  const todayKey = DAY_KEYS[now.getDay()];
  if (!rule.schedule_days.map((d) => d.toLowerCase()).includes(todayKey)) {
    return false;
  }

  const [startH, startM] = rule.schedule_start.split(':').map(Number);
  const [endH,   endM]   = rule.schedule_end.split(':').map(Number);

  const nowMinutes   = now.getHours() * 60 + now.getMinutes();
  const startMinutes = startH * 60 + startM;
  const endMinutes   = endH   * 60 + endM;

  if (startMinutes <= endMinutes) {
    // Normal same-day window, e.g. 09:00–17:00
    return nowMinutes >= startMinutes && nowMinutes < endMinutes;
  }
  // Overnight window, e.g. 21:00–07:00
  return nowMinutes >= startMinutes || nowMinutes < endMinutes;
}

module.exports = { isWithinScheduleWindow };
