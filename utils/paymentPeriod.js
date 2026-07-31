/**
 * Add months to a date (calendar months).
 * @param {Date} date
 * @param {number} months
 * @returns {Date}
 */
function addMonths(date, months) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

/**
 * Set periodStart and periodEnd on a payment from a start date and plan duration.
 * @param {object} payment - Mongoose payment doc (mutated)
 * @param {Date} startDate
 * @param {number} durationMonths - from plan
 */
function setPeriodFromPlan(payment, startDate, durationMonths) {
  if (!durationMonths || durationMonths < 1) return;
  const start = new Date(startDate);
  payment.periodStart = start;
  payment.periodEnd = addMonths(start, durationMonths);
}

module.exports = { addMonths, setPeriodFromPlan };
