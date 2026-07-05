// Fixture aggregates for the demo dashboard. Collector storage is disabled,
// so these values stand in for the aggregation pipeline that will replace them.

export const fieldFriction = Object.freeze([
  { name: 'Full name', value: 8.2 },
  { name: 'Licence reason', value: 26.4 },
  { name: 'Contact method', value: 6.1 },
  { name: 'Help section', value: 4.8 }
]);

export const validationErrors = Object.freeze([
  { name: 'Mon', value: 18 },
  { name: 'Tue', value: 17 },
  { name: 'Wed', value: 12 },
  { name: 'Thu', value: 9 },
  { name: 'Fri', value: 7 },
  { name: 'Sat', value: 6 },
  { name: 'Sun', value: 6 }
]);

export const helpRequests = Object.freeze([
  { name: 'Licence reason', value: 14 },
  { name: 'Contact method', value: 5 },
  { name: 'Full name', value: 2 }
]);

export const dashboardChartData = Object.freeze({
  fieldFriction: {
    containerId: 'field-friction-chart',
    xAxisLabel: 'Median seconds per question',
    data: fieldFriction
  },
  validationErrors: {
    containerId: 'validation-errors-chart',
    xAxisLabel: 'Day of week',
    yAxisLabel: 'Errors per 100 sessions',
    data: validationErrors
  }
});
