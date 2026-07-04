/* global d3 */

// Chart modules for the Flux demo dashboard, following the ONS Charts
// conventions (https://github.com/ONSdigital/Charts): a config object with
// per-breakpoint margins, an accessible summary alongside the graphic, data
// labels on bars and a muted gridline style. The full ONS template library
// can replace these modules without changing the page markup.

const ONS_COLOURS = {
  oceanBlue: '#206095',
  skyBlue: '#27a0cc',
  nightBlue: '#003c57',
  grey: '#b3b3b3',
  gridline: '#d9d9d9'
};

const barConfig = {
  colourPalette: ONS_COLOURS.oceanBlue,
  margin: {
    sm: { top: 15, right: 30, bottom: 50, left: 130 },
    md: { top: 15, right: 30, bottom: 50, left: 150 },
    lg: { top: 15, right: 30, bottom: 50, left: 170 }
  },
  seriesHeight: { sm: 34, md: 34, lg: 34 },
  xAxisTicks: { sm: 4, md: 6, lg: 8 }
};

const lineConfig = {
  colourPalette: ONS_COLOURS.oceanBlue,
  height: { sm: 240, md: 280, lg: 320 },
  margin: {
    sm: { top: 15, right: 20, bottom: 50, left: 45 },
    md: { top: 15, right: 20, bottom: 50, left: 45 },
    lg: { top: 15, right: 20, bottom: 50, left: 45 }
  },
  yAxisTicks: { sm: 4, md: 5, lg: 6 }
};

function sizeFor(width) {
  if (width < 450) return 'sm';
  if (width < 720) return 'md';
  return 'lg';
}

export function drawBarChart({ containerId, data, xAxisLabel }) {
  const graphic = d3.select(`#${containerId}`);
  graphic.selectAll('*').remove();

  const containerWidth = parseInt(graphic.style('width'), 10) || 640;
  const size = sizeFor(containerWidth);
  const margin = barConfig.margin[size];
  const chartWidth = containerWidth - margin.left - margin.right;
  const height = barConfig.seriesHeight[size] * data.length;

  const x = d3
    .scaleLinear()
    .range([0, chartWidth])
    .domain([0, d3.max(data, (d) => d.value)])
    .nice();

  const y = d3
    .scaleBand()
    .paddingOuter(0.2)
    .paddingInner(0.25)
    .range([0, height])
    .round(true)
    .domain(data.map((d) => d.name));

  const svg = graphic
    .append('svg')
    .attr('width', containerWidth)
    .attr('height', height + margin.top + margin.bottom)
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  svg
    .append('g')
    .attr('class', 'flux-chart__gridlines')
    .call(d3.axisBottom(x).tickSize(height).ticks(barConfig.xAxisTicks[size]).tickFormat(''))
    .call((g) => g.select('.domain').remove())
    .selectAll('line')
    .attr('stroke', ONS_COLOURS.gridline);

  svg
    .append('g')
    .attr('class', 'flux-chart__axis')
    .call(d3.axisLeft(y).tickSize(0).tickPadding(10))
    .call((g) => g.select('.domain').remove());

  svg
    .append('g')
    .attr('class', 'flux-chart__axis')
    .attr('transform', `translate(0,${height})`)
    .call(d3.axisBottom(x).ticks(barConfig.xAxisTicks[size]))
    .call((g) => g.select('.domain').remove());

  svg
    .selectAll('rect.flux-chart__bar')
    .data(data)
    .join('rect')
    .attr('class', 'flux-chart__bar')
    .attr('x', 0)
    .attr('y', (d) => y(d.name))
    .attr('width', (d) => x(d.value))
    .attr('height', y.bandwidth())
    .attr('fill', barConfig.colourPalette);

  svg
    .selectAll('text.flux-chart__data-label')
    .data(data)
    .join('text')
    .attr('class', 'flux-chart__data-label')
    .attr('x', (d) => x(d.value) + 5)
    .attr('y', (d) => y(d.name) + y.bandwidth() / 2)
    .attr('dominant-baseline', 'central')
    .text((d) => d.value);

  svg
    .append('text')
    .attr('class', 'flux-chart__axis-label')
    .attr('x', chartWidth)
    .attr('y', height + 40)
    .attr('text-anchor', 'end')
    .text(xAxisLabel);
}

export function drawLineChart({ containerId, data, xAxisLabel, yAxisLabel }) {
  const graphic = d3.select(`#${containerId}`);
  graphic.selectAll('*').remove();

  const containerWidth = parseInt(graphic.style('width'), 10) || 640;
  const size = sizeFor(containerWidth);
  const margin = lineConfig.margin[size];
  const chartWidth = containerWidth - margin.left - margin.right;
  const height = lineConfig.height[size] - margin.top - margin.bottom;

  const x = d3.scalePoint().range([0, chartWidth]).padding(0.3).domain(data.map((d) => d.name));
  const y = d3
    .scaleLinear()
    .range([height, 0])
    .domain([0, d3.max(data, (d) => d.value)])
    .nice();

  const svg = graphic
    .append('svg')
    .attr('width', containerWidth)
    .attr('height', lineConfig.height[size])
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  svg
    .append('g')
    .attr('class', 'flux-chart__gridlines')
    .call(d3.axisLeft(y).tickSize(-chartWidth).ticks(lineConfig.yAxisTicks[size]).tickFormat(''))
    .call((g) => g.select('.domain').remove())
    .selectAll('line')
    .attr('stroke', ONS_COLOURS.gridline);

  svg
    .append('g')
    .attr('class', 'flux-chart__axis')
    .attr('transform', `translate(0,${height})`)
    .call(d3.axisBottom(x).tickSize(0).tickPadding(10))
    .call((g) => g.select('.domain').remove());

  svg
    .append('g')
    .attr('class', 'flux-chart__axis')
    .call(d3.axisLeft(y).ticks(lineConfig.yAxisTicks[size]).tickSize(0).tickPadding(8))
    .call((g) => g.select('.domain').remove());

  svg
    .append('path')
    .datum(data)
    .attr('class', 'flux-chart__line')
    .attr('fill', 'none')
    .attr('stroke', lineConfig.colourPalette)
    .attr('stroke-width', 3)
    .attr(
      'd',
      d3
        .line()
        .x((d) => x(d.name))
        .y((d) => y(d.value))
    );

  svg
    .selectAll('circle.flux-chart__marker')
    .data(data)
    .join('circle')
    .attr('class', 'flux-chart__marker')
    .attr('cx', (d) => x(d.name))
    .attr('cy', (d) => y(d.value))
    .attr('r', 4)
    .attr('fill', lineConfig.colourPalette);

  svg
    .append('text')
    .attr('class', 'flux-chart__axis-label')
    .attr('x', chartWidth)
    .attr('y', height + 40)
    .attr('text-anchor', 'end')
    .text(xAxisLabel);

  svg
    .append('text')
    .attr('class', 'flux-chart__axis-label')
    .attr('x', 0)
    .attr('y', -5)
    .attr('text-anchor', 'start')
    .text(yAxisLabel);
}

function drawDashboard() {
  const dataElement = document.getElementById('flux-dashboard-data');
  if (!dataElement) return;

  const dashboard = JSON.parse(dataElement.textContent);
  drawBarChart(dashboard.fieldFriction);
  drawLineChart(dashboard.validationErrors);
}

drawDashboard();

let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(drawDashboard, 150);
});
